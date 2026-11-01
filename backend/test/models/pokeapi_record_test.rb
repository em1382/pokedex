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
end
