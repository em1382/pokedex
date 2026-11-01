# Builds a SQLite JSON expression that returns a trimmed copy of each stored
# record, so bulk responses don't ship megabytes of unused data (a full Pokémon
# record is ~250 KB, mostly its move list).
#
#   fields: dotted JSON paths to keep, nested structure preserved
#           ("sprites.front_default" -> {"sprites": {"front_default": ...}})
#   counts: top-level arrays to replace with their length, emitted as "<name>_count"
class PokeapiProjection
  PATH_FORMAT = /\A[a-z0-9_]+(\.[a-z0-9_]+)*\z/
  MAX_PATHS = 64

  class Invalid < StandardError; end

  attr_reader :fields, :counts

  def initialize(fields: nil, counts: nil)
    @fields = parse(fields, "fields")
    @counts = parse(counts, "counts")
    raise Invalid, "counts must be top-level keys" if @counts.any? { |c| c.include?(".") }
  end

  def full? = fields.empty? && counts.empty?

  # [sql_fragment, binds]
  def to_sql
    return ["body", []] if full?

    binds = []
    parts = node_sql(tree, [], binds)
    counts.each do |key|
      parts << "?, json_array_length(body, ?)"
      binds.push("#{key}_count", "$.#{key}")
    end
    ["json_object(#{parts.join(', ')})", binds]
  end

  private

  def parse(value, name)
    list = Array(value).flat_map { |v| v.to_s.split(",") }.map(&:strip).reject(&:empty?).uniq
    raise Invalid, "too many #{name}" if list.size > MAX_PATHS
    bad = list.grep_v(PATH_FORMAT)
    raise Invalid, "invalid #{name}: #{bad.join(', ')}" if bad.any?

    list
  end

  # {"id" => true, "sprites" => {"front_default" => true}}; a whole key wins over sub-paths.
  def tree
    fields.each_with_object({}) do |path, root|
      *parents, leaf = path.split(".")
      node = parents.reduce(root) do |n, key|
        break nil if n[key] == true

        n[key] = {} unless n[key].is_a?(Hash)
        n[key]
      end
      node[leaf] = true if node
    end
  end

  def node_sql(node, prefix, binds)
    node.map do |key, child|
      path = prefix + [key]
      binds << key
      if child == true
        # `->` keeps JSON types (true stays true, not 1); missing keys become null.
        binds << "$.#{path.join('.')}"
        "?, body -> ?"
      else
        "?, json_object(#{node_sql(child, path, binds).join(', ')})"
      end
    end
  end
end
