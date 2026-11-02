# A small, deterministic dataset for the Playwright end-to-end tests, made from
# real imported PokeAPI records (so tests need no network and no full import).
#
#   E2eFixture.build -> Hash (written to E2eFixture::PATH by `bin/rails e2e:fixture`)
#   E2eFixture.load  -> replaces the records and sprites in the current database
#                       (`bin/rails e2e:seed`, only allowed on an e2e database)
#
# Records are trimmed to keep the fixture small: English entries only, no
# per-game-version detail and no PokeAPI `url` links. Everything the grids read is kept.
class E2eFixture
  PATH = Rails.root.join("test/e2e/pokeapi.json")

  # First N records (by PokeAPI id) of each grid's resource: several pages each.
  COUNTS = { "pokemon" => 60, "move" => 60, "ability" => 30, "item" => 60, "type" => 21 }.freeze

  # Arrays whose entries only need their resource reference.
  SLIM_ARRAYS = { "moves" => "move", "held_by_pokemon" => "pokemon" }.freeze
  DROPPED_KEYS = %w[game_indices].freeze

  class NotAnE2eDatabase < StandardError; end

  def self.build
    records = COUNTS.flat_map do |resource, count|
      PokeapiRecord.of(resource).order(:pokeapi_id).limit(count).map do |record|
        { "resource" => resource, "name" => record.name, "pokeapi_id" => record.pokeapi_id,
          "body" => trim(JSON.parse(record.body)) }
      end
    end
    { "records" => records, "sprites" => sprites_for(records) }
  end

  def self.load(fixture = JSON.parse(File.read(PATH)))
    database = ActiveRecord::Base.connection_db_config.database.to_s
    raise NotAnE2eDatabase, "refusing to replace data in #{database}" unless File.basename(database).include?("e2e")

    now = Time.current
    ActiveRecord::Base.transaction do
      PokeapiRecord.delete_all
      PokeapiSprite.delete_all
      PokeapiRecord.insert_all!(fixture.fetch("records").map do |r|
        { resource: r["resource"], name: r["name"], pokeapi_id: r["pokeapi_id"], body: r["body"].to_json,
          created_at: now, updated_at: now }
      end)
      sprites = fixture.fetch("sprites")
      if sprites.any?
        PokeapiSprite.insert_all!(sprites.map do |s|
          { path: s["path"], content_type: s["content_type"], data: Base64.strict_decode64(s["data"]),
            created_at: now, updated_at: now }
        end)
      end
    end
  end

  def self.trim(doc)
    doc.each_with_object({}) do |(key, value), out|
      next if DROPPED_KEYS.include?(key)

      out[key] =
        if SLIM_ARRAYS.key?(key) then value.map { |e| e.slice(SLIM_ARRAYS[key]) }
        elsif key == "sprites" then value.reject { |_, v| v.is_a?(Hash) }
        elsif localized?(value) then value.select { |e| e.dig("language", "name") == "en" }
        else value
        end
    end.then { |trimmed| without_urls(trimmed) }
  end

  # PokeAPI's `url` links (the grids only use names).
  def self.without_urls(value)
    case value
    when Hash then value.except("url").transform_values { |v| without_urls(v) }
    when Array then value.map { |v| without_urls(v) }
    else value
    end
  end

  # An array of entries that each carry a `language` (effect, flavor text, names…).
  def self.localized?(value)
    value.is_a?(Array) && value.first.is_a?(Hash) && value.first.key?("language")
  end

  def self.sprites_for(records)
    paths = records.filter_map do |r|
      sprites = r["body"]["sprites"] || {}
      PokeapiSprite.path_for(sprites["front_default"] || sprites["default"])
    end
    PokeapiSprite.where(path: paths).order(:path).map do |s|
      { "path" => s.path, "content_type" => s.content_type, "data" => Base64.strict_encode64(s.data) }
    end
  end

  # JSON with one record (or sprite) per line: compact, but readable in diffs.
  def self.dump(fixture)
    lines = ->(items) { items.map { |item| "    #{item.to_json}" }.join(",\n") }
    "{\n  \"records\": [\n#{lines.call(fixture['records'])}\n  ],\n" \
      "  \"sprites\": [\n#{lines.call(fixture['sprites'])}\n  ]\n}\n"
  end

  private_class_method :trim, :without_urls, :localized?, :sprites_for
end
