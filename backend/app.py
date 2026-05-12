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

@app.route('/api/stations', methods=['GET'])
def get_stations():
    stations = []
    for station in stations_collection.find():
        station['_id'] = str(station['_id'])
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
        {"$set": {"slots_available": int(data['slots_available'])}}
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

    status = "confirmed"
    is_waitlisted = False
    if station.get('slots_available', 0) <= 0:
        status = "waitlisted"
        is_waitlisted = True

    booking = {
        "station_id": data['station_id'],
        "station_name": data.get('station_name', 'Unknown Station'),
        "user_name": data['user_name'],
        "vehicle_no": data.get('vehicle_no', ''),
        "time_slot": data['time_slot'],
        "status": status,
        "booking_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    result = bookings_collection.insert_one(booking)
    
    # Only decrease slots if confirmed
    if not is_waitlisted:
        stations_collection.update_one(
            {"_id": ObjectId(data['station_id'])},
            {"$inc": {"slots_available": -1}}
        )
    
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
        # Increase slots back ONLY if it was confirmed, not waitlisted
        if booking.get('status') == 'confirmed':
            stations_collection.update_one(
                {"_id": ObjectId(booking['station_id'])},
                {"$inc": {"slots_available": 1}}
            )
        return jsonify({"status": "success", "message": "Booking cancelled"}), 200
    return jsonify({"status": "error", "message": "Failed to cancel"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
