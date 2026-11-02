require "net/http"

# Upstream HTTP client used only by the importer — the API itself never calls out.
#
# PokeAPI's fair-use policy asks consumers to "locally cache resources whenever
# you request them": responses (JSON and sprite images) are cached in Rails.cache
# (file store under storage/pokeapi_cache) keyed by URL, so re-imports and image
# rebuilds don't re-hit PokeAPI or GitHub. Rate limiting (429) and server errors
# are retried with backoff, honouring Retry-After.
class PokeapiClient
  BASE_URL = "https://pokeapi.co/api/v2".freeze
  USER_AGENT = "mass-datagrid-port importer (caches all responses locally)".freeze

  SUCCESS_TTL = 30.days
  NOT_FOUND_TTL = 1.hour

  # Attempts per request, and the backoff between them (Retry-After wins, capped).
  MAX_ATTEMPTS = 4
  BACKOFF_BASE = 1 # seconds: 1, 2, 4
  MAX_BACKOFF = 60
  RETRYABLE = ->(code) { code == 429 || code.between?(500, 599) }

  # How to wait between retries; tests swap in a recorder.
  cattr_accessor :sleeper, default: ->(seconds) { sleep(seconds) }

  Response = Struct.new(:status, :body, :cache_hit, keyword_init: true) do
    def ok? = status == 200
  end

  # A downloaded image. `data` is nil when upstream has no such file (404).
  Image = Struct.new(:content_type, :data, :cache_hit, keyword_init: true) do
    def found? = !data.nil?
  end

  class UpstreamError < StandardError; end

  def self.list(resource)
    get("/#{resource}/", limit: 100_000)
  end

  # `key` is a name or numeric id.
  def self.detail(resource, key)
    get("/#{resource}/#{key.to_s.downcase}/")
  end

  def self.get(path, query = {})
    uri = URI("#{BASE_URL}#{path}")
    uri.query = URI.encode_www_form(query.sort) if query.any?

    entry, hit = cached("pokeapi:#{uri}") do
      res = request(uri, "application/json")
      { status: res.code.to_i, body: utf8(res.body) }
    end
    Response.new(**entry, cache_hit: hit)
  end

  # Sprite bytes. Only image/* responses are accepted (and cached).
  def self.image(url)
    uri = URI(url)
    entry, hit = cached("sprite:#{uri}") do
      res = request(uri, "image/*")
      if res.code == "404"
        { status: 404 }
      else
        type = res.content_type.presence || "image/png"
        raise UpstreamError, "#{uri} is #{type}, not an image" unless type.start_with?("image/")

        { status: 200, content_type: type, data: res.body.to_s.b }
      end
    end
    Image.new(content_type: entry[:content_type], data: entry[:data], cache_hit: hit)
  end

  # Read-through cache: 200s for SUCCESS_TTL, 404s for NOT_FOUND_TTL. Returns [entry, cache_hit].
  def self.cached(key)
    if (entry = Rails.cache.read(key))
      return [ entry.key?(:body) ? entry.merge(body: utf8(entry[:body])) : entry, true ]
    end

    entry = yield
    Rails.cache.write(key, entry, expires_in: entry[:status] == 200 ? SUCCESS_TTL : NOT_FOUND_TTL)
    [ entry, false ]
  end

  # GET with retries on 429/5xx and network errors; returns a 200 or 404 response.
  def self.request(uri, accept)
    (1..MAX_ATTEMPTS).each do |attempt|
      res = begin
        http_get(uri, accept)
      rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, SystemCallError, OpenSSL::SSL::SSLError => e
        raise UpstreamError, "#{uri.host} unreachable: #{e.class}: #{e.message}" if attempt == MAX_ATTEMPTS

        sleeper.call(backoff(attempt, nil))
        next
      end
      return res if %w[200 404].include?(res.code)

      unless RETRYABLE.call(res.code.to_i) && attempt < MAX_ATTEMPTS
        raise UpstreamError, "#{uri.host} responded #{res.code} for #{uri} (attempt #{attempt})"
      end

      sleeper.call(backoff(attempt, res["Retry-After"]))
    end
  end

  def self.backoff(attempt, retry_after)
    seconds = Integer(retry_after.to_s, 10) if retry_after.to_s.match?(/\A\d+\z/)
    [ seconds || BACKOFF_BASE * (2**(attempt - 1)), MAX_BACKOFF ].min
  end

  # Net::HTTP hands back ASCII-8BIT; PokeAPI JSON is UTF-8.
  def self.utf8(body) = body.to_s.dup.force_encoding(Encoding::UTF_8)

  def self.http_get(uri, accept)
    Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 5, read_timeout: 30) do |http|
      http.request(Net::HTTP::Get.new(uri, "User-Agent" => USER_AGENT, "Accept" => accept))
    end
  end
  private_class_method :cached, :request, :backoff, :utf8, :http_get
end
