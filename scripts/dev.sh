#!/usr/bin/env bash
set -e

echo ""
echo "⚡  Startline — starting local dev environment..."
echo ""

if command -v docker &> /dev/null; then
  if docker compose ps --status running 2>/dev/null | grep -q "startline-postgres"; then
    echo "→ PostgreSQL is already running"
  else
    echo "→ Starting PostgreSQL via Docker..."
    docker compose up -d
    echo "→ Waiting for PostgreSQL to be ready..."
    until docker compose exec -T postgres pg_isready -U postgres &>/dev/null; do
      sleep 1
    done
    echo "→ PostgreSQL is ready"
  fi
else
  echo "⚠ Docker not found — skipping database. Install Docker or start PostgreSQL manually."
fi

echo ""
echo "→ Generating Prisma client..."
pnpm prisma:generate

echo ""
echo "→ Starting Next.js dev server..."
echo "   http://localhost:3000"
echo ""

exec pnpm dev
