# Serves imported PokeAPI data from SQLite. Never touches the network, so it
# works offline; data gets in via `bin/rails pokeapi:import`.
class PokeapiController < ApplicationController
  MAX_LIMIT = 100_000

  before_action :check_resource!

  rescue_from PokeapiProjection::Invalid, ArgumentError do |e|
    render json: { error: e.message }, status: :bad_request
  end

  # GET /api/:resources?limit=&offset=  (same shape as PokeAPI's list endpoint)
  def index
    limit = int_param(:limit, default: 20, max: MAX_LIMIT)
    offset = int_param(:offset, default: 0)
    scope = records.order(:pokeapi_id)
    count = scope.count
    return not_imported if count.zero?

    results = scope.offset(offset).limit(limit).pluck(:name, :pokeapi_id).map do |name, id|
      { name: name, url: record_url(id) }
    end
    render json: {
      count: count,
      next: offset + limit < count ? page_url(offset + limit, limit) : nil,
      previous: offset.positive? ? page_url([offset - limit, 0].max, limit) : nil,
      results: results
    }
  end

  # GET /api/:resources/all?fields=a,b.c&counts=moves
  # Every record in one response (ordered by id), optionally trimmed.
  def all
    projection = PokeapiProjection.new(fields: params[:fields], counts: params[:counts])
    expr, binds = projection.to_sql
    sql = ActiveRecord::Base.sanitize_sql_array(
      ["SELECT #{expr} FROM pokeapi_records WHERE resource = ? ORDER BY pokeapi_id", *binds, resource]
    )
    docs = ActiveRecord::Base.connection.select_values(sql)
    return not_imported if docs.empty?

    render_json "[#{docs.join(',')}]"
  end

  # GET /api/:resources/:id_or_name  (verbatim PokeAPI record)
  def show
    record = PokeapiRecord.lookup(resource, params[:id])
    return render(json: { error: "#{resource}/#{params[:id]} not found" }, status: :not_found) unless record

    render_json record.body
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

  def render_json(body)
    expires_in 1.hour, public: true
    render body: body, content_type: "application/json"
  end

  def int_param(name, default:, max: nil)
    return default if params[name].blank?

    value = Integer(params[name].to_s, 10)
    raise ArgumentError, "#{name} must be between 0 and #{max || 'infinity'}" if value.negative? || (max && value > max)

    value
  end

  def record_url(id) = "#{request.base_url}/api/#{path}/#{id}/"

  def page_url(offset, limit) = "#{request.base_url}/api/#{path}?offset=#{offset}&limit=#{limit}"
end
