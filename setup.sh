#!/bin/bash

echo "🚀 Setting up Ride Dispatch System..."

# Create backend virtual environment
echo "📦 Setting up Python backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..

# Setup frontend
echo "⚛️ Setting up React frontend..."
cd frontend
npm install
cd ..

echo "✅ Setup complete!"
echo ""
echo "To run the system:"
echo "1. Start the backend: cd backend && source venv/bin/activate && uvicorn main:app --reload"
echo "2. Start the frontend: cd frontend && npm start"
echo ""
echo "The frontend will be available at http://localhost:3000"
echo "The backend API will be available at http://localhost:8000"
