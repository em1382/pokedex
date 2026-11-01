# "Pokémon" is its own plural: /api/pokemon, not /api/pokemons.
ActiveSupport::Inflector.inflections(:en) do |inflect|
  inflect.uncountable "pokemon"
end
