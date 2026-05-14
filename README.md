# Plug-in: Smart EV Charging Platform MVP

A clean, beginner-friendly EV charging station locator and slot booking platform built for Bhopal, India.

## Tech Stack
*   **Frontend:** HTML, CSS, JavaScript
*   **Backend:** Python (Flask)
*   **Database:** MongoDB
*   **Mapping:** Google Maps Embed (Placeholder)

## Prerequisites
1.  Python 3.x installed
2.  MongoDB installed and running locally on default port `27017`

## Setup Instructions

### 1. Database Setup
First, ensure MongoDB is running. Then, install the required python packages and seed the database with sample Bhopal stations:

```bash
pip install pymongo flask flask-cors

# Navigate to the database folder and run the seeder
cd backend/database
python seed.py
```
You should see a success message indicating stations were added.

### 2. Start the Backend API
```bash
# Navigate back to the backend folder
cd ..
python app.py
```
The Flask server will start running on `http://localhost:5000`.

### 3. Run the Frontend
Because we are making API requests, you shouldn't just double-click the HTML files. Run them using a simple local server.

If you have VS Code, use the **Live Server** extension on `frontend/index.html`.
Alternatively, you can run Python's built-in server in a new terminal:
```bash
cd frontend
python -m http.server 8000
```
Then visit `http://localhost:8000` in your browser.

## Features
*   View charging stations in Bhopal.
*   See real-time slot availability, distance, pricing, and wait times.
*   **Range Safety Check:** Instantly calculate if you have enough battery to reach the station.
*   **Smart Navigation:** Direct Google Maps integration routing from your real-time GPS location.
*   Book a charging slot in advance or join a waitlist.
*   Research & Vision page outlining IEEE concepts and future scope.

## Note for Team
Please read the `TEAM_NOTEBOOK.md` file for an in-depth breakdown of the architecture, pitch points, and how to present this effectively to judges.

Team Current Crew

Members:
- Yatin Ghuriyani
- Suryansh Soni
- Uday Sharma
- Shubhi Nema
- Tanishq Agarwal
