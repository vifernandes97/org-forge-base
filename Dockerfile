# App do CRM (crm.neosoluti.com.br): front buildado + server/ (Better Auth,
# portão /rest do PostgREST). Roda com Bun, que executa o TypeScript direto.
FROM oven/bun:1.4.4-slim AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.4.4-slim
WORKDIR /app
ENV NODE_ENV=production CRM_PORT=3000
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY server ./server
COPY --from=build /app/dist ./dist
COPY scripts/docker-entrypoint.sh ./
EXPOSE 3000
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
