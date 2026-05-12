@echo off
echo Starting Backend (Flask)...
start cmd /k "cd backend && python app.py"

echo Starting Frontend (HTTP Server)...
start cmd /k "cd frontend && python -m http.server 8000"

echo Both servers are starting in new windows!
echo Once they are running, open your browser and go to http://localhost:8000
