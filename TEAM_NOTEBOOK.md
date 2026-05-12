# 📘 Team Notebook: Plug-in EV Platform

> **INTERNAL DOCUMENT:** This notebook is for the team only. It contains everything you need to know to run the project, explain the code, and pitch the idea confidently to the judges.

## 🎯 1. Project Overview
**Name:** Plug-in
**Tagline:** Smart EV Charging Station Locator & Slot Booking
**Goal:** A premium, production-ready mobility prototype that solves range anxiety and charging station congestion in Bhopal.

## 📁 2. Folder Structure Explanation
```text
project/
├── frontend/             # The UI
│   ├── index.html        # Premium landing page with fade animations
│   ├── stations.html     # Interactive Leaflet JS Map and smart filtering
│   ├── my-bookings.html  # Secure dashboard to view/cancel slots using Vehicle No
│   ├── admin.html        # Secret panel to manage stations & see network load
│   ├── research.html     # IEEE concepts and roadmap (For Judges)
│   ├── style.css         # Minimal, premium design system
│   └── script.js         # API calls, Leaflet map logic, Geolocation, Range Safety Check
│
├── backend/              # The Server
│   ├── app.py            # Flask API with complete CRUD operations & Waitlist Logic
│   └── database/
│       └── seed.py       # Script to load Bhopal dummy data into MongoDB
```

## 🏗️ 3. Architecture & API Flow
We use a **Client-Server Architecture**.

*   **Frontend (HTML/JS):** Makes HTTP requests to the backend API. Uses Leaflet.js for interactive mapping. Distance is calculated dynamically using the **Haversine Formula** based on the user's real GPS location.
*   **Backend (Flask/Python):** Receives requests, queries MongoDB, and returns JSON data. Supports waitlisting if slots are full.
*   **Database (MongoDB):** Real-time data storage.

**Core API Endpoints:**
*   `GET /api/stations` - Fetch network.
*   `POST /api/bookings` - Create reservation (auto-decrements slot count) or joins waitlist if full.
*   `GET /api/bookings/vehicle/<vehicle_no>` - Securely lookup user bookings.
*   `DELETE /api/bookings/<id>` - Cancel reservation (auto-increments slot count if it was a confirmed slot).
*   `POST /api/stations` (Admin) - Deploy a new station to the map.

## 🗺️ 4. Leaflet & Geolocation Notes
We use a **Real Interactive Map using Leaflet.js** and **Real Geolocation**.
*   **Haversine Distance:** When the app loads, the exact browser coordinates are fetched. The frontend runs a Haversine formula to recalculate the exact distance from the user to every station, and automatically sorts the list to show the Nearest station first.
*   **Admin Automation:** Because distance and wait times depend on real-time traffic and location, the Admin Panel's "Deploy New Hub" feature omits these fields—they are handled dynamically by the system.
*   **Smart Navigation:** The "Navigate" button constructs a dynamic Google Maps Directions URL using the user's fetched latitude/longitude as the origin and the station's coordinates as the destination.

## 🧠 5. Presentation Notes & Tips (For Judges)
1. **The Premium Look:** Emphasize that the UI is designed like a real working product, not a chaotic hackathon project. Highlight the Accordion station cards and success modals.
2. **Real-time Engine & Waitlist:** Open two tabs. In one tab, book a slot until the station says "0 Slots Open". Show how the button changes to **"Join Waitlist"**. Book it, and show how the system correctly identifies it as a Waitlist rather than Confirmed.
3. **Security:** Show how `my-bookings.html` requires a **Vehicle Number** (not a name) to securely lookup and cancel active reservations, and allows direct **Google Maps Navigation**.
4. **Admin Panel "Simulate Traffic":** Show the judges the `admin.html` page. Click the **Simulate Traffic** button to instantly consume a slot somewhere on the network, proving the frontend dynamically updates based on API changes.

## 🐛 6. Debugging Notes
*   **"Stations aren't loading!"** -> Ensure your terminal running `app.py` is still active, and MongoDB is running.
*   **"Distance is 1000+ km!"** -> Since the database is seeded in Bhopal, if you test the geolocation feature from far away, the Haversine formula correctly calculates the huge distance! Explain this to the judges as proof the math works.

## 🤖 7. Code Explanation (Beginner Friendly)
If a judge asks "How does the Waitlist work?"
*   Open `app.py` -> `create_booking()`. Explain that we fetch the station's `slots_available`. If it's `> 0`, we decrement it and mark status as `confirmed`. If it's `<= 0`, we do NOT decrement, and mark status as `waitlisted`. The frontend dynamically reads this status to show the correct success modal.
