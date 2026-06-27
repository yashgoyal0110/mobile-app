# TirthRide Backend — NestJS

TypeScript port of the original FastAPI backend (`../backend`). Same MongoDB
database, same `/api` routes, same JSON shapes — so the Expo frontend works
against it unchanged.

## Stack

| Concern        | Python (old)        | NestJS (this)                          |
| -------------- | ------------------- | -------------------------------------- |
| Framework      | FastAPI             | NestJS (Express)                       |
| Data layer     | motor (raw)         | Mongoose (`strict: false` passthrough) |
| Validation     | Pydantic            | class-validator DTOs                   |
| Auth           | python-jose (HS256) | jsonwebtoken (HS256)                    |
| Realtime       | starlette WebSocket | `ws` on the HTTP upgrade event         |
| Push           | httpx → Expo        | axios → Expo                           |

The collections, field names (snake_case), the custom string `id` (uuid) keys,
and the JWT claims (`sub`/`role`/`iat`/`exp`) are all preserved, so the two
backends are drop-in interchangeable against the same data.

Requires **Node 24** (current Active LTS). Node 23 is end-of-life — don't use it
for production. Everything here is pure-JS / native-free, so 24 builds cleanly.

## Run locally (no Docker)

```bash
cp .env.example .env          # then edit MONGO_URL / JWT_SECRET etc.
npm install
npm run start:dev             # watch mode on :3002  (or: npm run build && npm start)
```

Needs a MongoDB reachable at `MONGO_URL` (e.g. `mongodb://localhost:27017`).

Point the app at it:

```bash
# frontend/.env
EXPO_PUBLIC_BACKEND_URL=http://<your-lan-ip>:3002
```

## Deploy / redeploy on a VM (Docker)

The `docker-compose.yml` runs two containers: the API (published on **:3002**)
and its own MongoDB (kept private, data persisted in the `mongo_data` volume).

### First deploy

```bash
# 1. Get the code onto the VM (git clone, scp, rsync — your choice), then:
cd backend-ts

# 2. Configure secrets. At minimum set a real JWT_SECRET and your ADMIN_PHONES.
cp .env.example .env
nano .env          # JWT_SECRET=... ADMIN_PHONES=98xxxxxxxx  (MONGO_URL is set by compose)

# 3. Build + start in the background.
docker compose up -d --build

# 4. Verify.
curl http://localhost:3002/api/health        # -> {"status":"ok","db":true}
docker compose logs -f api                    # watch boot / seed logs
```

Open port **3002** on the VM firewall / cloud security group so the app can reach it.
Then set `EXPO_PUBLIC_BACKEND_URL=http://<vm-public-ip>:3002` in the frontend.

> Put a TLS reverse proxy (Caddy / nginx) in front for HTTPS in production —
> e.g. proxy `api.yourdomain.com` → `127.0.0.1:3002`. Mongo data survives
> redeploys via the named volume; it is **not** published to the internet.

### Redeploy (after pulling new code)

```bash
cd backend-ts
git pull                         # or however you ship new code
docker compose up -d --build     # rebuilds the image, recreates only what changed
```

`--build` recompiles the TypeScript; the Mongo container and its volume are left
untouched, so data is preserved. To force a clean rebuild:

```bash
docker compose build --no-cache api && docker compose up -d
```

### Common operations

```bash
docker compose ps                # status
docker compose logs -f api       # tail API logs
docker compose restart api       # restart just the API
docker compose down              # stop everything (KEEPS the mongo_data volume)
docker compose down -v           # stop AND wipe the database volume (destructive)
```

## Layout

```
src/
  main.ts                 bootstrap: /api prefix, CORS, validation, {detail} filter, raw /api/ws
  app.module.ts           wires Mongoose + every feature module
  app.controller.ts       GET /api  and  GET /api/health
  config/constants.ts     env-driven config (loads .env, mirrors app/config.py)
  common/                 utils, JWT, AuthGuard (+@Roles), {detail} exception filter
  db/schemas/             one Mongoose schema per collection (schemaless passthrough)
  realtime/               connection manager + Expo push + raw WS handler
  seed/                   sample stays/temples/landmarks + index creation on bootstrap
  modules/
    auth users config drivers rides suggestions admin geo ratings stays temples
```

Each `modules/<x>` maps 1:1 to the old `backend/app/routes/<x>.py`.

## Endpoint parity

All routes are mounted under `/api` and match the Python backend exactly,
including the admin sub-routers (`/api/admin`, `/api/admin/stays`,
`/api/admin/temples`) and the realtime socket at `/api/ws?token=<jwt>`.

Errors return `{ "detail": "<message>" }` (FastAPI shape) because the frontend
reads `data.detail`.
