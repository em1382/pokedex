require "test_helper"

class PokeapiControllerTest < ActionDispatch::IntegrationTest
  setup do
    add_record("pokemon", 25, "pikachu", is_default: true, height: 4,
               sprites: { front_default: "a.png", back_default: "b.png" },
               moves: [{ move: { name: "thunder" } }, { move: { name: "tackle" } }])
    add_record("pokemon", 1, "bulbasaur", is_default: true, height: 7, sprites: { front_default: nil }, moves: [])
    add_record("pokemon", 10_001, "deoxys-attack", is_default: false, height: 17, moves: [])
  end

  test "list mimics PokeAPI's paginated shape, ordered by id" do
    get "/api/pokemon", params: { limit: 2, offset: 0 }

    assert_response :ok
    json = response.parsed_body
    assert_equal 3, json["count"]
    assert_equal %w[bulbasaur pikachu], json["results"].pluck("name")
    assert_equal "http://www.example.com/api/pokemon/1/", json["results"].first["url"]
    assert_equal "http://www.example.com/api/pokemon?offset=2&limit=2", json["next"]
    assert_nil json["previous"]
  end

  test "detail returns the stored document verbatim, by name or id" do
    get "/api/pokemon/pikachu"
    assert_response :ok
    assert_equal PokeapiRecord.lookup("pokemon", "25").body, response.body

    get "/api/pokemon/25"
    assert_equal "pikachu", response.parsed_body["name"]

    get "/api/pokemon/PIKACHU"
    assert_response :ok
  end

  test "all returns every full record in id order" do
    get "/api/pokemon/all"

    assert_response :ok
    assert_equal [1, 25, 10_001], response.parsed_body.pluck("id")
    assert_equal 2, response.parsed_body.second["moves"].size
  end

  test "all projects fields (nested, typed) and counts" do
    get "/api/pokemon/all", params: { fields: "id,is_default,sprites.front_default,missing", counts: "moves" }

    assert_response :ok
    pikachu = response.parsed_body.second
    assert_equal({ "id" => 25, "is_default" => true, "sprites" => { "front_default" => "a.png" },
                   "missing" => nil, "moves_count" => 2 }, pikachu)
    assert_equal false, response.parsed_body.third["is_default"]
  end

  test "invalid projection is rejected" do
    get "/api/pokemon/all", params: { fields: "id,name'); DROP TABLE pokeapi_records;--" }
    assert_response :bad_request
    get "/api/pokemon/all", params: { counts: "sprites.front_default" }
    assert_response :bad_request
  end

  test "collection paths are plural; singular paths are 404 with a hint" do
    add_record("move", 1, "pound")

    get "/api/moves/all"
    assert_response :ok
    assert_equal ["pound"], response.parsed_body.pluck("name")

    get "/api/moves"
    assert_equal "http://www.example.com/api/moves/1/", response.parsed_body["results"].first["url"]

    get "/api/move/all"
    assert_response :not_found
    assert_match "use /api/moves", response.parsed_body["error"]

    get "/api/pokemons"
    assert_response :not_found
  end

  test "unknown resource, missing record and un-imported resource are 404" do
    get "/api/not-a-thing"
    assert_response :not_found

    get "/api/pokemon/missingno"
    assert_response :not_found

    get "/api/berries/all"
    assert_response :not_found
    assert_match "pokeapi:import RESOURCES=berries", response.parsed_body["error"]
  end

  test "bad pagination params are rejected" do
    get "/api/pokemon", params: { limit: "abc" }
    assert_response :bad_request
    get "/api/pokemon", params: { offset: -1 }
    assert_response :bad_request
  end

  test "list pages link back and forward" do
    get "/api/pokemon", params: { limit: 1, offset: 1 }

    json = response.parsed_body
    assert_equal ["pikachu"], json["results"].pluck("name")
    assert_equal "http://www.example.com/api/pokemon?offset=0&limit=1", json["previous"]
    assert_equal "http://www.example.com/api/pokemon?offset=2&limit=1", json["next"]

    get "/api/pokemon", params: { limit: 2, offset: 2 }
    assert_nil response.parsed_body["next"]
  end

  test "list defaults to 20 and caps the limit" do
    get "/api/pokemon"
    assert_equal 3, response.parsed_body["results"].size

    get "/api/pokemon", params: { limit: 100_001 }
    assert_response :bad_request
  end

  test "an un-imported resource's list is a 404 with the import hint" do
    get "/api/types"
    assert_response :not_found
    assert_match "pokeapi:import RESOURCES=types", response.parsed_body["error"]
  end

  test "responses are publicly cacheable JSON" do
    get "/api/pokemon/all"
    assert_equal "application/json", response.media_type
    assert_match "public", response.headers["Cache-Control"]
  end

  test "limit must be at least 1 (0 would make next point at the same page forever)" do
    get "/api/pokemon", params: { limit: 0 }
    assert_response :bad_request
    assert_match "between 1 and", response.parsed_body["error"]
  end

  test "all streams every record across several batches, in id order" do
    now = Time.current
    rows = (1..(PokeapiController::STREAM_BATCH * 2 + 5)).map do |id|
      { resource: "move", name: "m#{id}", pokeapi_id: id, body: { id: id }.to_json, created_at: now, updated_at: now }
    end
    PokeapiRecord.insert_all(rows)

    get "/api/moves/all"

    assert_response :ok
    assert_equal (1..rows.size).to_a, response.parsed_body.pluck("id")
    assert_equal now.httpdate, response.headers["Last-Modified"]
    assert_nil response.headers["ETag"]
  end

  test "all can reduce localized arrays to their first English entry" do
    en = { name: "en", url: "" }
    fr = { name: "fr", url: "" }
    add_record("move", 1, "pound", flavor_text_entries: [
      { text: "Écras'Face", language: fr }, { text: "Pound!", language: en }, { text: "Pound again", language: en }
    ])
    add_record("move", 2, "untranslated", flavor_text_entries: [{ text: "Écras'Face", language: fr }])

    get "/api/moves/all", params: { fields: "id,flavor_text_entries", english: "flavor_text_entries" }

    assert_response :ok
    assert_equal [
      { "id" => 1, "flavor_text_entries" => [{ "text" => "Pound!", "language" => { "name" => "en", "url" => "" } }] },
      { "id" => 2, "flavor_text_entries" => [] }
    ], response.parsed_body
  end

  test "rejects projections whose keys would clash" do
    get "/api/pokemon/all", params: { fields: "id,moves_count", counts: "moves" }
    assert_response :bad_request
    assert_match "clash", response.parsed_body["error"]
  end
end
