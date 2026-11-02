# Serves imported PokeAPI data from SQLite. Never touches the network, so it
# works offline; data gets in via `bin/rails pokeapi:import`.
class PokeapiController < ApplicationController
  MAX_LIMIT = 100_000
  # Records per query while streaming /all (a full Pokémon record is ~250 KB).
  STREAM_BATCH = 100

  class BadRequest < StandardError; end

  before_action :check_resource!

  rescue_from BadRequest, PokeapiProjection::Invalid do |e|
    render json: { error: e.message }, status: :bad_request
  end

  # GET /api/:resources?limit=&offset=  (same shape as PokeAPI's list endpoint)
  def index
    limit = int_param(:limit, default: 20, min: 1, max: MAX_LIMIT)
    offset = int_param(:offset, default: 0, min: 0)
    scope = records.order(:pokeapi_id)
    count = scope.count
    return not_imported if count.zero?

    results = scope.offset(offset).limit(limit).pluck(:name, :pokeapi_id).map do |name, id|
      { name: name, url: record_url(id) }
    end
    render json: {
      count: count,
      next: offset + limit < count ? page_url(offset + limit, limit) : nil,
      previous: offset.positive? ? page_url([ offset - limit, 0 ].max, limit) : nil,
      results: results
    }
  end

  # GET /api/:resources/all?fields=a,b.c&counts=moves&english=flavor_text_entries
  # Every record in one JSON array (ordered by id), optionally trimmed. Streamed
  # in batches, so memory stays flat even for untrimmed Pokémon (~170 MB).
  def all
    projection = PokeapiProjection.new(fields: params[:fields], counts: params[:counts], english: params[:english])
    imported_at = records.maximum(:updated_at)
    return not_imported unless imported_at

    expires_in 1.hour, public: true
    # Also stops Rack::ETag from buffering the whole body to hash it.
    response.headers["Last-Modified"] = imported_at.httpdate
    response.headers["Content-Type"] = "application/json"
    self.response_body = stream_json_array(projection)
  end

  # GET /api/:resources/:id_or_name  (verbatim PokeAPI record)
  def show
    record = PokeapiRecord.lookup(resource, params[:id])
    return render(json: { error: "#{path}/#{params[:id]} not found" }, status: :not_found) unless record

    expires_in 1.hour, public: true
    render body: record.body, content_type: "application/json"
  end

  private

  # Plural path segment from the URL ("moves") and the PokeAPI resource it names ("move").
  def path = params[:resources]

  def resource = PokeapiRecord.resource_for_path(path)

  def records = PokeapiRecord.of(resource)

  def check_resource!
    return if resource

    hint = PokeapiRecord.resource?(path) ? " (use /api/#{PokeapiRecord.path_for(path)})" : ""
    render json: { error: "unknown resource #{path.inspect}#{hint}" }, status: :not_found
  end

  def not_imported
    render json: {
      error: "No #{path} data imported. Run: bin/rails pokeapi:import RESOURCES=#{path}"
    }, status: :not_found
  end

  # "[" doc, doc, … "]", reading STREAM_BATCH records at a time by id (keyset paging).
  def stream_json_array(projection)
    expr, binds = projection.to_sql
    resource = self.resource
    Enumerator.new do |out|
      out << "["
      last_id = nil
      loop do
        rows = ActiveRecord::Base.with_connection do |db|
          db.select_rows(ActiveRecord::Base.sanitize_sql_array([
            "SELECT pokeapi_id, #{expr} FROM pokeapi_records " \
            "WHERE resource = ? AND pokeapi_id > ? ORDER BY pokeapi_id LIMIT ?",
            *binds, resource, last_id || -1, STREAM_BATCH
          ]))
        end
        break if rows.empty?

        rows.each do |id, doc|
          out << (last_id ? ",#{doc}" : doc)
          last_id = id
        end
      end
      out << "]"
    end
  end

  def int_param(name, default:, min:, max: nil)
    return default if params[name].blank?

    value = Integer(params[name].to_s, 10)
    raise ArgumentError if value < min || (max && value > max)

    value
  rescue ArgumentError
    raise BadRequest, "#{name} must be an integer between #{min} and #{max || 'infinity'}"
  end

  def record_url(id) = "#{request.base_url}/api/#{path}/#{id}/"

  def page_url(offset, limit) = "#{request.base_url}/api/#{path}?offset=#{offset}&limit=#{limit}"
end
