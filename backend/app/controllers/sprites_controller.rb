# Serves sprite images imported into SQLite (offline replacement for
# raw.githubusercontent.com/PokeAPI/sprites/master/sprites/<path>).
class SpritesController < ApplicationController
  def show
    sprite = PokeapiSprite.find_by(path: params[:path])
    return head :not_found unless sprite

    expires_in 1.year, public: true
    send_data sprite.data, type: sprite.content_type, disposition: "inline"
  end
end
