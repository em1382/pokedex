class CreatePokeapiRecords < ActiveRecord::Migration[8.1]
  def change
    # One row per PokeAPI resource record, stored verbatim as JSON text.
    create_table :pokeapi_records do |t|
      t.string :resource, null: false   # e.g. "pokemon", "move"
      t.string :name, null: false       # PokeAPI's name (or id for unnamed resources)
      t.integer :pokeapi_id, null: false
      t.text :body, null: false         # raw JSON from PokeAPI
      t.timestamps
    end
    # PokeAPI ids are unique per resource; names usually are, but not always
    # (the item list has two "roseli-berry" entries).
    add_index :pokeapi_records, %i[resource pokeapi_id], unique: true
    add_index :pokeapi_records, %i[resource name]

    # Sprite images referenced by grid rows, so the UI works offline too.
    create_table :pokeapi_sprites do |t|
      t.string :path, null: false       # path under PokeAPI/sprites/master/sprites/
      t.string :content_type, null: false
      t.binary :data, null: false
      t.timestamps
    end
    add_index :pokeapi_sprites, :path, unique: true
  end
end
