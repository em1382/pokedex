require "test_helper"

class PokeapiClientTest < ActiveSupport::TestCase
  BASE = PokeapiClient::BASE_URL
  SPRITE = "#{PokeapiSprite::UPSTREAM_PREFIX}pokemon/1.png".freeze

  setup do
    Rails.cache.clear
    @sleeps = []
    PokeapiClient.sleeper = ->(seconds) { @sleeps << seconds } # restored by test_helper
  end

  test "list asks for every record in one page" do
    stub = stub_request(:get, "#{BASE}/move/?limit=100000").to_return(status: 200, body: "{}")
    PokeapiClient.list("move")
    assert_requested stub
  end

  test "detail lowercases names and accepts ids" do
    by_name = stub_request(:get, "#{BASE}/pokemon/pikachu/").to_return(status: 200, body: "{}")
    by_id = stub_request(:get, "#{BASE}/pokemon/25/").to_return(status: 200, body: "{}")

    PokeapiClient.detail("pokemon", "Pikachu")
    PokeapiClient.detail("pokemon", 25)

    assert_requested by_name
    assert_requested by_id
  end

  test "responses are cached and come back as UTF-8, sending a User-Agent" do
    stub = stub_request(:get, "#{BASE}/item/poke-ball/")
           .with(headers: { "User-Agent" => PokeapiClient::USER_AGENT })
           .to_return(status: 200, body: '{"name":"Pokémon"}'.b)

    first = PokeapiClient.detail("item", "poke-ball")
    second = PokeapiClient.detail("item", "poke-ball")

    assert_requested stub, times: 1
    assert_not first.cache_hit
    assert second.cache_hit
    assert_predicate second, :ok?
    assert_equal Encoding::UTF_8, first.body.encoding
    assert_equal Encoding::UTF_8, second.body.encoding
    assert_equal "Pokémon", JSON.parse(second.body)["name"]
  end

  test "404s are returned and cached (briefly), not raised or retried" do
    stub = stub_request(:get, "#{BASE}/move/nope/").to_return(status: 404, body: "Not Found")

    2.times { assert_equal 404, PokeapiClient.detail("move", "nope").status }

    assert_requested stub, times: 1
    assert_empty @sleeps
    assert_not PokeapiClient.detail("move", "nope").ok?
  end

  test "rate limiting and server errors are retried with exponential backoff" do
    stub = stub_request(:get, "#{BASE}/type/fire/")
           .to_return({ status: 429 }, { status: 503 }, { status: 200, body: "{}" })

    assert_predicate PokeapiClient.detail("type", "fire"), :ok?
    assert_requested stub, times: 3
    assert_equal [1, 2], @sleeps
  end

  test "Retry-After is honoured, capped at a minute" do
    stub_request(:get, "#{BASE}/type/ice/").to_return(
      { status: 429, headers: { "Retry-After" => "7" } },
      { status: 429, headers: { "Retry-After" => "3600" } },
      { status: 429, headers: { "Retry-After" => "Wed, 21 Oct 2026 07:28:00 GMT" } }, # date form → default backoff
      { status: 200, body: "{}" }
    )

    PokeapiClient.detail("type", "ice")

    assert_equal [7, 60, 4], @sleeps
  end

  test "gives up after the last attempt, without caching the failure" do
    stub = stub_request(:get, "#{BASE}/type/rock/").to_return(status: 503)

    error = assert_raises(PokeapiClient::UpstreamError) { PokeapiClient.detail("type", "rock") }
    assert_match "503", error.message
    assert_requested stub, times: PokeapiClient::MAX_ATTEMPTS
    assert_equal [1, 2, 4], @sleeps

    stub_request(:get, "#{BASE}/type/rock/").to_return(status: 200, body: "{}")
    assert_predicate PokeapiClient.detail("type", "rock"), :ok?
  end

  test "other client errors are not retried" do
    stub = stub_request(:get, "#{BASE}/type/dark/").to_return(status: 403)

    assert_raises(PokeapiClient::UpstreamError) { PokeapiClient.detail("type", "dark") }
    assert_requested stub, times: 1
    assert_empty @sleeps
  end

  test "network failures are retried, then become UpstreamError" do
    flaky = stub_request(:get, "#{BASE}/type/water/").to_timeout.then.to_return(status: 200, body: "{}")
    assert_predicate PokeapiClient.detail("type", "water"), :ok?
    assert_requested flaky, times: 2

    stub_request(:get, "#{BASE}/type/grass/").to_raise(SocketError.new("getaddrinfo failed"))
    error = assert_raises(PokeapiClient::UpstreamError) { PokeapiClient.detail("type", "grass") }
    assert_match "pokeapi.co unreachable", error.message
  end

  test "image returns content type and bytes, and is cached" do
    stub = stub_request(:get, SPRITE).to_return(status: 200, body: "\x89PNG".b, headers: { "Content-Type" => "image/png" })

    first = PokeapiClient.image(SPRITE)
    second = PokeapiClient.image(SPRITE)

    assert_requested stub, times: 1
    assert_equal ["image/png", "\x89PNG".b, false], [first.content_type, first.data, first.cache_hit]
    assert_equal ["image/png", "\x89PNG".b, true], [second.content_type, second.data, second.cache_hit]
    assert_equal Encoding::BINARY, second.data.encoding
  end

  test "image without a content type is assumed to be PNG" do
    stub_request(:get, SPRITE).to_return(status: 200, body: "PNG")
    assert_equal "image/png", PokeapiClient.image(SPRITE).content_type
  end

  test "image 404 means not found (cached), errors raise" do
    stub_request(:get, SPRITE).to_return(status: 404)
    assert_not PokeapiClient.image(SPRITE).found?
    assert PokeapiClient.image(SPRITE).cache_hit

    other = "#{PokeapiSprite::UPSTREAM_PREFIX}pokemon/2.png"
    stub_request(:get, other).to_return(status: 500)
    assert_raises(PokeapiClient::UpstreamError) { PokeapiClient.image(other) }
  end

  test "image refuses non-image responses and doesn't cache them" do
    stub = stub_request(:get, SPRITE).to_return(status: 200, body: "<html>", headers: { "Content-Type" => "text/html" })

    error = assert_raises(PokeapiClient::UpstreamError) { PokeapiClient.image(SPRITE) }
    assert_match "not an image", error.message
    assert_raises(PokeapiClient::UpstreamError) { PokeapiClient.image(SPRITE) }
    assert_requested stub, times: 2
  end

  test "the default sleeper really waits" do
    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    @real_sleeper.call(0.02)
    assert_operator Process.clock_gettime(Process::CLOCK_MONOTONIC) - started, :>=, 0.02
  end
end
