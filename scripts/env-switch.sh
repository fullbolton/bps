#!/bin/bash
# BPS — Local environment switching helper
#
# Switches .env.local between production and demo profiles.
# Local-only convenience. Does not touch Vercel or remote config.
#
# Usage:
#   ./scripts/env-switch.sh prod    — activate production env
#   ./scripts/env-switch.sh demo    — activate demo env
#   ./scripts/env-switch.sh status  — show current active env
#
# Safety:
#   - Only copies local files, never deletes originals
#   - Requires named profile files to exist
#   - Shows clear confirmation of what changed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENV_LOCAL="$PROJECT_ROOT/.env.local"
ENV_PROD="$PROJECT_ROOT/.env.prod.local"
ENV_DEMO="$PROJECT_ROOT/.env.demo-app.local"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

show_status() {
  if [ ! -f "$ENV_LOCAL" ]; then
    echo -e "${YELLOW}No .env.local found — no active environment${NC}"
    return
  fi

  # Check which profile matches
  if [ -f "$ENV_PROD" ] && diff -q "$ENV_LOCAL" "$ENV_PROD" > /dev/null 2>&1; then
    echo -e "${GREEN}Active environment: PRODUCTION${NC}"
  elif [ -f "$ENV_DEMO" ] && diff -q "$ENV_LOCAL" "$ENV_DEMO" > /dev/null 2>&1; then
    echo -e "${YELLOW}Active environment: DEMO${NC}"
  else
    echo -e "${RED}Active environment: CUSTOM (does not match any profile)${NC}"
  fi

  echo ""
  echo "Profile files:"
  [ -f "$ENV_PROD" ] && echo "  .env.prod.local     — exists" || echo "  .env.prod.local     — MISSING"
  [ -f "$ENV_DEMO" ] && echo "  .env.demo-app.local — exists" || echo "  .env.demo-app.local — MISSING"
}

switch_env() {
  local target="$1"
  local source_file

  case "$target" in
    prod|production)
      source_file="$ENV_PROD"
      target="PRODUCTION"
      ;;
    demo)
      source_file="$ENV_DEMO"
      target="DEMO"
      ;;
    *)
      echo -e "${RED}Unknown target: $1${NC}"
      echo "Usage: $0 {prod|demo|status}"
      exit 1
      ;;
  esac

  if [ ! -f "$source_file" ]; then
    echo -e "${RED}Profile file not found: $(basename "$source_file")${NC}"
    echo ""
    echo "Create it first:"
    echo "  cp .env.local $(basename "$source_file")"
    echo "  # then edit with the correct values"
    exit 1
  fi

  # Safety: warn if current .env.local has unsaved changes
  if [ -f "$ENV_LOCAL" ]; then
    if [ -f "$ENV_PROD" ] && ! diff -q "$ENV_LOCAL" "$ENV_PROD" > /dev/null 2>&1; then
      if [ -f "$ENV_DEMO" ] && ! diff -q "$ENV_LOCAL" "$ENV_DEMO" > /dev/null 2>&1; then
        echo -e "${YELLOW}Warning: current .env.local does not match any profile.${NC}"
        echo -e "${YELLOW}If you have custom changes, back them up first.${NC}"
        echo ""
        read -p "Continue? [y/N] " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
          echo "Aborted."
          exit 0
        fi
      fi
    fi
  fi

  cp "$source_file" "$ENV_LOCAL"
  echo -e "${GREEN}Switched to $target${NC}"
  echo ""
  echo "Active .env.local now points to: $target"
  echo "Restart dev server to pick up changes: npm run dev"
}

# Main
case "${1:-status}" in
  status)
    show_status
    ;;
  prod|production|demo)
    switch_env "$1"
    ;;
  *)
    echo "Usage: $0 {prod|demo|status}"
    exit 1
    ;;
esac
