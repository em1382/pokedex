# Sprite image from github.com/PokeAPI/sprites, stored so the UI works offline.
class PokeapiSprite < ApplicationRecord
  # Upstream URL prefix; `path` is whatever follows it.
  UPSTREAM_PREFIX = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/".freeze

  validates :path, :content_type, :data, presence: true

  def self.path_for(url)
    url.to_s.delete_prefix(UPSTREAM_PREFIX) if url.to_s.start_with?(UPSTREAM_PREFIX)
  end
end
