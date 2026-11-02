# Serves sprite images imported into SQLite (offline replacement for
# raw.githubusercontent.com/PokeAPI/sprites/master/sprites/<path>).
class SpritesController < ApplicationController
  def show
    sprite = PokeapiSprite.find_by(path: params[:path])
    return head :not_found unless sprite

    expires_in 1.year, public: true
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Only ever serve images under an image type (the importer also only stores images).
    type = sprite.content_type.start_with?("image/") ? sprite.content_type : "application/octet-stream"
    send_data sprite.data, type: type, disposition: "inline"
  end
end
