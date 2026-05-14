from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime
import os
import json

app = Flask(__name__)
CORS(app)

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
client = MongoClient(MONGO_URI)
db = client['ev_platform']
stations_collection = db['stations']
bookings_collection = db['bookings']

def time_to_mins(t_str):
    try:
        h, m = map(int, t_str.split(':'))
        return h * 60 + m
    except:
        return 0

@app.route('/api/stations', methods=['GET'])
def get_stations():
    time_filter = request.args.get('time')
    stations = []
    for station in stations_collection.find():
        station['_id'] = str(station['_id'])
        
        # Use total_slots if exists, otherwise fallback to slots_available as max capacity
        total_slots = station.get('total_slots', station.get('slots_available', 0))
        
        if time_filter:
            filter_mins = time_to_mins(time_filter)
            # Find confirmed bookings where the requested time falls within the booking's duration
            overlapping_bookings = list(bookings_collection.find({
                "station_id": station['_id'],
                "status": "confirmed",
                "start_time_mins": {"$lte": filter_mins},
                "end_time_mins": {"$gt": filter_mins}
            }))
            occupied_slots = [b.get('assigned_slot') for b in overlapping_bookings if b.get('assigned_slot')]
            current_slots = total_slots - len(occupied_slots)
            station['occupied_slots'] = occupied_slots
            
            if current_slots <= 0 and overlapping_bookings:
                earliest_end_mins = min([b.get('end_time_mins') for b in overlapping_bookings])
                h = earliest_end_mins // 60
                m = earliest_end_mins % 60
                station['next_available_time'] = f"{h:02d}:{m:02d}"
        else:
            # If no time selected, return total capacity
            current_slots = total_slots
            station['occupied_slots'] = []
            
        station['slots_available'] = max(0, current_slots)
        # Ensure total_slots is returned
        station['total_slots'] = total_slots
        stations.append(station)
    return jsonify({"status": "success", "data": stations}), 200

@app.route('/api/stations', methods=['POST'])
def add_station():
    data = request.json
    required_fields = ['name', 'lat', 'lng', 'slots_available', 'type', 'address', 'price_per_kwh']
    if not all(field in data for field in required_fields):
        return jsonify({"status": "error", "message": "Missing fields"}), 400
    
    # Distance and Wait Time are dynamically calculated on the frontend, so set defaults if missing
    data['distance'] = data.get('distance', "Calculating...")
    data['wait_time'] = data.get('wait_time', "0 mins")
    data['total_slots'] = int(data.get('slots_available', 0))
    
    result = stations_collection.insert_one(data)
    data['_id'] = str(result.inserted_id)
    return jsonify({"status": "success", "data": data}), 201

@app.route('/api/stations/<station_id>', methods=['DELETE'])
def delete_station(station_id):
    result = stations_collection.delete_one({"_id": ObjectId(station_id)})
    if result.deleted_count:
        return jsonify({"status": "success", "message": "Station deleted"}), 200
    return jsonify({"status": "error", "message": "Station not found"}), 404

@app.route('/api/stations/<station_id>/slots', methods=['PUT'])
def update_slots(station_id):
    data = request.json
    if 'slots_available' not in data:
        return jsonify({"status": "error", "message": "Missing slots_available"}), 400
        
    result = stations_collection.update_one(
        {"_id": ObjectId(station_id)},
        {"$set": {
            "slots_available": int(data['slots_available']),
            "total_slots": int(data['slots_available'])
        }}
    )
    if result.modified_count:
        return jsonify({"status": "success", "message": "Slots updated"}), 200
    return jsonify({"status": "error", "message": "Station not found or slots unchanged"}), 404

@app.route('/api/bookings', methods=['POST'])
def create_booking():
    data = request.json
    if not data or not data.get('station_id') or not data.get('time_slot') or not data.get('user_name'):
        return jsonify({"status": "error", "message": "Missing required fields"}), 400
    
    # Check if station exists
    station = stations_collection.find_one({"_id": ObjectId(data['station_id'])})
    if not station:
        return jsonify({"status": "error", "message": "Station not found"}), 404

    total_slots = station.get('total_slots', station.get('slots_available', 0))
    time_slot = data['time_slot']
    duration = int(data.get('duration', 30))
    start_time_mins = time_to_mins(time_slot)
    end_time_mins = start_time_mins + duration

    # Find existing confirmed bookings that overlap with this time window
    overlapping_bookings = list(bookings_collection.find({
        "station_id": data['station_id'],
        "status": "confirmed",
        "start_time_mins": {"$lt": end_time_mins},
        "end_time_mins": {"$gt": start_time_mins}
    }))
    
    occupied_slot_numbers = [b.get('assigned_slot') for b in overlapping_bookings if b.get('assigned_slot')]
    
    assigned_slot = None
    for i in range(1, total_slots + 1):
        if i not in occupied_slot_numbers:
            assigned_slot = i
            break

    if assigned_slot is None:
        return jsonify({"status": "error", "message": "Can't be booked until the time a slot in that station gets free."}), 400

    status = "confirmed"

    booking = {
        "station_id": data['station_id'],
        "station_name": data.get('station_name', 'Unknown Station'),
        "user_name": data['user_name'],
        "vehicle_no": data.get('vehicle_no', ''),
        "time_slot": data['time_slot'],
        "duration": duration,
        "start_time_mins": start_time_mins,
        "end_time_mins": end_time_mins,
        "assigned_slot": assigned_slot,
        "status": status,
        "booking_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    result = bookings_collection.insert_one(booking)
    
    # We no longer decrement static slots_available here because availability is time-based.
    
    booking['_id'] = str(result.inserted_id)
    return jsonify({"status": "success", "message": "Booking successful", "data": booking}), 201

@app.route('/api/bookings', methods=['GET'])
def get_all_bookings():
    bookings = []
    for booking in bookings_collection.find():
        booking['_id'] = str(booking['_id'])
        bookings.append(booking)
    return jsonify({"status": "success", "data": bookings}), 200

@app.route('/api/bookings/vehicle/<vehicle_no>', methods=['GET'])
def get_user_bookings(vehicle_no):
    bookings = []
    # Case-insensitive search or exact match
    for booking in bookings_collection.find({"vehicle_no": vehicle_no}):
        booking['_id'] = str(booking['_id'])
        bookings.append(booking)
    return jsonify({"status": "success", "data": bookings}), 200

@app.route('/api/bookings/<booking_id>', methods=['DELETE'])
def cancel_booking(booking_id):
    booking = bookings_collection.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        return jsonify({"status": "error", "message": "Booking not found"}), 404
        
    result = bookings_collection.delete_one({"_id": ObjectId(booking_id)})
    
    if result.deleted_count:
        # We no longer increment static slots_available here because availability is time-based.
        return jsonify({"status": "success", "message": "Booking cancelled"}), 200
    return jsonify({"status": "error", "message": "Failed to cancel"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
