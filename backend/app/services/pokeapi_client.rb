require "net/http"

# Upstream HTTP client used only by the importer — the API itself never calls out.
#
# PokeAPI's fair-use policy asks consumers to "locally cache resources whenever
# you request them": JSON responses are cached in Rails.cache (file store under
# storage/pokeapi_cache) keyed by URL, so re-imports don't re-hit PokeAPI.
class PokeapiClient
  BASE_URL = "https://pokeapi.co/api/v2".freeze
  USER_AGENT = "mass-datagrid-port importer (caches all responses locally)".freeze

  SUCCESS_TTL = 30.days
  NOT_FOUND_TTL = 1.hour

  Response = Struct.new(:status, :body, :cache_hit, keyword_init: true) do
    def ok? = status == 200
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
    key = "pokeapi:#{uri}"

    if (cached = Rails.cache.read(key))
      return Response.new(status: cached[:status], body: utf8(cached[:body]), cache_hit: true)
    end

    res = http_get(uri, "application/json")
    raise UpstreamError, "PokeAPI responded #{res.code} for #{uri}" unless %w[200 404].include?(res.code)

    entry = { status: res.code.to_i, body: utf8(res.body) }
    Rails.cache.write(key, entry, expires_in: entry[:status] == 200 ? SUCCESS_TTL : NOT_FOUND_TTL)
    Response.new(**entry, cache_hit: false)
  end

  # Raw bytes (sprites). Returns [content_type, body] or nil on 404.
  def self.binary(url)
    res = http_get(URI(url), "image/*")
    return nil if res.code == "404"
    raise UpstreamError, "#{res.code} for #{url}" unless res.code == "200"

    [res.content_type.presence || "image/png", res.body.to_s]
  end

  # Net::HTTP hands back ASCII-8BIT; PokeAPI JSON is UTF-8.
  def self.utf8(body) = body.to_s.dup.force_encoding(Encoding::UTF_8)

  def self.http_get(uri, accept)
    Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 5, read_timeout: 30) do |http|
      http.request(Net::HTTP::Get.new(uri, "User-Agent" => USER_AGENT, "Accept" => accept))
    end
  rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, SystemCallError, OpenSSL::SSL::SSLError => e
    raise UpstreamError, "#{uri.host} unreachable: #{e.class}: #{e.message}"
  end
  private_class_method :http_get, :utf8
end
