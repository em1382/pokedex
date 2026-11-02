namespace :e2e do
  desc "Rebuild the end-to-end test fixture (test/e2e/pokeapi.json) from the imported data"
  task fixture: :environment do
    fixture = E2eFixture.build
    File.write(E2eFixture::PATH, E2eFixture.dump(fixture))
    puts "Wrote #{E2eFixture::PATH} (#{fixture['records'].size} records, #{fixture['sprites'].size} sprites)"
  end

  desc "Replace the data in the current database with the e2e fixture (e2e databases only)"
  task seed: :environment do
    E2eFixture.load
    puts "Loaded the e2e fixture into #{ActiveRecord::Base.connection_db_config.database}"
  rescue E2eFixture::NotAnE2eDatabase => e
    abort e.message
  end
end
