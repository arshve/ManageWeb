# Millenials Farm - Qurban Livestock Management

Web app for **PT. Millenials Farm Abadi** (Tangerang Selatan). Manages qurban livestock, sales entries, payment tracking, delivery routing, and a public catalogue.

## Default Accounts

| Username | Password | Role   | Access                                                    |
| -------- | -------- | ------ | --------------------------------------------------------- |
| `admin`  | `admin`  | ADMIN  | Full dashboard, users, livestock, pricing, deliveries     |
| `manage` | `manage` | MANAGE | Livestock CRUD only (warehouse staff)                     |
| `sales`  | `sales`  | SALES  | Create/view own entries, read-only catalogue + deliveries |
| `driver` | `driver` | DRIVER | Own delivery route for the day, mark delivered/failed    |

## Features

### Public Pages
- **Landing** (`/`) — Hero, features, animal types
- **Catalogue** (`/catalogue`) — Public livestock listing with photos, labels, prices

### Admin (`/admin`)
- **Dashboard** — Stats: livestock, entries, revenue, profit
- **Hewan** (`/admin/livestock`) — Livestock CRUD (type, grade, condition, weight, tags, photos)
- **Entry Penjualan** (`/admin/entries`) — All sale entries, inline edit, approve/reject
- **Deliveries** (`/admin/deliveries`) — Schedule dates, generate routes (TSP per driver), assign drivers, live map
- **Harga** (`/admin/pricing`) — Buy/sell prices per type and grade
- **Kelola User** (`/admin/users`) — User accounts, roles, driver vehicle info
- **Logs** (`/admin/logs`) — Audit log of admin actions

### Manage (`/manage`)
- Read/write livestock only. No pricing, no entries, no users.

### Sales (`/sales`)
- **Entry Saya** — Own entries + earnings summary (komisi, total jual, pending)
- **Tambah Entry** (`/sales/new`) — New sale: pick animal, buyer info, payment
- **Katalog** (`/sales/catalogue`) — Read-only livestock browser with driver/delivery status
- **Delivery** (`/sales/deliveries`) — Read-only route list + map per day

### Driver (`/driver`)
- Daily route view. Clickable animal photo, tag, pembeli, alamat, sales name
- "Mulai Rute" → flips stops to ON_DELIVERY
- Per-stop: mark **Terkirim** (auto-sets `isSent`) or **Gagal** with reason
- Live location ping (Supabase realtime) while on route

### Entry Approval Flow
1. Sales creates entry → **PENDING**
2. Admin approves → **APPROVED**, livestock marked sold
3. Admin rejects → **REJECTED**, livestock released
4. Admin can edit anything (buyer, pricing, payment, delivery)

### Delivery / Routing
- Admin assigns `deliveryDate` on approved entries → creates `Delivery` rows (PENDING)
- Driver availability per day (`DriverAvailability`)
- **Generate routes**: split stops across N drivers, solve TSP from depot per bucket (`src/lib/delivery/{split,tsp,depot}.ts`)
- Depot from `FARM_LAT`/`FARM_LNG` env or manual input (lat,lng or Google Maps URL)
- Geocoding: Maps URL parse → `GeocodeCache` → Google Geocoding API (optional key)
- Live map with Leaflet + OSRM routing, driver position from Supabase realtime
- Bulk tools: Reset Routes, Clear Schedule, Backfill Coordinates

### Other Features
- JWT session auth (httpOnly cookies, 7-day expiry, HS256)
- Password hashing with bcryptjs
- PDF invoice + kwitansi via `@react-pdf/renderer`
- Bukti transfer upload (multi-image per entry)
- Payslip API (`/api/payslip`) for sales commission reports
- Audit log on sensitive actions
- Rupiah-formatted currency inputs (live formatting)
- Mobile-first responsive design + dark mode

## Tech Stack

### Frontend
| Tech           | Version | Purpose                                |
| -------------- | ------- | -------------------------------------- |
| React          | 19.2    | UI                                     |
| Next.js        | 16.2    | App Router, Server Actions, `proxy.ts` |
| Tailwind CSS   | 4       | Styling (oklch)                        |
| Base UI React  | 1.3     | Headless primitives (shadcn-style)     |
| Leaflet        | 1.9     | Delivery map                           |
| react-leaflet  | 5.0     | React bindings for Leaflet             |
| Lucide React   | 1.7     | Icons                                  |
| Recharts       | 3.8     | Dashboard charts                       |
| Sonner         | 2.0     | Toast                                  |
| next-themes    | 0.4     | Dark mode                              |

### Backend
| Tech                 | Version | Purpose                             |
| -------------------- | ------- | ----------------------------------- |
| PostgreSQL           | 17      | Database                            |
| Prisma               | 6.19    | ORM + migrations                    |
| jose                 | 6.2     | JWT signing (HS256)                 |
| bcryptjs             | 3.0     | Password hash                       |
| @react-pdf/renderer  | 4.4     | Invoice/kwitansi PDFs               |
| @supabase/supabase-js| 2.10    | Realtime channel for driver location|
| date-fns             | 4.1     | Date formatting                     |

### Tooling
TypeScript 5 · ESLint 9 · Turbopack (dev) · `tsx` (seed script)

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (`brew install postgresql@17`)
- Supabase project (free tier) — only used for realtime driver location. Can skip if you don't need live tracking.

### 1. Clone + Install

```bash
git clone <repo-url>
cd millenials-farm
npm install
```

### 2. Environment

Create `.env`:

```env
# Database
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/millenials_farm"
DIRECT_URL="postgresql://YOUR_USERNAME@localhost:5432/millenials_farm"

# Auth
SESSION_SECRET="your-secret-key-change-in-production"

# Farm depot (required for route generation; falls back to manual input otherwise)
FARM_LAT="-6.3078445"
FARM_LNG="106.6943313"

# Optional: Google Geocoding API (for address → coords backfill)
GOOGLE_MAPS_API_KEY=""

# Optional: Supabase realtime (driver live location)
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
```

### 3. Database

```bash
createdb millenials_farm
npx prisma db push
npx prisma generate
npx tsx prisma/seed.ts   # sample users, livestock, pricing, entries
```

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000 and login as `admin` / `admin`.

### Useful Commands

```bash
npm run dev               # Turbopack dev server
npm run build             # Production build
npm run start             # Production server
npm run lint              # ESLint
npx prisma studio         # DB GUI at :5555
npx prisma db push        # Sync schema
npx tsx prisma/seed.ts    # Re-seed
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/                # Login, unauthorized
│   ├── (dashboard)/
│   │   ├── admin/             # Admin: dashboard, livestock, entries, deliveries, pricing, users, logs
│   │   ├── manage/            # Warehouse: livestock only
│   │   ├── sales/             # Sales: entries, catalogue, deliveries
│   │   └── driver/            # Driver: daily route view
│   ├── (public)/              # Landing, catalogue
│   ├── actions/               # Server Actions: entries, livestock, pricing, users, deliveries, drivers
│   ├── api/                   # auth, upload, livestock, entries, payslip, driver
│   └── layout.tsx
├── components/
│   ├── admin/                 # deliveries-admin-view, delivery-map, driver-tracker
│   ├── dashboard/             # sidebar, forms, entry-table, livestock-table
│   ├── driver/                # driver-run-view, location-pinger
│   └── ui/                    # Base UI primitives (button, card, input, …)
├── lib/
│   ├── delivery/              # depot, geo, geocode, maps, split, tsp
│   ├── auth.ts                # getProfile, requireAuth, requireRole
│   ├── audit.ts               # Audit log writer
│   ├── format.ts              # Rupiah, dates, SKU, invoice
│   ├── prisma.ts              # Prisma singleton
│   ├── session.ts             # JWT session
│   └── supabase.ts            # Realtime client
├── proxy.ts                   # Next.js 16 proxy (route protection)
└── generated/prisma/          # Auto-generated Prisma client

prisma/
├── schema.prisma
└── seed.ts
```

## Database Schema

Models: **Profile** (users, with driver vehicle/location fields), **Livestock**, **Entry**, **Delivery**, **DriverAvailability**, **GeocodeCache**, **Pricing**, **AuditLog**.

See `prisma/schema.prisma` for full schema.
