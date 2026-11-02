# Coverage: COVERAGE=1 bin/rails test (HTML report in coverage/). The run fails
# if line or branch coverage drops below 100%.
if ENV["COVERAGE"]
  require "simplecov"
  SimpleCov.start "rails" do
    enable_coverage :branch
    add_filter %w[/bin/ /db/ /test/ /config/]
    minimum_coverage line: 100, branch: 100
  end
end

ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
require "webmock/minitest"

module ActiveSupport
  class TestCase
    # A coverage run stays in one process: SimpleCov won't report merged
    # results from forked workers (and the suite only takes a second or two).
    parallelize(workers: ENV["COVERAGE"] ? 1 : :number_of_processors)

    # Nothing in the test suite may reach the network, and retry backoff doesn't really wait.
    setup do
      WebMock.disable_net_connect!
      @real_sleeper = PokeapiClient.sleeper
      PokeapiClient.sleeper = ->(_seconds) { }
    end
    teardown { PokeapiClient.sleeper = @real_sleeper }

    def add_record(resource, id, name, doc = {})
      PokeapiRecord.create!(resource: resource, pokeapi_id: id, name: name,
                            body: { id: id, name: name }.merge(doc).to_json)
    end
  end
end
