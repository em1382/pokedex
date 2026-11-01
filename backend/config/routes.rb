Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # PokeAPI data served from the local SQLite database. Collection paths are
  # plural (/api/moves, /api/abilities; /api/pokemon is its own plural).
  scope "/api", controller: :pokeapi, constraints: { resources: /[a-z-]+/, id: /[^\/]+/ } do
    get ":resources", action: :index
    get ":resources/all", action: :all
    get ":resources/:id", action: :show
  end

  get "sprites/*path", to: "sprites#show", format: false
end
