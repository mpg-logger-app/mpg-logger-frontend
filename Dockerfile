# Container image for the web side of MPG Logger: Caddy serving the built React app and forwarding
# /api to the backend (see Caddyfile). Built and run by docker-compose.yml in the mpg-logger-backend repo.

# ---- Build: compile the React app into dist/ ----
FROM node:24-alpine AS build
WORKDIR /app
# Dependencies first, so they're cached between builds unless package-lock.json changes.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Run: Caddy with the built files ----
FROM caddy:2.10-alpine
LABEL org.opencontainers.image.source="https://github.com/mpg-logger-app/mpg-logger-frontend"
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
