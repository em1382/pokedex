require "test_helper"
require "rake"

class PokeapiRakeTest < ActiveSupport::TestCase
  BASE = PokeapiClient::BASE_URL

  # VACUUM INTO can't run inside the per-test transaction; clean up by hand instead.
  self.use_transactional_tests = false

  setup do
    Rails.application.load_tasks if Rake::Task.tasks.none? { _1.name == "pokeapi:import" }
    Rails.cache.clear
  end

  teardown do
    PokeapiRecord.delete_all
    PokeapiSprite.delete_all
  end

  # Runs a task with ENV overrides; returns [stdout+stderr, SystemExit or nil].
  def run_task(name, env = {})
    Rake::Task[name].reenable
    saved = env.keys.to_h { [_1, ENV[_1]] }
    env.each { |k, v| ENV[k] = v }
    exit = nil
    output = capture_io do
      Rake::Task[name].invoke
    rescue SystemExit => e
      exit = e
    end.join
    [output, exit]
  ensure
    saved.each { |k, v| ENV[k] = v }
  end

  def stub_types(fire_status:)
    stub_request(:get, "#{BASE}/type/?limit=100000")
      .to_return(status: 200, body: { results: [{ name: "fire", url: "#{BASE}/type/10/" }] }.to_json)
    stub_request(:get, "#{BASE}/type/fire/").to_return(status: fire_status, body: { id: 10, name: "fire" }.to_json)
  end

  test "import loads records and reports them" do
    stub_types(fire_status: 200)

    output, exit = run_task("pokeapi:import", "RESOURCES" => "types", "DELAY" => "0")

    assert_nil exit
    assert_match "type: 1 total, 1 imported", output
    assert_equal 1, PokeapiRecord.of("type").count
  end

  test "STRICT=1 fails the import when records fail" do
    stub_types(fire_status: 404)

    _, exit = run_task("pokeapi:import", "RESOURCES" => "types", "DELAY" => "0", "STRICT" => "1")
    assert exit, "expected abort"
    assert_not exit.success?

    _, exit = run_task("pokeapi:import", "RESOURCES" => "types", "DELAY" => "0")
    assert_nil exit, "without STRICT a partial import still succeeds"
  end

  test "export writes one self-contained database file" do
    add_record("type", 10, "fire")
    file = Rails.root.join("tmp", "export-test-#{Process.pid}.sqlite3").to_s
    FileUtils.rm_f(file)

    output, exit = run_task("pokeapi:export", "FILE" => file)

    assert_nil exit
    assert_match "Wrote #{file}", output
    copy = SQLite3::Database.new(file)
    assert_equal [["fire"]], copy.execute("SELECT name FROM pokeapi_records")
    assert_not File.exist?("#{file}-wal")
  ensure
    copy&.close
    FileUtils.rm_f(file) if file
  end

  test "export refuses to overwrite and needs FILE" do
    _, exit = run_task("pokeapi:export", "FILE" => "")
    assert exit

    existing = Rails.root.join("tmp", "exists-#{Process.pid}.sqlite3").to_s
    File.write(existing, "x")
    _, exit = run_task("pokeapi:export", "FILE" => existing)
    assert exit
    assert_equal "x", File.read(existing)
  ensure
    FileUtils.rm_f(existing) if existing
  end

  test "import reports sprites, and STRICT=1 fails on sprite errors (not on ones missing upstream)" do
    sprites = %w[items/a.png items/b.png items/c.png].map { PokeapiSprite::UPSTREAM_PREFIX + _1 }
    results = %w[a b c].each_with_index.map { |n, i| { name: n, url: "#{BASE}/item/#{i + 1}/" } }
    stub_request(:get, "#{BASE}/item/?limit=100000").to_return(status: 200, body: { results: results }.to_json)
    %w[a b c].each_with_index do |n, i|
      stub_request(:get, "#{BASE}/item/#{n}/")
        .to_return(status: 200, body: { id: i + 1, name: n, sprites: { default: sprites[i] } }.to_json)
    end
    stub_request(:get, sprites[0]).to_return(status: 200, body: "PNG", headers: { "Content-Type" => "image/png" })
    stub_request(:get, sprites[1]).to_return(status: 404)
    stub_request(:get, sprites[2]).to_return(status: 500)

    output, exit = run_task("pokeapi:import", "RESOURCES" => "items", "DELAY" => "0", "STRICT" => "1")

    assert_match "item sprites: 1 downloaded, 0 from cache, 1 missing upstream, 1 failed", output
    assert exit, "a failed sprite download fails a STRICT import"
  end

  test "SPRITES=0 skips images" do
    stub_request(:get, "#{BASE}/item/?limit=100000").to_return(status: 200, body: { results: [] }.to_json)

    output, exit = run_task("pokeapi:import", "RESOURCES" => "items", "DELAY" => "0", "SPRITES" => "0")

    assert_nil exit
    assert_no_match "sprites:", output
  end

  test "import rejects unknown resource names" do
    _, exit = run_task("pokeapi:import", "RESOURCES" => "digimon")
    assert exit
  end

  test "status lists counts, or explains how to import" do
    output, = run_task("pokeapi:status")
    assert_match "No data imported yet", output

    add_record("type", 10, "fire")
    output, = run_task("pokeapi:status")
    assert_match(/type\s+1/, output)
    assert_match(/\(sprites\)\s+0/, output)
  end

  test "a clean sprite import reports no failures and passes STRICT" do
    sprite = "#{PokeapiSprite::UPSTREAM_PREFIX}items/a.png"
    stub_request(:get, "#{BASE}/item/?limit=100000")
      .to_return(status: 200, body: { results: [{ name: "a", url: "#{BASE}/item/1/" }] }.to_json)
    stub_request(:get, "#{BASE}/item/a/").to_return(status: 200, body: { id: 1, name: "a", sprites: { default: sprite } }.to_json)
    stub_request(:get, sprite).to_return(status: 200, body: "PNG", headers: { "Content-Type" => "image/png" })

    output, exit = run_task("pokeapi:import", "RESOURCES" => "items", "DELAY" => "0", "STRICT" => "1")

    assert_nil exit
    assert_match(/item sprites: 1 downloaded, 0 from cache, 0 missing upstream$/, output)
  end
end
