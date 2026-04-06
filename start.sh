#!/bin/bash

# Photo Map - Full Stack Startup Script
# Starts both Angular frontend and Statamic backend

echo "🚀 Photo Map - Starting Full Stack Application"
echo "================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "src" ]; then
    echo -e "${RED}❌ Error: Run this script from the project root directory${NC}"
    echo "   Current: $(pwd)"
    exit 1
fi

# Function to handle cleanup on exit
cleanup() {
    echo -e "${YELLOW}\n⏹️  Shutting down services...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set trap to catch signals
trap cleanup SIGINT SIGTERM

# Start Backend
echo -e "${GREEN}1. Starting Statamic Backend (port 8000)...${NC}"
cd backend
php artisan serve --host=localhost --port=8000 &
BACKEND_PID=$!
cd ..

# Give backend time to start
sleep 3

# Start Frontend
echo -e "${GREEN}2. Starting Angular Frontend (port 4200)...${NC}"
ng serve &
FRONTEND_PID=$!

# Wait a bit for frontend to start
sleep 5

echo ""
echo -e "${GREEN}✅ Full Stack Ready!${NC}"
echo ""
echo "URLs:"
echo -e "  Frontend:  ${GREEN}http://localhost:4200${NC}"
echo -e "  Backend:   ${GREEN}http://localhost:8000${NC}"
echo -e "  Admin:     ${GREEN}http://localhost:8000/cp${NC}"
echo ""
echo "Press Ctrl+C to shutdown both services"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
