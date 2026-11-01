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
    stub_list("item", [["potion", 17], ["roseli-berry", 723], ["roseli-berry", 2160]])
    stub_detail("item", "potion", { id: 17, name: "potion" })
    stub_detail("item", 723, { id: 723, name: "roseli-berry" })
    stub_detail("item", 2160, { id: 2160, name: "roseli-berry" })

    result = PokeapiImporter.new(delay: 0).import("item")

    assert_equal 3, result.imported
    assert_equal [17, 723, 2160], PokeapiRecord.of("item").order(:pokeapi_id).pluck(:pokeapi_id)
    assert_equal 723, PokeapiRecord.lookup("item", "roseli-berry").pokeapi_id
  end

  test "skips records already present and reuses the HTTP cache" do
    list = stub_list("type", [["fire", 10], ["water", 11]])
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
    stub_list("move", [["pound", 1], ["ghost-move", 9999]])
    stub_detail("move", "pound", { id: 1, name: "pound" })
    stub_detail("move", "ghost-move", "Not Found", status: 404)

    result = PokeapiImporter.new(delay: 0).import("move")

    assert_equal 1, result.imported
    assert_equal ["ghost-move"], result.failed
  end

  test "downloads sprites referenced by imported records once" do
    url = "#{PokeapiSprite::UPSTREAM_PREFIX}pokemon/25.png"
    add_record("pokemon", 25, "pikachu", sprites: { front_default: url })
    add_record("pokemon", 26, "raichu", sprites: { front_default: nil })
    png = stub_request(:get, url).to_return(status: 200, body: "PNG", headers: { "Content-Type" => "image/png" })

    importer = PokeapiImporter.new(delay: 0)
    assert_equal [1, 0], importer.import_sprites("pokemon")
    assert_equal [0, 0], importer.import_sprites("pokemon")

    assert_requested png, times: 1
    assert_equal "PNG", PokeapiSprite.find_by!(path: "pokemon/25.png").data
  end
end
