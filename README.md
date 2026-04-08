# Millenials Farm - Qurban Livestock Management

A web application for **PT. Millenials Farm Abadi** (Tangerang Selatan) to manage qurban livestock data entry, sales tracking, and catalogue display.

## Default Accounts

| Username | Password | Role  | Access                                    |
| -------- | -------- | ----- | ----------------------------------------- |
| `admin`  | `admin`  | ADMIN | Full dashboard, manage users/livestock/pricing |
| `sales`  | `sales`  | SALES | Create entries, view own entries           |

## Features

### Public Pages
- **Landing Page** (`/`) — Informational page about Millenials Farm with hero, features, and animal types
- **Catalogue** (`/catalogue`) — Public-facing catalogue of available livestock with photos, labels, and prices

### Admin Dashboard (`/admin`)
- **Dashboard** — Stats overview: total livestock, entries, revenue, profit
- **Hewan** (`/admin/livestock`) — CRUD for livestock animals (type, grade, condition, weight, tags, photos)
- **Entry Penjualan** (`/admin/entries`) — View all sale entries with inline editing, approve/reject pending entries
- **Kelola User** (`/admin/users`) — Create/edit/deactivate user accounts, assign roles
- **Harga** (`/admin/pricing`) — Set buy/sell prices per animal type and grade

### Sales Dashboard (`/sales`)
- **Entry Saya** (`/sales`) — View own entries with earnings summary (total commission, sales, pending)
- **Tambah Entry** (`/sales/new`) — Create a new sale entry: select available animal, fill buyer info, payment details

### Entry Approval Flow
1. Sales person creates an entry → status: **PENDING**
2. Admin reviews and approves → status: **APPROVED**, livestock marked as sold
3. Or admin rejects → status: **REJECTED**, livestock remains available
4. Admin can also edit any entry (buyer info, pricing, payment, delivery status)

### Role-Based Access
- **Admin**: Full CRUD on everything, can see profit/cost/margin fields, manage users
- **Sales**: Can only create entries and view their own entries. Hidden fields: profit, buy price, cost margin

### Other Features
- JWT session authentication (httpOnly cookies, 7-day expiry)
- Password hashing with bcryptjs
- File upload for livestock photos (stored in `public/uploads/`)
- Payslip API (`/api/payslip`) for sales commission reports
- Mobile-first responsive design
- Dark mode support

## Tech Stack

### Frontend
| Technology      | Version | Purpose                           |
| --------------- | ------- | --------------------------------- |
| React           | 19.2    | UI library                        |
| Next.js         | 16.2    | Full-stack framework (App Router) |
| Tailwind CSS    | 4       | Utility-first styling (oklch)     |
| shadcn/ui       | 4       | UI components (Base UI, not Radix)|
| Lucide React    | 1.7     | Icons                             |
| Recharts        | 3.8     | Dashboard charts                  |
| Sonner          | 2.0     | Toast notifications               |
| next-themes     | 0.4     | Dark mode toggle                  |

### Backend
| Technology      | Version | Purpose                           |
| --------------- | ------- | --------------------------------- |
| Next.js API     | 16.2    | API routes + Server Actions       |
| PostgreSQL      | 17      | Database                          |
| Prisma          | 6.19    | ORM + migrations                  |
| jose            | 6.2     | JWT signing/verification (HS256)  |
| bcryptjs        | 3.0     | Password hashing                  |

### Tooling
| Technology      | Version | Purpose                           |
| --------------- | ------- | --------------------------------- |
| TypeScript      | 5       | Type safety                       |
| ESLint          | 9       | Linting                           |
| Turbopack       | -       | Fast dev server bundler           |

**No external services** — everything runs locally. No Supabase, no NextAuth, no cloud storage.

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (Homebrew: `brew install postgresql@17`)

### 1. Clone and Install

```bash
git clone <repo-url>
cd millenials-farm
npm install
```

### 2. Set Up Environment

Create a `.env` file:

```env
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/millenials_farm"
DIRECT_URL="postgresql://YOUR_USERNAME@localhost:5432/millenials_farm"
SESSION_SECRET="your-secret-key-change-in-production"
```

### 3. Set Up Database

```bash
# Create the database
createdb millenials_farm

# Push the schema to the database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed with sample data (2 users, 15 livestock, 11 pricing, 5 entries)
npx tsx prisma/seed.ts
```

### 4. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 and login with `admin` / `admin`.

### Useful Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run start        # Start production server
npx prisma studio    # Open database GUI at localhost:5555
npx prisma db push   # Sync schema to database
npx tsx prisma/seed.ts  # Re-seed sample data
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Login page, unauthorized page
│   ├── (dashboard)/
│   │   ├── admin/        # Admin pages (dashboard, livestock, entries, users, pricing)
│   │   └── sales/        # Sales pages (my entries, new entry)
│   ├── (public)/         # Landing page, catalogue
│   ├── actions/          # Server Actions (entries, livestock, pricing, users)
│   ├── api/              # API routes (auth, upload, livestock, payslip)
│   └── layout.tsx        # Root layout
├── components/
│   ├── dashboard/        # Dashboard components (sidebar, forms, tables)
│   └── ui/               # shadcn/ui components (button, card, input, etc.)
├── lib/
│   ├── auth.ts           # Server-side auth helpers (getProfile, requireAuth, requireRole)
│   ├── auth-middleware.ts # Route protection (JWT verification in proxy)
│   ├── format.ts         # Formatting utilities (Rupiah, dates, SKU, invoice)
│   ├── prisma.ts         # Prisma client singleton
│   ├── session.ts        # JWT session management (create, read, delete)
│   └── utils.ts          # Tailwind className merger (cn)
├── proxy.ts              # Next.js 16 proxy (replaces middleware.ts)
└── generated/prisma/     # Auto-generated Prisma client (do not edit)

prisma/
├── schema.prisma         # Database schema (models, enums, relations)
└── seed.ts               # Sample data seeder
```

## Database Schema

4 models: **Profile** (users), **Livestock** (animals), **Entry** (sales), **Pricing** (price list).

See `prisma/schema.prisma` for the full schema with all fields and relations.
