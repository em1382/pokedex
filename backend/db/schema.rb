# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_11_01_000000) do
  create_table "pokeapi_records", force: :cascade do |t|
    t.string "resource", null: false
    t.string "name", null: false
    t.integer "pokeapi_id", null: false
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["resource", "name"], name: "index_pokeapi_records_on_resource_and_name"
    t.index ["resource", "pokeapi_id"], name: "index_pokeapi_records_on_resource_and_pokeapi_id", unique: true
  end

  create_table "pokeapi_sprites", force: :cascade do |t|
    t.string "path", null: false
    t.string "content_type", null: false
    t.binary "data", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["path"], name: "index_pokeapi_sprites_on_path", unique: true
  end
end
