require "test_helper"

class SpritesControllerTest < ActionDispatch::IntegrationTest
  test "serves stored sprite bytes" do
    PokeapiSprite.create!(path: "pokemon/25.png", content_type: "image/png", data: "\x89PNG".b)

    get "/sprites/pokemon/25.png"

    assert_response :ok
    assert_equal "image/png", response.media_type
    assert_equal "\x89PNG".b, response.body.b
  end

  test "unknown sprite is 404" do
    get "/sprites/pokemon/0.png"
    assert_response :not_found
  end
end
