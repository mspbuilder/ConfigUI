#!/bin/bash
#
# rebuild-backend.sh
# Utility script to completely rebuild the backend Docker container from scratch
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="/home/config-manager"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Change to project directory
cd "$PROJECT_DIR" || {
    log_error "Failed to change to project directory: $PROJECT_DIR"
    exit 1
}

log_info "Working directory: $(pwd)"

# Stop and remove containers completely
log_info "Stopping and removing containers..."
docker compose down

# Remove the old image
log_info "Removing old backend image..."
if docker image inspect config-manager-backend >/dev/null 2>&1; then
    docker rmi config-manager-backend
    log_info "Old image removed successfully"
else
    log_warn "Image 'config-manager-backend' not found, skipping removal"
fi

# Rebuild from scratch
log_info "Rebuilding backend from scratch (no cache)..."
docker compose build --no-cache backend

# Start everything
log_info "Starting all services..."
docker compose up -d

log_info "Rebuild complete! Following backend logs (Ctrl+C to exit)..."
echo ""

# Watch logs
docker compose logs -f backend
