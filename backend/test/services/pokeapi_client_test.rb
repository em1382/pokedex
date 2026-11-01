require "test_helper"

class PokeapiClientTest < ActiveSupport::TestCase
  BASE = PokeapiClient::BASE_URL

  setup { Rails.cache.clear }

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

  test "404s are returned and cached (briefly), not raised" do
    stub = stub_request(:get, "#{BASE}/move/nope/").to_return(status: 404, body: "Not Found")

    2.times { assert_equal 404, PokeapiClient.detail("move", "nope").status }

    assert_requested stub, times: 1
    assert_not PokeapiClient.detail("move", "nope").ok?
  end

  test "other statuses raise and are not cached" do
    stub = stub_request(:get, "#{BASE}/type/fire/").to_return({ status: 503 }, { status: 200, body: "{}" })

    error = assert_raises(PokeapiClient::UpstreamError) { PokeapiClient.detail("type", "fire") }
    assert_match "503", error.message
    assert_predicate PokeapiClient.detail("type", "fire"), :ok?
    assert_requested stub, times: 2
  end

  test "network failures become UpstreamError" do
    stub_request(:get, "#{BASE}/type/water/").to_timeout
    error = assert_raises(PokeapiClient::UpstreamError) { PokeapiClient.detail("type", "water") }
    assert_match "pokeapi.co unreachable", error.message

    stub_request(:get, "#{BASE}/type/grass/").to_raise(SocketError.new("getaddrinfo failed"))
    assert_raises(PokeapiClient::UpstreamError) { PokeapiClient.detail("type", "grass") }
  end

  test "binary returns content type and bytes, nil on 404, raises otherwise" do
    url = "#{PokeapiSprite::UPSTREAM_PREFIX}pokemon/1.png"
    stub_request(:get, url).to_return(
      { status: 200, body: "\x89PNG".b, headers: { "Content-Type" => "image/png" } },
      { status: 200, body: "GIF8".b }, # no content type → assume PNG
      { status: 404 },
      { status: 500 }
    )

    assert_equal ["image/png", "\x89PNG".b], PokeapiClient.binary(url)
    assert_equal "image/png", PokeapiClient.binary(url).first
    assert_nil PokeapiClient.binary(url)
    assert_raises(PokeapiClient::UpstreamError) { PokeapiClient.binary(url) }
  end
end
