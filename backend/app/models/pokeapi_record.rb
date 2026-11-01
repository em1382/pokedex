# A PokeAPI v2 resource record, imported verbatim (see PokeapiImporter).
class PokeapiRecord < ApplicationRecord
  # Every PokeAPI v2 endpoint. Anything else is rejected by the API.
  RESOURCES = %w[
    ability berry berry-firmness berry-flavor characteristic contest-effect
    contest-type egg-group encounter-condition encounter-condition-value
    encounter-method evolution-chain evolution-trigger gender generation
    growth-rate item item-attribute item-category item-fling-effect item-pocket
    language location location-area machine move move-ailment move-battle-style
    move-category move-damage-class move-learn-method move-target nature
    pal-park-area pokeathlon-stat pokedex pokemon pokemon-color pokemon-form
    pokemon-habitat pokemon-shape pokemon-species region stat
    super-contest-effect type version version-group
  ].to_set.freeze

  # API paths are plural ("moves", "abilities"; "pokemon" stays "pokemon").
  PATHS = RESOURCES.index_by(&:pluralize).freeze

  validates :resource, inclusion: { in: RESOURCES }
  validates :name, :pokeapi_id, :body, presence: true

  scope :of, ->(resource) { where(resource: resource) }

  def self.resource?(resource) = RESOURCES.include?(resource.to_s)

  # PokeAPI resource name for a plural API path segment, or nil.
  def self.resource_for_path(path) = PATHS[path.to_s]

  def self.path_for(resource) = resource.to_s.pluralize

  # Accepts either form (for the import task): "move" or "moves" -> "move".
  def self.normalize(name)
    name = name.to_s
    resource?(name) ? name : resource_for_path(name)
  end

  # PokeAPI accepts either the numeric id or the name.
  def self.lookup(resource, key)
    key = key.to_s
    if key.match?(/\A\d+\z/)
      of(resource).find_by(pokeapi_id: key.to_i)
    else
      of(resource).where(name: key.downcase).order(:pokeapi_id).first
    end
  end
end
