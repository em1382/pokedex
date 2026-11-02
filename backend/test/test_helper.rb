# Coverage: COVERAGE=1 bin/rails test (HTML report in coverage/).
if ENV["COVERAGE"]
  require "simplecov"
  SimpleCov.start "rails" do
    enable_coverage :branch
    add_filter %w[/bin/ /db/ /test/ /config/]
  end
end

ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
require "webmock/minitest"

module ActiveSupport
  class TestCase
    parallelize(workers: :number_of_processors)

    # Each parallel worker records its own coverage; SimpleCov merges them.
    if ENV["COVERAGE"]
      parallelize_setup { |worker| SimpleCov.command_name "#{SimpleCov.command_name}-#{worker}" }
      parallelize_teardown { SimpleCov.result }
    end

    # Nothing in the test suite may reach the network, and retry backoff doesn't really wait.
    setup do
      WebMock.disable_net_connect!
      @real_sleeper = PokeapiClient.sleeper
      PokeapiClient.sleeper = ->(_seconds) {}
    end
    teardown { PokeapiClient.sleeper = @real_sleeper }

    def add_record(resource, id, name, doc = {})
      PokeapiRecord.create!(resource: resource, pokeapi_id: id, name: name,
                            body: { id: id, name: name }.merge(doc).to_json)
    end
  end
end
