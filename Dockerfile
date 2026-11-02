# syntax=docker/dockerfile:1
#
# One image: Rails API + Next.js front-end, with all PokeAPI data imported at
# build time into SQLite. The build needs network access; the running
# container doesn't (works with `docker run --network none`).
#
#   docker build -t pokedex .
#   docker run --rm -p 3000:3000 pokedex      # http://localhost:3000

ARG RUBY_VERSION=3.2.3
ARG NODE_VERSION=24

# ---------------------------------------------------------------- api + data
FROM ruby:${RUBY_VERSION}-slim-bookworm AS api

RUN apt-get update -qq \
 && apt-get install --no-install-recommends -y build-essential libyaml-dev \
 && rm -rf /var/lib/apt/lists/*

ENV RAILS_ENV=production \
    BUNDLE_DEPLOYMENT=1 \
    BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_WITHOUT=development:test

WORKDIR /app/backend
COPY backend/Gemfile backend/Gemfile.lock ./
RUN bundle install && rm -rf "${BUNDLE_PATH}"/ruby/*/cache

COPY backend/ ./
RUN bundle exec bootsnap precompile app/ lib/

# What to import (any PokeAPI resource names, plural or singular).
ARG POKEAPI_RESOURCES=pokemon,moves,abilities,items,types
ARG POKEAPI_SPRITES=1
ARG POKEAPI_DELAY=0.05

# PokeAPI fair use: every response lands in a BuildKit cache mount, so
# rebuilding the image re-reads it instead of hitting PokeAPI again.
RUN --mount=type=cache,id=pokeapi-cache,target=/app/backend/storage/pokeapi_cache \
    SECRET_KEY_BASE_DUMMY=1 bin/rails db:prepare \
 && SECRET_KEY_BASE_DUMMY=1 RESOURCES="${POKEAPI_RESOURCES}" SPRITES="${POKEAPI_SPRITES}" DELAY="${POKEAPI_DELAY}" \
    bin/rails pokeapi:import \
 && SECRET_KEY_BASE_DUMMY=1 bin/rails pokeapi:status

# -------------------------------------------------------------------- web
FROM node:${NODE_VERSION}-bookworm-slim AS web

ENV NEXT_TELEMETRY_DISABLED=1 \
    RAILS_API_URL=http://127.0.0.1:3001
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter frontend

COPY frontend/ frontend/
RUN pnpm --filter frontend build \
 && cp -r frontend/.next/static frontend/.next/standalone/frontend/.next/static

# ---------------------------------------------------------------- runtime
FROM ruby:${RUBY_VERSION}-slim-bookworm AS runtime

COPY --from=node:24-bookworm-slim /usr/local/bin/node /usr/local/bin/node

ENV RAILS_ENV=production \
    BUNDLE_DEPLOYMENT=1 \
    BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_WITHOUT=development:test \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    RAILS_API_URL=http://127.0.0.1:3001

RUN groupadd --system --gid 1000 app \
 && useradd --system --uid 1000 --gid app --create-home app

COPY --from=api /usr/local/bundle /usr/local/bundle
COPY --from=api --chown=app:app /app/backend /app/backend
COPY --from=web --chown=app:app /app/frontend/.next/standalone /app/web
COPY --chmod=755 docker/start.sh /app/start.sh

USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "Promise.all(['http://127.0.0.1:3000/', 'http://127.0.0.1:3001/up'].map(u => fetch(u))).then(rs => process.exit(rs.every(r => r.ok) ? 0 : 1), () => process.exit(1))"

CMD ["/app/start.sh"]
