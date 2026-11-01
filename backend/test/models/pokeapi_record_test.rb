require "test_helper"

class PokeapiRecordTest < ActiveSupport::TestCase
  test "plural paths map to PokeAPI resource names" do
    assert_equal "move", PokeapiRecord.resource_for_path("moves")
    assert_equal "ability", PokeapiRecord.resource_for_path("abilities")
    assert_equal "pokemon", PokeapiRecord.resource_for_path("pokemon")
    assert_equal "pokemon-species", PokeapiRecord.resource_for_path("pokemon-species")
    assert_equal "pokedex", PokeapiRecord.resource_for_path("pokedexes")
    assert_nil PokeapiRecord.resource_for_path("move")
  end

  test "every resource has a distinct plural path" do
    assert_equal PokeapiRecord::RESOURCES.size, PokeapiRecord::PATHS.size
  end

  test "normalize accepts either form" do
    assert_equal "item", PokeapiRecord.normalize("items")
    assert_equal "item", PokeapiRecord.normalize("item")
    assert_nil PokeapiRecord.normalize("nope")
  end

  test "lookup finds by id or case-insensitive name; duplicate names resolve to the lowest id" do
    add_record("item", 2160, "roseli-berry")
    add_record("item", 723, "roseli-berry")

    assert_equal 723, PokeapiRecord.lookup("item", "Roseli-Berry").pokeapi_id
    assert_equal 2160, PokeapiRecord.lookup("item", "2160").pokeapi_id
    assert_nil PokeapiRecord.lookup("item", "missing")
    assert_nil PokeapiRecord.lookup("move", "723")
  end

  test "validates the resource name" do
    record = PokeapiRecord.new(resource: "digimon", name: "agumon", pokeapi_id: 1, body: "{}")
    assert_not record.valid?
    assert_includes record.errors.attribute_names, :resource
  end
end
