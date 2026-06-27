# ---- Build stage: compiles TypeScript -> JavaScript ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ---- Production stage: lean runtime image ----
FROM mcr.microsoft.com/playwright:v1.45.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

RUN npx playwright install chromium --with-deps

# Compiled app
COPY --from=builder /app/dist ./dist

# knexfile.ts + the TS migration sources are needed at runtime: migrations
# are run via `npx tsx ./node_modules/.bin/knex migrate:latest --knexfile knexfile.ts`
# (see docker-compose.yml), which transpiles them on the fly. We intentionally
# do NOT copy the rest of src/ — only the migrations subfolder is required.
COPY knexfile.ts ./
COPY src/db/migrations ./src/db/migrations

# Correr como usuario no-root dentro del contenedor
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser
USER appuser

EXPOSE 3000

CMD ["node", "dist/index.js"]