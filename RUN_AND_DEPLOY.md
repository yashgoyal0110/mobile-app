# TirthRide — Run & Deploy Guide

Govardhan e-rickshaw booking **+ Dharamshala / Guest-house discovery**, for the
UP Braj Teerth Vikas Parishad pilot.

- **Backend:** FastAPI + MongoDB (Motor), JWT auth, realtime WebSocket dispatch
- **Frontend:** Expo (React Native) + expo-router — runs on Android, iOS, and Web

---

## 1. Run locally

### Prerequisites
- Python 3.12+
- Node 18+ and Yarn
- MongoDB running locally **or** a free MongoDB Atlas cluster

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-prod.txt        # slim runtime deps
cp .env.example .env                         # then edit MONGO_URL etc.
uvicorn server:app --reload --port 8000
```
Check it: open http://localhost:8000/api/health → `{"status":"ok","db":true}`.
On first boot it auto-seeds the admin user, fare config, landmarks, and **4 sample dharamshalas**.

### Frontend
```bash
cd frontend
yarn install
cp .env.example .env                         # set EXPO_PUBLIC_BACKEND_URL
yarn web        # browser demo at http://localhost:8081  (fastest for officials)
# or
yarn start      # scan QR with Expo Go on a phone
```

> **Testing on a physical phone over LAN:** set
> `EXPO_PUBLIC_BACKEND_URL=http://<your-laptop-ip>:8000` (not `localhost`) and start
> uvicorn with `--host 0.0.0.0`.

### Demo logins
- **Admin:** phone `9999999999`, OTP `123456` → Dashboard → *Dharamshalas & stays* / *Temples & darshan*
- **Passenger:** any 10-digit phone, OTP `123456` → three pillars in the tab bar: **Home** (e-rickshaw), **Stays**, **Temples**
- **Driver:** any phone, OTP `123456`, then submit KYC (admin approves it)

> **`.env` files:** local `backend/.env` and `frontend/.env` are already created with
> sensible dev defaults (and a random `JWT_SECRET`). They are gitignored. Templates
> live in `*.env.example`.

---

## 2. What's new in this iteration

### Dharamshala / Guest-house module (discovery + inquiry)
- **Pilgrim:** new **Stays** tab — search, filter by type & facilities (parking,
  food, family, senior-friendly), proximity sort, then **Call / WhatsApp / Get
  Directions**. Detail screen shows facilities, room types, price/donation, distance.
- **Admin:** Dashboard → *Dharamshalas & stays* — add / edit / **verify** /
  toggle availability / feature / delete. Only verified stays are shown to pilgrims.
- **API:** public `GET /api/stays`, `GET /api/stays/{id}`; admin
  `GET|POST|PATCH|DELETE /api/admin/stays`.

### Temples module (darshan timings / aarti / crowd)
- **Pilgrim:** new **Temples** tab — search, proximity sort, **live Open now /
  Opens at / Closed** status computed from darshan slots (IST), crowd-level badge,
  distance. Detail screen lists all darshan slots, aarti timings, special-day notes,
  entry info, **Get Directions** and a quick **Book Rickshaw** link.
- **Admin:** Dashboard → *Temples & darshan* — add / edit / verify / feature /
  delete, with a **multi-slot** darshan editor (a temple can open & close several
  times a day), an aarti-timings editor, and a crowd-level selector to update
  through the day. Only verified temples are shown to pilgrims.
- **API:** public `GET /api/temples`, `GET /api/temples/{id}`; admin
  `GET|POST|PATCH|DELETE /api/admin/temples`.

### Robustness
- FastAPI **lifespan** handler (replaces deprecated `on_event`)
- **`/api/health`** readiness probe (pings MongoDB) for load balancers / Cloud Run
- **MongoDB indexes** created on startup (users, drivers, rides, stays, complaints)
- Slim **`requirements-prod.txt`** + **Dockerfile** for a small, fast image

---

## 3. Deploy on Google Cloud (GCP)

Recommended shape for the pilot:

```
 Pilgrim/Driver phone ─┐
 Admin web browser ────┼─→  Cloud Run (FastAPI container)  ─→  MongoDB Atlas
 Web demo (officials) ─┘         (auto-scaling, HTTPS)
        └────────────→  Firebase Hosting (Expo web build)
```

### 3.1 Database — MongoDB Atlas (free tier works for the pilot)
1. Create a free **M0 cluster** at mongodb.com/atlas.
2. Database Access → add a user/password.
3. Network Access → allow `0.0.0.0/0` (or Cloud Run egress IPs).
4. Copy the `mongodb+srv://...` connection string → this is your `MONGO_URL`.

### 3.2 Backend — Cloud Run
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# Build & deploy straight from the backend/ folder (uses the Dockerfile)
cd backend
gcloud run deploy tirthride-api \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --timeout 3600 \
  --set-env-vars "DB_NAME=tirthride,ADMIN_PHONES=9999999999,MOCK_OTP=123456,GEO_PROVIDER=osm" \
  --set-secrets "MONGO_URL=tirthride-mongo:latest,JWT_SECRET=tirthride-jwt:latest"
```
Create the secrets first:
```bash
echo -n "mongodb+srv://..." | gcloud secrets create tirthride-mongo --data-file=-
echo -n "$(openssl rand -hex 32)" | gcloud secrets create tirthride-jwt --data-file=-
```
Notes:
- `--timeout 3600` keeps **WebSocket** ride-dispatch connections alive (Cloud Run
  supports WebSockets; max 60 min).
- Keep **1 worker per instance** (the Dockerfile already does) — the WS connection
  manager is in-process; scale with instances, not workers. For the pilot you can
  also set `--min-instances 1` to avoid cold starts during a live demo.
- After deploy, note the URL, e.g. `https://tirthride-api-xxxx.a.run.app`, and
  verify `…/api/health`.

### 3.3 Frontend (web demo) — Firebase Hosting
Easiest way to give officials a clickable link.
```bash
cd frontend
# point the build at the deployed API:
echo "EXPO_PUBLIC_BACKEND_URL=https://tirthride-api-xxxx.a.run.app" > .env
yarn install
npx expo export -p web          # outputs static site to ./dist

npm i -g firebase-tools
firebase login
firebase init hosting           # public dir = "dist", single-page app = Yes
firebase deploy --only hosting
```
(You can also host `dist/` on a **Cloud Storage** bucket + Cloud CDN if you prefer
to stay entirely within GCP.)

### 3.4 Frontend (Android APK) — EAS Build
For installing the real app on phones (best for the officials demo). `eas.json` is
already in `frontend/` with `preview` (APK) and `production` (Play Store .aab) profiles.

1. Edit `frontend/eas.json` → set `EXPO_PUBLIC_BACKEND_URL` (both profiles) to your
   Cloud Run URL from step 3.2.
2. Build the APK:
```bash
cd frontend
npm i -g eas-cli
eas login                                   # free Expo account
eas build -p android --profile preview      # ~10–15 min in Expo's cloud
```
3. EAS prints a download link → open it on the phone → install the `.apk`
   (allow "install from unknown sources" once). The app now runs standalone and
   talks to your GCP backend from anywhere — **no laptop needed**.

App IDs are set in `app.json` (`com.brajgo.tirthride`). The build runs on Expo's
servers, so you don't need Android Studio.

---

## 4. Pre-demo checklist
- [ ] `…/api/health` returns `{"status":"ok"}`
- [ ] Admin login `9999999999 / 123456` works; sample dharamshalas visible under *Dharamshalas & stays*
- [ ] Passenger **Stays** tab lists stays; Call / WhatsApp / Directions open correctly on a real phone
- [ ] Book a local ride + parikrama end-to-end (passenger → driver accept → PIN → complete)
- [ ] `JWT_SECRET` is a real random secret in production (not the dev default)
- [ ] `min-instances=1` on Cloud Run during the live demo to avoid cold starts
