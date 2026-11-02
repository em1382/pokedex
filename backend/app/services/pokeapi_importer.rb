# Copies PokeAPI resources into SQLite: the list, then every detail record.
# Records already in the database are skipped unless force: true. Upstream
# fetches go through PokeapiClient's cache; every request that actually reaches
# the network (including failed ones) is followed by a `delay` pause.
class PokeapiImporter
  # JSON path of the sprite each grid shows, per resource.
  SPRITE_PATHS = {
    "pokemon" => "$.sprites.front_default",
    "item" => "$.sprites.default"
  }.freeze

  BATCH_SIZE = 100

  Result = Struct.new(:resource, :total, :imported, :skipped, :fetched, :failed, keyword_init: true)
  # missing: no such file upstream (404); failed: errors (network, non-image…).
  SpriteResult = Struct.new(:downloaded, :cached, :missing, :failed, keyword_init: true) do
    def failed? = failed.any?
  end

  def initialize(delay: 0.05, force: false, log: ->(_msg) {})
    @delay = delay
    @force = force
    @log = log
  end

  def import(resource)
    raise ArgumentError, "unknown resource #{resource.inspect}" unless PokeapiRecord.resource?(resource)

    list = PokeapiClient.list(resource)
    raise PokeapiClient::UpstreamError, "list for #{resource} returned #{list.status}" unless list.ok?

    entries = list_entries(list.body)
    existing = @force ? Set.new : PokeapiRecord.of(resource).pluck(:pokeapi_id).to_set
    todo = entries.reject { |e| existing.include?(e[:id]) }
    result = Result.new(resource: resource, total: entries.size, imported: 0,
                        skipped: entries.size - todo.size, fetched: 0, failed: [])

    todo.each_slice(BATCH_SIZE) do |batch|
      rows = batch.filter_map { |entry| fetch_row(resource, entry, result) }
      save(rows)
      result.imported += rows.size
      @log.call("#{resource}: #{result.skipped + result.imported + result.failed.size}/#{entries.size}")
    end
    result
  end

  # Stores the grid sprites referenced by already-imported records.
  def import_sprites(resource)
    result = SpriteResult.new(downloaded: 0, cached: 0, missing: [], failed: [])
    json_path = SPRITE_PATHS[resource] or return result
    urls = PokeapiRecord.of(resource).pluck(Arel.sql(ActiveRecord::Base.sanitize_sql_array(["body ->> ?", json_path])))
    paths = urls.compact.uniq.filter_map { |url| PokeapiSprite.path_for(url) }
    todo = paths - PokeapiSprite.where(path: paths).pluck(:path)

    todo.each_with_index do |path, i|
      image = throttled { PokeapiClient.image(PokeapiSprite::UPSTREAM_PREFIX + path) }
      if image.found?
        PokeapiSprite.create!(path: path, content_type: image.content_type, data: image.data)
        image.cache_hit ? result.cached += 1 : result.downloaded += 1
      else
        result.missing << path
      end
      @log.call("#{resource} sprites: #{i + 1}/#{todo.size}")
    rescue PokeapiClient::UpstreamError => e
      @log.call("#{resource} sprite #{path}: #{e.message}")
      result.failed << path
    end
    result
  end

  private

  # [{name:, id:, key:}] where key is what we request: the name (matches how
  # earlier fetches were cached) unless the name is ambiguous, then the id.
  def list_entries(body)
    results = JSON.parse(body).fetch("results")
    dupes = results.map { |r| r["name"] }.tally.select { |_, n| n > 1 }.keys.to_set
    results.map do |r|
      id = Integer(r.fetch("url")[%r{/(\d+)/?\z}, 1], 10)
      { name: r.fetch("name"), id: id, key: dupes.include?(r["name"]) ? id : r["name"] }
    end
  end

  def fetch_row(resource, entry, result)
    name = entry[:name]
    res = throttled { PokeapiClient.detail(resource, entry[:key]) }
    result.fetched += 1 unless res.cache_hit
    unless res.ok?
      result.failed << name
      return nil
    end

    doc = JSON.parse(res.body)
    { resource: resource, name: name, pokeapi_id: doc.fetch("id"), body: res.body }
  rescue PokeapiClient::UpstreamError, JSON::ParserError, KeyError => e
    @log.call("#{resource}/#{name}: #{e.message}")
    result.failed << name
    nil
  end

  # Runs an upstream call, pausing afterwards unless it was served from cache —
  # including when it raised, so errors never turn into a burst of requests.
  def throttled
    response = yield
  ensure
    sleep @delay if @delay.positive? && !response&.cache_hit
  end

  def save(rows)
    return if rows.empty?

    now = Time.current
    PokeapiRecord.upsert_all(
      rows.map { |r| r.merge(created_at: now, updated_at: now) },
      unique_by: %i[resource pokeapi_id],
      update_only: %i[name body updated_at]
    )
  end
end
