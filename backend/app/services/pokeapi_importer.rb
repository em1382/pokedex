# Copies PokeAPI resources into SQLite: the list, then every detail record.
# Records already in the database are skipped unless force: true. Upstream
# fetches go through PokeapiClient's cache and are throttled by `delay`.
class PokeapiImporter
  # JSON path of the sprite each grid shows, per resource.
  SPRITE_PATHS = {
    "pokemon" => "$.sprites.front_default",
    "item" => "$.sprites.default"
  }.freeze

  BATCH_SIZE = 100

  Result = Struct.new(:resource, :total, :imported, :skipped, :fetched, :failed, keyword_init: true)

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

  # Downloads the grid sprites referenced by already-imported records.
  # Returns [downloaded, missing].
  def import_sprites(resource)
    json_path = SPRITE_PATHS[resource] or return [0, 0]
    urls = PokeapiRecord.of(resource).pluck(Arel.sql(ActiveRecord::Base.sanitize_sql_array(["body ->> ?", json_path])))
    paths = urls.compact.uniq.filter_map { |url| PokeapiSprite.path_for(url) }
    have = PokeapiSprite.where(path: paths).pluck(:path).to_set
    downloaded = missing = 0

    (paths.reject { |p| have.include?(p) }).each_with_index do |path, i|
      type, data = PokeapiClient.binary(PokeapiSprite::UPSTREAM_PREFIX + path)
      if data
        PokeapiSprite.create!(path: path, content_type: type, data: data)
        downloaded += 1
      else
        missing += 1
      end
      sleep @delay
      @log.call("#{resource} sprites: #{i + 1}/#{paths.size - have.size}")
    rescue PokeapiClient::UpstreamError => e
      @log.call("#{resource} sprite #{path}: #{e.message}")
      missing += 1
    end
    [downloaded, missing]
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
    res = PokeapiClient.detail(resource, entry[:key])
    unless res.cache_hit
      result.fetched += 1
      sleep @delay
    end
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
