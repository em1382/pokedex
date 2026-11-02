require "test_helper"

class PokeapiProjectionTest < ActiveSupport::TestCase
  test "no fields means full body" do
    assert PokeapiProjection.new.full?
    assert_equal [ "body", [] ], PokeapiProjection.new.to_sql
  end

  test "whole key wins over its sub-paths" do
    sql, binds = PokeapiProjection.new(fields: "sprites.front_default,sprites").to_sql
    assert_equal "json_object(?, body -> ?)", sql
    assert_equal [ "sprites", "$.sprites" ], binds
  end

  test "rejects unsafe paths" do
    assert_raises(PokeapiProjection::Invalid) { PokeapiProjection.new(fields: "a b") }
    assert_raises(PokeapiProjection::Invalid) { PokeapiProjection.new(fields: "$.a") }
  end

  test "sub-paths under one key nest into a single object" do
    sql, binds = PokeapiProjection.new(fields: "sprites.front_default,sprites.back_default").to_sql
    assert_equal "json_object(?, json_object(?, body -> ?, ?, body -> ?))", sql
    assert_equal [ "sprites", "front_default", "$.sprites.front_default", "back_default", "$.sprites.back_default" ], binds
  end

  test "a whole key listed first also wins over later sub-paths" do
    sql, binds = PokeapiProjection.new(fields: "sprites,sprites.front_default,sprites.other.home").to_sql
    assert_equal "json_object(?, body -> ?)", sql
    assert_equal [ "sprites", "$.sprites" ], binds
  end

  test "accepts arrays and comma lists, trimming blanks and duplicates" do
    projection = PokeapiProjection.new(fields: [ "id, name", "", "id" ], counts: "moves,")
    assert_equal %w[id name], projection.fields
    assert_equal %w[moves], projection.counts
  end

  test "counts alone produce just the counts" do
    sql, binds = PokeapiProjection.new(counts: "moves").to_sql
    assert_equal "json_object(?, json_array_length(body, ?))", sql
    assert_equal [ "moves_count", "$.moves" ], binds
  end

  test "limits the number of paths" do
    too_many = (1..PokeapiProjection::MAX_PATHS + 1).map { "f#{_1}" }
    assert_raises(PokeapiProjection::Invalid) { PokeapiProjection.new(fields: too_many) }
  end

  test "english reduces a top-level localized array to its first English entry" do
    sql, binds = PokeapiProjection.new(fields: "id,effect_entries", english: "effect_entries").to_sql
    assert_match "json_each(body, ?)", sql
    assert_match "value ->> '$.language.name' = ? ORDER BY key LIMIT 1", sql
    assert_equal [ "id", "$.id", "effect_entries", "$.effect_entries", "en" ], binds
  end

  test "english keys must be top-level fields that are also requested" do
    assert_raises(PokeapiProjection::Invalid) { PokeapiProjection.new(fields: "id", english: "effect_entries") }
    assert_raises(PokeapiProjection::Invalid) { PokeapiProjection.new(fields: "a.b", english: "a.b") }
  end

  test "a field named like a count clashes with that count" do
    error = assert_raises(PokeapiProjection::Invalid) { PokeapiProjection.new(fields: "moves_count", counts: "moves") }
    assert_match "moves_count", error.message
  end
end
