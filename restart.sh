#!/bin/bash
# Restart script for Vite dev server with full cache clear
# Usage: ./restart.sh [--full]

set -e

echo "🛑 Stopping any running Vite processes..."
pkill -f vite 2>/dev/null || true
sleep 1

echo "🧹 Clearing build cache..."
rm -rf node_modules/.vite 
rm -rf node_modules/.cache
rm -rf dist
rm -rf .temp
rm -rf .tmp

if [ "$1" = "--full" ]; then
  echo "🔍 Running TypeScript check..."
  npx tsc --noEmit 2>/dev/null || echo "⚠️ TypeScript check completed with warnings"
fi

echo "🚀 Starting dev server..."
echo ""
vite
