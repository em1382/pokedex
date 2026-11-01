require "test_helper"

class PokeapiProjectionTest < ActiveSupport::TestCase
  test "no fields means full body" do
    assert PokeapiProjection.new.full?
    assert_equal ["body", []], PokeapiProjection.new.to_sql
  end

  test "whole key wins over its sub-paths" do
    sql, binds = PokeapiProjection.new(fields: "sprites.front_default,sprites").to_sql
    assert_equal "json_object(?, body -> ?)", sql
    assert_equal ["sprites", "$.sprites"], binds
  end

  test "rejects unsafe paths" do
    assert_raises(PokeapiProjection::Invalid) { PokeapiProjection.new(fields: "a b") }
    assert_raises(PokeapiProjection::Invalid) { PokeapiProjection.new(fields: "$.a") }
  end
end
