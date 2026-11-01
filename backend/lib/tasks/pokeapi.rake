namespace :pokeapi do
  desc "Import PokeAPI data into SQLite. RESOURCES=pokemon,moves,... (default: the 5 grids), " \
       "SPRITES=0 to skip images, FORCE=1 to re-import existing records, DELAY=seconds between upstream requests"
  task import: :environment do
    names = ENV.fetch("RESOURCES", "pokemon,moves,abilities,items,types").split(",").map(&:strip)
    resources = names.map { |n| PokeapiRecord.normalize(n) or abort("Unknown resource #{n.inspect}") }
    importer = PokeapiImporter.new(
      delay: Float(ENV.fetch("DELAY", "0.05")),
      force: ENV["FORCE"] == "1",
      log: ->(msg) { print "\r\e[K#{msg}" }
    )

    resources.each do |resource|
      r = importer.import(resource)
      puts "\r\e[K#{resource}: #{r.total} total, #{r.imported} imported, #{r.skipped} already present, " \
           "#{r.fetched} fetched from PokeAPI#{", #{r.failed.size} failed (#{r.failed.first(5).join(', ')})" if r.failed.any?}"

      next if ENV["SPRITES"] == "0" || !PokeapiImporter::SPRITE_PATHS.key?(resource)

      downloaded, missing = importer.import_sprites(resource)
      puts "\r\e[K#{resource} sprites: #{downloaded} downloaded, #{missing} missing upstream"
    end
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
end
