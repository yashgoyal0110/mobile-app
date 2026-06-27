# ---- TirthRide backend (NestJS) ----
# Multi-stage build: compile TS in a full image, run from a slim one.
# Node 24 = current Active LTS. (Node 23 is EOL — avoid for production.)

FROM node:24-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# The app listens on $PORT (default 3002). Override via env if needed.
ENV PORT=3002
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
EXPOSE 3002
CMD ["node", "dist/main.js"]
