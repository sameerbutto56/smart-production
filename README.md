# Smart Production & Order Tracking System

A full-stack production workflow management system integrated with Shopify.

## Tech Stack
- **Frontend**: React, Tailwind CSS, Framer Motion, Lucide React
- **Backend**: Node.js, Express, Prisma ORM, PostgreSQL, Socket.io
- **Auth**: JWT-based role-based access control

## Getting Started

### Prerequisites
- Node.js (v16+)
- PostgreSQL instance

### Backend Setup
1. `cd backend`
2. `npm install`
3. Update `.env` with your `DATABASE_URL`.
4. `npx prisma migrate dev --name init`
5. `npm run seed` (to create default users)
6. `npm run dev`

### Frontend Setup
1. `cd frontend`
2. `npm install`
3. `npm run dev`

### Default Login (Seed Data)
- **Admin**: `admin@smartpro.com` / `password123`
- **Cutting Employee**: `cutting_employee@smartpro.com` / `password123`
- **Stitching Employee**: `stitching_employee@smartpro.com` / `password123`
- (All roles follow this pattern)

## Features
- **Role-based Dashboards**: Custom views for Admin, Store, Cutting, Stitching, Quality, Pressing, Packaging.
- **Conveyor Belt Workflow**: Orders move step-by-step through departments.
- **Real-time Tracking**: Live updates via Socket.io.
- **Deadline Management**: Timers that respect 8 AM - 8 PM working hours.
- **Shopify Sync**: Automatic ingestion of orders from Shopify.
- **Urgent Handling**: Blue-tagged priority orders with shorter deadlines.
