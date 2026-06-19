# Seeky — demo (NestJS + React + Postgres)

A minimal, runnable slice of the Seeky job-matching product (see `wbs.csv` /
`wbs_analysis.md` for the full business analysis). This demo implements the
**core**: users with two roles, role-specific listings with real geolocation,
and **geometric matching** between an employer's *point + radius* and a
candidate's *region polygon*.

## What's included

- **Users** with 2 roles: `EMPLOYER` and `CANDIDATE` (simple email/password auth,
  opaque bearer token).
- **Listings** (a user can have many):
  - **Employer**: a *specific point* via **Google Places** autocomplete +
    Place Details, plus a **radius** (5–200 km).
  - **Candidate**: a *city / region* picked via autocomplete; the **area polygon**
    is fetched from Geoapify and stored.
- **Geo proxy** in the backend (the API keys never reach the browser):
  - employer point: **Google Places API** autocomplete + Place Details
    (`GOOGLE_MAPS_API_KEY`),
  - candidate region: Geoapify Geocoding autocomplete + the **Geoapify
    Place Details API** (`/v2/place-details`) for the polygon, keyed by the
    selected place_id (`GEOAPIFY_API_KEY`).
  - No fallback: both keys are required; the candidate region polygon always
    comes from the live Geoapify Place Details API for the selected place.
- **Matching feed**: built from **all** of the current user's active listings
  combined. A target (opposite-role) listing appears when the employer's radius
  **circle geometrically intersects** the candidate's region polygon
  (computed with `@turf/turf`). Swiped cards are excluded.

## Prerequisites

- Node.js 18+ (tested on 20)
- Docker (for Postgres)

## 1. Start Postgres

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` (db/user/pass all `seeky`).

## 2. Start the backend (NestJS + Prisma)

```bash
cd backend
cp .env.example .env        # already created; edit if you have a GEOAPIFY_API_KEY
npm install
npx prisma generate         # generate the Prisma client
npx prisma db push          # create the tables in Postgres
npm run start:dev
```

Backend runs at `http://localhost:3000`. `prisma db push` syncs the schema from
`prisma/schema.prisma` into the database.

> Both keys are required in `backend/.env`:
> `GEOAPIFY_API_KEY=...` (candidate region autocomplete + Place Details polygon) and
> `GOOGLE_MAPS_API_KEY=...` (employer point — needs "Places API" enabled).
> There is no offline fallback: geo endpoints return an error if a key is missing.

## 3. Start the frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api/*` → backend.

## Try it

1. Register an **Employer** (e.g. `employer@a.com`). Create a listing with a
   company point (search "Zürich") and radius 50 km.
2. Log out, register a **Candidate** (`cand@a.com`). Create a listing with a
   preferred region (search "Zürich") + contact + consent.
3. As either user, open **Matching feed** — you'll see the opposite-role listing
   when the employer's circle intersects the candidate's region. Swipe
   ♥ Interested / ✕ Pass; swiped cards drop off.

> Tip: make the employer radius small (5 km) and pick a *far* candidate region
> (e.g. Berlin) to see a non-match, then a near region (Zürich/Winterthur) to
> see a match.

## API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create user (`role`: EMPLOYER/CANDIDATE) |
| POST | `/auth/login` | Log in, returns token |
| GET | `/auth/users` | List all accounts (demo quick-login) |
| POST | `/auth/quick-login` | Password-less login by `userId` (demo only) |
| GET | `/auth/me` | Current user |
| GET | `/geo/autocomplete?text=` | Candidate region autocomplete (Geoapify) |
| GET | `/geo/city-polygon?placeId=&label=&lat=&lon=` | Region polygon (Geoapify Place Details API) |
| GET | `/geo/places/autocomplete?text=` | Employer point autocomplete (Google Places) |
| GET | `/geo/places/details?placeId=` | Resolve a Google placeId to a point |
| POST | `/listings` | Create listing (candidate → fetch + store polygon) |
| GET | `/listings/mine` | My listings |
| GET | `/feed` | Matched opposite-role listings (excludes swiped) |
| POST | `/swipe` | Record `LEFT` / `RIGHT` |

Auth: `Authorization: Bearer <token>` (token = base64 of the user id — demo only).

## Project layout

```
docker-compose.yml      # Postgres 16
backend/                # NestJS + Prisma
  prisma/schema.prisma  # User, Listing, Swipe models
  src/prisma/           # PrismaService / PrismaModule
  src/auth/             # register/login/me + bearer guard
  src/geo/              # Google Places (employer) + Geoapify Place Details (candidate)
  src/listings/         # create/list (point+radius | region polygon)
  src/feed/             # matching (turf circle ∩ polygon) + swipe
frontend/               # React + Vite + react-leaflet
  src/components/        # Auth, CreateListing, MyListings, Feed, MapView,
                         #   PlacesAutocomplete (employer/Google),
                         #   LocationAutocomplete (candidate/Geoapify)
```

## Notes / simplifications

This is a demo of the location + matching core. Out of scope (described in
`wbs_analysis.md`): video recording/moderation, OTP/SMS, reCAPTCHA/WAF,
subscriptions, chat, notifications, admin panel. Auth is intentionally minimal
(plain-text passwords, no JWT/refresh/lockout) — **do not use as-is in
production**. Polygons are stored as JSON columns and intersected in-memory with
turf; for production, store them in PostGIS (`geometry`) with a GiST index and
run the intersection in the database (e.g. `ST_Intersects`).
