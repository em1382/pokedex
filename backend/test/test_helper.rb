ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
require "webmock/minitest"

module ActiveSupport
  class TestCase
    parallelize(workers: :number_of_processors)

    # Nothing in the test suite may reach the network.
    setup { WebMock.disable_net_connect! }

    def add_record(resource, id, name, doc = {})
      PokeapiRecord.create!(resource: resource, pokeapi_id: id, name: name,
                            body: { id: id, name: name }.merge(doc).to_json)
    end
  end
end
