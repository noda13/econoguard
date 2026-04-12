#!/bin/sh

echo "Running Prisma migrations..."
pnpm prisma migrate deploy || echo "Migration failed or already exists"

echo "Seeding database (if empty)..."
pnpm run prisma:seed

echo "Starting Econoguard server..."
pnpm run dev
