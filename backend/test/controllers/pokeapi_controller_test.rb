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
end
