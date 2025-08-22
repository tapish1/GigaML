#!/bin/bash

echo "🚀 Starting Ride Dispatch System..."

# Start backend in background
echo "📦 Starting FastAPI backend..."
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "⚛️ Starting React frontend..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo "✅ Both services started!"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both services"

# Wait for user to stop
trap "echo '🛑 Stopping services...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
