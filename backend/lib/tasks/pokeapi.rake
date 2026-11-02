namespace :pokeapi do
  desc "Import PokeAPI data into SQLite. RESOURCES=pokemon,moves,... (default: the 5 grids), " \
       "SPRITES=0 to skip images, FORCE=1 to re-import existing records, DELAY=seconds between upstream " \
       "requests, STRICT=1 to fail if any record or sprite failed"
  task import: :environment do
    names = ENV.fetch("RESOURCES", "pokemon,moves,abilities,items,types").split(",").map(&:strip)
    resources = names.map { |n| PokeapiRecord.normalize(n) or abort("Unknown resource #{n.inspect}") }
    importer = PokeapiImporter.new(
      delay: Float(ENV.fetch("DELAY", "0.05")),
      force: ENV["FORCE"] == "1",
      log: ->(msg) { print "\r\e[K#{msg}" }
    )
    problems = []

    resources.each do |resource|
      r = importer.import(resource)
      puts "\r\e[K#{resource}: #{r.total} total, #{r.imported} imported, #{r.skipped} already present, " \
           "#{r.fetched} fetched from PokeAPI#{", #{r.failed.size} failed (#{r.failed.first(5).join(', ')})" if r.failed.any?}"
      problems << "#{r.failed.size} #{resource} records" if r.failed.any?

      next if ENV["SPRITES"] == "0" || !PokeapiImporter::SPRITE_PATHS.key?(resource)

      s = importer.import_sprites(resource)
      puts "\r\e[K#{resource} sprites: #{s.downloaded} downloaded, #{s.cached} from cache, " \
           "#{s.missing.size} missing upstream#{", #{s.failed.size} failed" if s.failed?}"
      problems << "#{s.failed.size} #{resource} sprites" if s.failed?
    end

    abort "Import incomplete: #{problems.join(', ')} failed (STRICT=1)." if problems.any? && ENV["STRICT"] == "1"
  end

  desc "Show how many records and sprites are in the local database"
  task status: :environment do
    counts = PokeapiRecord.group(:resource).count
    if counts.empty?
      puts "No data imported yet. Run: bin/rails pokeapi:import"
    else
      counts.sort.each { |resource, n| puts format("%-28s %6d", resource, n) }
    end
    puts format("%-28s %6d", "(sprites)", PokeapiSprite.count)
  end

  desc "Write a compact, self-contained copy of the database (safe while in WAL mode). FILE=path"
  task export: :environment do
    file = ENV["FILE"].presence or abort("Usage: bin/rails pokeapi:export FILE=path/to/pokeapi.sqlite3")
    abort "#{file} already exists" if File.exist?(file)

    ActiveRecord::Base.connection.execute("VACUUM INTO #{ActiveRecord::Base.connection.quote(file)}")
    puts "Wrote #{file} (#{(File.size(file) / 1_048_576.0).round(1)} MB)"
  end
end
