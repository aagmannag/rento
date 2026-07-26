# Rento

A vehicle rental platform made up of three separate Next.js apps sharing one Postgres database.

| App | Purpose | Default port |
|---|---|---|
| `rentoCustomer` | Customer-facing site — browse vehicles, book, pay via UPI, manage bookings | 3000 |
| `portalForShopOwner` | Shop owner dashboard — list vehicles, manage bookings, edit shop profile | 3001 |
| `portalAdmin` | Internal admin dashboard — approve/reject shop owners, moderate vehicles, verify payments, mark precise pickup locations on a map | 3002 |

## Architecture

- **Database**: one shared Postgres database. Each app creates its own tables on first
  connection (`ensureSchema()` in each app's `lib/db.ts`) — no separate migration step or
  ORM needed. `portalAdmin` additionally reads/writes tables owned by the other two apps
  for its cross-app admin workflows (approvals, payment verification).
- **File storage**: vehicle photos and payment screenshots upload to Cloudinary when
  `CLOUDINARY_*` env vars are set; otherwise they fall back to local disk under
  `public/uploads/` in the relevant app (fine for local dev, **not** suitable for
  deployment to a host with an ephemeral filesystem).
- **Auth**: each app has its own independent session (signed JWT in an httpOnly cookie) —
  a shop owner's session, an admin's session, and a customer's session can never be used
  interchangeably. `rentoCustomer` uses Firebase for phone/OTP verification; the other two
  use email + password.
- **Pickup locations**: shop owners only ever type their address. Marking the *precise*
  map pin is an admin-only action (`portalAdmin`'s shop-owner review page) — this is what
  customers actually see on the map in `rentoCustomer`.

## Local setup

Each app needs its own `.env.local` — see `.env.local.example` in each app's folder for
the full list of required variables and where to get them (Postgres connection string,
JWT secrets, Cloudinary credentials, Firebase config for `rentoCustomer`).

```bash
cd portalForShopOwner && npm install && npm run dev   # localhost:3001
cd portalAdmin && npm install && npm run dev           # localhost:3002
cd rentoCustomer && npm install && npm run dev         # localhost:3000
```

First-run steps:
1. Sign up a shop owner at `portalForShopOwner` — its schema auto-creates on first request.
2. Visit `portalAdmin`'s `/setup` to create the first admin account (one-time).
3. Approve the shop owner from the admin dashboard, list a vehicle, then book it as a
   customer from `rentoCustomer`.
