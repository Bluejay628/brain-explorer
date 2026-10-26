# Works on any host that runs containers (Fly.io, Railway, Google Cloud Run, a school server…).
# Build:  docker build -t brain-explorer .
# Run:    docker run -p 8787:8787 -e ANTHROPIC_API_KEY=... brain-explorer
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY --from=build --chown=node:node /app /app
EXPOSE 8787
USER node
CMD ["npm", "start"]
