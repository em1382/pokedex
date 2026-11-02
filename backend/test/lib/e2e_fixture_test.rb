require "test_helper"
require "minitest/mock"

class E2eFixtureTest < ActiveSupport::TestCase
  SPRITE_URL = "#{PokeapiSprite::UPSTREAM_PREFIX}pokemon/1.png".freeze

  def bulbasaur
    {
      id: 1, name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon/1/",
      sprites: { front_default: SPRITE_URL, back_default: nil, other: { home: {} }, versions: {} },
      moves: [ { move: { name: "tackle", url: "u" }, version_group_details: [ { level: 1 } ] } ],
      game_indices: [ { game_index: 153 } ],
      flavor_text_entries: [
        { flavor_text: "Graine", language: { name: "fr", url: "u" } },
        { flavor_text: "Seed", language: { name: "en", url: "u" } }
      ],
      stats: [ { base_stat: 45, stat: { name: "hp", url: "u" } } ]
    }
  end

  test "build keeps the first records of each grid, trimmed, with their sprites" do
    add_record("pokemon", 1, "bulbasaur", bulbasaur)
    add_record("pokemon", 2, "ivysaur")
    add_record("item", 1, "master-ball", held_by_pokemon: [ { pokemon: { name: "x" }, version_details: [ 1 ] } ])
    add_record("berry", 1, "cheri") # not a grid resource
    PokeapiSprite.create!(path: "pokemon/1.png", content_type: "image/png", data: "PNG".b)
    PokeapiSprite.create!(path: "pokemon/999.png", content_type: "image/png", data: "X".b) # unreferenced

    fixture = E2eFixture.build

    assert_equal %w[pokemon/1 pokemon/2 item/1],
                 fixture["records"].map { "#{_1['resource']}/#{_1['pokeapi_id']}" }
    body = fixture["records"].first["body"]
    assert_equal({ "front_default" => SPRITE_URL, "back_default" => nil }, body["sprites"])
    assert_equal [ { "move" => { "name" => "tackle" } } ], body["moves"]
    assert_equal [ { "flavor_text" => "Seed", "language" => { "name" => "en" } } ], body["flavor_text_entries"]
    assert_equal [ { "base_stat" => 45, "stat" => { "name" => "hp" } } ], body["stats"]
    assert_not body.key?("game_indices")
    assert_not body.key?("url")
    assert_equal [ { "pokemon" => { "name" => "x" } } ], fixture["records"].last["body"]["held_by_pokemon"]
    assert_equal [ { "path" => "pokemon/1.png", "content_type" => "image/png", "data" => Base64.strict_encode64("PNG") } ],
                 fixture["sprites"]
  end

  test "build limits each resource to its count" do
    add_record("type", 2, "fighting")
    add_record("type", 1, "normal")

    with_counts("type" => 1) do
      assert_equal [ "normal" ], E2eFixture.build["records"].map { _1["name"] }
    end
  end

  test "dump writes valid JSON with one record per line" do
    fixture = { "records" => [ { "a" => 1 }, { "b" => 2 } ], "sprites" => [ { "c" => 3 } ] }

    text = E2eFixture.dump(fixture)

    assert_equal fixture, JSON.parse(text)
    assert_equal [ "{", "  \"records\": [", "    {\"a\":1},", "    {\"b\":2}", "  ],", "  \"sprites\": [",
                   "    {\"c\":3}", "  ]", "}" ], text.lines.map(&:chomp)
  end

  test "load refuses any database that isn't an e2e one" do
    error = assert_raises(E2eFixture::NotAnE2eDatabase) { E2eFixture.load({ "records" => [], "sprites" => [] }) }
    assert_match "refusing", error.message
  end

  test "load replaces all records and sprites on an e2e database" do
    add_record("move", 99, "old")
    PokeapiSprite.create!(path: "old.png", content_type: "image/png", data: "O".b)
    fixture = {
      "records" => [ { "resource" => "type", "name" => "fire", "pokeapi_id" => 10, "body" => { "id" => 10 } } ],
      "sprites" => [ { "path" => "items/a.png", "content_type" => "image/png", "data" => Base64.strict_encode64("A") } ]
    }

    as_e2e_database { E2eFixture.load(fixture) }

    assert_equal [ [ "type", "fire", 10 ] ], PokeapiRecord.pluck(:resource, :name, :pokeapi_id)
    assert_equal({ "id" => 10 }, JSON.parse(PokeapiRecord.first.body))
    assert_equal [ [ "items/a.png", "A" ] ], PokeapiSprite.pluck(:path, :data)
  end

  test "load works with a fixture that has no sprites" do
    fixture = { "records" => [ { "resource" => "type", "name" => "fire", "pokeapi_id" => 10, "body" => {} } ], "sprites" => [] }
    as_e2e_database { E2eFixture.load(fixture) }
    assert_equal 1, PokeapiRecord.count
    assert_equal 0, PokeapiSprite.count
  end

  test "load reads the committed fixture by default" do
    as_e2e_database { E2eFixture.load }
    assert_equal E2eFixture::COUNTS.values.sum, PokeapiRecord.count
    assert_operator PokeapiSprite.count, :>, 0
  end

  private

  def as_e2e_database(&)
    config = ActiveRecord::Base.connection_db_config
    config.stub(:database, "storage/e2e.sqlite3", &)
  end

  def with_counts(counts)
    original = E2eFixture::COUNTS
    E2eFixture.send(:remove_const, :COUNTS)
    E2eFixture.const_set(:COUNTS, counts.freeze)
    yield
  ensure
    E2eFixture.send(:remove_const, :COUNTS)
    E2eFixture.const_set(:COUNTS, original)
  end
end
