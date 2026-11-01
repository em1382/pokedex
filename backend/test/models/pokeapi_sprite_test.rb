require "test_helper"

class PokeapiSpriteTest < ActiveSupport::TestCase
  test "path_for strips the PokeAPI sprite prefix" do
    assert_equal "items/poke-ball.png", PokeapiSprite.path_for("#{PokeapiSprite::UPSTREAM_PREFIX}items/poke-ball.png")
  end

  test "path_for ignores other URLs and nil" do
    assert_nil PokeapiSprite.path_for("https://example.com/items/poke-ball.png")
    assert_nil PokeapiSprite.path_for(nil)
  end

  test "requires path, content type and data" do
    sprite = PokeapiSprite.new
    assert_not sprite.valid?
    assert_equal %i[content_type data path], sprite.errors.attribute_names.sort
  end
end
