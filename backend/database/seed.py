from pymongo import MongoClient
import os

def seed_database():
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
    client = MongoClient(MONGO_URI)
    db = client['ev_platform']
    
    # Clear existing collections to start fresh
    db.stations.drop()
    db.bookings.drop()
    
    # Dummy data for Bhopal EV Charging Stations
    stations = [
        {
            "name": "MP Nagar Fast Charger Hub",
            "lat": 23.2332,
            "lng": 77.4343,
            "distance": "1.2 km",
            "slots_available": 3,
            "total_slots": 4,
            "wait_time": "5 mins",
            "type": "DC Fast Charging (50kW)",
            "address": "Zone-I, Maharana Pratap Nagar, Bhopal",
            "price_per_kwh": 18.5
        },
        {
            "name": "Bhopal Junction EV Point",
            "lat": 23.2681,
            "lng": 77.4144,
            "distance": "3.5 km",
            "slots_available": 1,
            "total_slots": 3,
            "wait_time": "20 mins",
            "type": "Level 2 AC (22kW)",
            "address": "Railway Station Road, Bhopal",
            "price_per_kwh": 14.0
        },
        {
            "name": "Habibganj Smart Station",
            "lat": 23.2185,
            "lng": 77.4334,
            "distance": "0.8 km",
            "slots_available": 0,
            "total_slots": 5,
            "wait_time": "45 mins",
            "type": "DC Ultra-Fast (150kW)",
            "address": "Rani Kamlapati Railway Station, Bhopal",
            "price_per_kwh": 22.0
        },
        {
            "name": "DB City Mall Charging Zone",
            "lat": 23.2325,
            "lng": 77.4300,
            "distance": "1.5 km",
            "slots_available": 4,
            "total_slots": 4,
            "wait_time": "No wait",
            "type": "Level 2 AC (7.2kW)",
            "address": "DB City Mall Basement Parking, MP Nagar",
            "price_per_kwh": 15.5
        },
        {
            "name": "BHEL Township Eco Charge",
            "lat": 23.2450,
            "lng": 77.4720,
            "distance": "5.0 km",
            "slots_available": 2,
            "total_slots": 2,
            "wait_time": "10 mins",
            "type": "DC Fast Charging (25kW)",
            "address": "BHEL Piplani, Bhopal",
            "price_per_kwh": 16.0
        }
    ]
    
    db.stations.insert_many(stations)
    print(f"Successfully seeded {len(stations)} stations into the database.")

if __name__ == '__main__':
    print("Seeding database...")
    seed_database()
    print("Done.")
