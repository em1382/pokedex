require "test_helper"

class PokeapiImporterTest < ActiveSupport::TestCase
  BASE = PokeapiClient::BASE_URL

  setup { Rails.cache.clear }

  def stub_list(resource, entries)
    results = entries.map { |name, id| { name: name, url: "#{BASE}/#{resource}/#{id}/" } }
    stub_request(:get, "#{BASE}/#{resource}/?limit=100000")
      .to_return(status: 200, body: { count: results.size, results: results }.to_json)
  end

  def stub_detail(resource, key, doc, status: 200)
    stub_request(:get, "#{BASE}/#{resource}/#{key}/").to_return(status: status, body: doc.to_json)
  end

  test "imports list + details, keyed by id even when names repeat" do
    stub_list("item", [ [ "potion", 17 ], [ "roseli-berry", 723 ], [ "roseli-berry", 2160 ] ])
    stub_detail("item", "potion", { id: 17, name: "potion" })
    stub_detail("item", 723, { id: 723, name: "roseli-berry" })
    stub_detail("item", 2160, { id: 2160, name: "roseli-berry" })

    result = PokeapiImporter.new(delay: 0).import("item")

    assert_equal 3, result.imported
    assert_equal [ 17, 723, 2160 ], PokeapiRecord.of("item").order(:pokeapi_id).pluck(:pokeapi_id)
    assert_equal 723, PokeapiRecord.lookup("item", "roseli-berry").pokeapi_id
  end

  test "skips records already present and reuses the HTTP cache" do
    list = stub_list("type", [ [ "fire", 10 ], [ "water", 11 ] ])
    fire = stub_detail("type", "fire", { id: 10, name: "fire" })
    water = stub_detail("type", "water", { id: 11, name: "water" })
    add_record("type", 10, "fire")

    result = PokeapiImporter.new(delay: 0).import("type")
    assert_equal 1, result.skipped
    assert_equal 1, result.imported
    assert_not_requested fire

    PokeapiImporter.new(delay: 0, force: true).import("type")
    assert_requested list, times: 1   # second run served from cache
    assert_requested water, times: 1
    assert_requested fire, times: 1
  end

  test "records missing upstream are reported, not fatal" do
    stub_list("move", [ [ "pound", 1 ], [ "ghost-move", 9999 ] ])
    stub_detail("move", "pound", { id: 1, name: "pound" })
    stub_detail("move", "ghost-move", "Not Found", status: 404)

    result = PokeapiImporter.new(delay: 0).import("move")

    assert_equal 1, result.imported
    assert_equal [ "ghost-move" ], result.failed
  end

  test "downloads sprites referenced by imported records once" do
    url = "#{PokeapiSprite::UPSTREAM_PREFIX}pokemon/25.png"
    add_record("pokemon", 25, "pikachu", sprites: { front_default: url })
    add_record("pokemon", 26, "raichu", sprites: { front_default: nil })
    png = stub_request(:get, url).to_return(status: 200, body: "PNG", headers: { "Content-Type" => "image/png" })

    importer = PokeapiImporter.new(delay: 0)
    first = importer.import_sprites("pokemon")
    second = importer.import_sprites("pokemon")

    assert_equal [ 1, 0, [], [] ], first.to_a
    assert_equal [ 0, 0, [], [] ], second.to_a
    assert_requested png, times: 1
    assert_equal "PNG", PokeapiSprite.find_by!(path: "pokemon/25.png").data
  end

  test "sprites come from the HTTP cache after the database is rebuilt" do
    url = "#{PokeapiSprite::UPSTREAM_PREFIX}pokemon/25.png"
    add_record("pokemon", 25, "pikachu", sprites: { front_default: url })
    png = stub_request(:get, url).to_return(status: 200, body: "PNG", headers: { "Content-Type" => "image/png" })
    PokeapiImporter.new(delay: 0).import_sprites("pokemon")
    PokeapiSprite.delete_all

    result = PokeapiImporter.new(delay: 0).import_sprites("pokemon")

    assert_equal [ 0, 1 ], [ result.downloaded, result.cached ]
    assert_requested png, times: 1
  end

  test "rejects unknown resources" do
    assert_raises(ArgumentError) { PokeapiImporter.new(delay: 0).import("digimon") }
  end

  test "a failed list request is an error" do
    stub_request(:get, "#{BASE}/item/?limit=100000").to_return(status: 404, body: "Not Found")
    assert_raises(PokeapiClient::UpstreamError) { PokeapiImporter.new(delay: 0).import("item") }
  end

  test "upstream errors and bad payloads fail that record only, with a log line" do
    stub_list("type", [ [ "fire", 10 ], [ "water", 11 ], [ "grass", 12 ], [ "rock", 13 ] ])
    stub_detail("type", "fire", { id: 10, name: "fire" })
    stub_request(:get, "#{BASE}/type/water/").to_return(status: 500)
    stub_request(:get, "#{BASE}/type/grass/").to_return(status: 200, body: "not json")
    stub_detail("type", "rock", { name: "rock" }) # no id

    log = []
    result = PokeapiImporter.new(delay: 0, log: ->(msg) { log << msg }).import("type")

    assert_equal 1, result.imported
    assert_equal %w[water grass rock], result.failed
    assert_equal [ 10 ], PokeapiRecord.of("type").pluck(:pokeapi_id)
    assert(log.any? { _1.start_with?("type/water:") })
    assert_equal "type: 4/4", log.last
  end

  test "counts sprites missing upstream and keeps going after errors" do
    urls = %w[pokemon/1.png pokemon/2.png pokemon/3.png].map { PokeapiSprite::UPSTREAM_PREFIX + _1 }
    urls.each_with_index { |url, i| add_record("pokemon", i + 1, "p#{i}", sprites: { front_default: url }) }
    add_record("pokemon", 4, "elsewhere", sprites: { front_default: "https://example.com/x.png" }) # not ours
    stub_request(:get, urls[0]).to_return(status: 200, body: "PNG")
    stub_request(:get, urls[1]).to_return(status: 404)
    stub_request(:get, urls[2]).to_return(status: 500)

    log = []
    result = PokeapiImporter.new(delay: 0, log: ->(msg) { log << msg }).import_sprites("pokemon")

    assert_equal 1, result.downloaded
    assert_equal [ "pokemon/2.png" ], result.missing
    assert_equal [ "pokemon/3.png" ], result.failed
    assert_predicate result, :failed?
    assert_equal [ "pokemon/1.png" ], PokeapiSprite.pluck(:path)
    assert(log.any? { _1.include?("pokemon/3.png") })
    assert_not_requested :get, "https://example.com/x.png"
  end

  test "resources without grid sprites have nothing to download" do
    assert_equal [ 0, 0, [], [] ], PokeapiImporter.new(delay: 0).import_sprites("move").to_a
  end

  test "a batch where every record fails writes nothing" do
    stub_list("move", [ [ "gone", 1 ] ])
    stub_detail("move", "gone", "Not Found", status: 404)

    result = PokeapiImporter.new(delay: 0).import("move")

    assert_equal [ 0, [ "gone" ] ], [ result.imported, result.failed ]
    assert_equal 0, PokeapiRecord.of("move").count
  end

  test "pauses after every request that reaches the network, including failures" do
    stub_list("type", [ [ "fire", 10 ], [ "water", 11 ], [ "grass", 12 ] ])
    stub_detail("type", "fire", { id: 10, name: "fire" })
    stub_request(:get, "#{BASE}/type/water/").to_return(status: 500)
    stub_detail("type", "grass", { id: 12, name: "grass" })
    PokeapiClient.detail("type", "grass") # already cached → no pause

    importer = PokeapiImporter.new(delay: 0.01)
    pauses = 0
    importer.define_singleton_method(:sleep) { |_| pauses += 1 }
    result = importer.import("type")

    assert_equal %w[water], result.failed
    assert_equal 2, pauses # fire (fetched) + water (failed); grass came from cache
  end
end
