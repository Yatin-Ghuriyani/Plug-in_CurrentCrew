const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000/api' : '/api';

// DOM Elements
const stationsContainer = document.getElementById('stations-container');
const bookingModal = document.getElementById('booking-modal');
const successModal = document.getElementById('success-modal');
const bookingForm = document.getElementById('booking-form');
const pageLoader = document.getElementById('page-loader');

let map;
let stationMarkers = [];
let allStations = [];
let userLocation = null;
let userMarker = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Remove loader after brief delay for premium feel
    if (pageLoader) {
        setTimeout(() => {
            pageLoader.classList.add('hidden');
            // Trigger fade-up animations
            document.querySelectorAll('.fade-up').forEach(el => el.classList.add('visible'));
        }, 800);
    }

    if (document.getElementById('map')) {
        // Initialize time filter to current time
        const timeFilter = document.getElementById('time-filter');
        if (timeFilter) {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            timeFilter.value = `${hh}:${mm}`;
            
            // Re-fetch stations when time changes
            timeFilter.addEventListener('change', () => {
                fetchStations();
            });
        }

        initMap();
        fetchStations();
        setupFilters();
        
        document.getElementById('use-location-btn').addEventListener('click', getUserLocation);
        
        // Auto-fetch location on load
        getUserLocation();
    }

    if (bookingForm) {
        bookingForm.addEventListener('submit', handleBookingSubmit);
    }
});

// Map Initialization
function initMap() {
    // Center on Bhopal by default
    map = L.map('map').setView([23.2599, 77.4126], 12);
    
    // Add subtle, clean tiles (CartoDB Positron gives a premium clean look)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
}

// Fetch Stations
async function fetchStations() {
    try {
        let url = `${API_BASE_URL}/stations`;
        const timeFilter = document.getElementById('time-filter');
        if (timeFilter && timeFilter.value) {
            url += `?time=${encodeURIComponent(timeFilter.value)}`;
        }
        
        const response = await fetch(url);
        const result = await response.json();

        if (result.status === 'success') {
            allStations = result.data;
            renderStations(allStations);
            updateMapMarkers(allStations);
        } else {
            showError('Failed to load stations network.');
        }
    } catch (error) {
        console.error('Error fetching stations:', error);
        showError('Could not connect to the network. Please verify connection.');
    }
}

// Render Stations List
function renderStations(stations) {
    if (!stationsContainer) return;
    
    stationsContainer.innerHTML = '';

    if (stations.length === 0) {
        stationsContainer.innerHTML = '<p class="text-center" style="color: var(--text-secondary); margin-top: 2rem;">No charging stations match your criteria.</p>';
        return;
    }

    stations.forEach(station => {
        // Status logic
        let statusClass, statusText;
        if (station.slots_available > 2) {
            statusClass = 'tag-success'; statusText = 'Available';
        } else if (station.slots_available > 0) {
            statusClass = 'tag-warning'; statusText = 'Busy';
        } else {
            statusClass = 'tag-error'; statusText = 'Full';
        }
        
        let displayWaitTime = station.slots_available > 0 ? "0 mins" : station.wait_time;

        const card = document.createElement('div');
        card.className = 'station-card';
        
        let slotsHtml = '';
        const total = station.total_slots || 0;
        const occupied = station.occupied_slots || [];
        for (let i = 1; i <= total; i++) {
            const isOccupied = occupied.includes(i);
            const bgColor = isOccupied ? '#FEE2E2' : '#D1FAE5';
            const textColor = isOccupied ? '#EF4444' : '#059669';
            const borderColor = isOccupied ? '#FCA5A5' : '#6EE7B7';
            slotsHtml += `<div style="background: ${bgColor}; color: ${textColor}; border: 1px solid ${borderColor}; border-radius: 4px; padding: 0.4rem 0; text-align: center; font-size: 0.85rem; font-weight: 600;">${i}</div>`;
        }
        
        const occupancyPercent = total > 0 ? (occupied.length / total) * 100 : 0;

        card.innerHTML = `
            <div class="station-header" style="cursor: pointer; margin-bottom: 0;" onclick="toggleStationDetails('${station._id}')">
                <div style="flex: 1;">
                    <h3 class="station-name">${station.name}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem;">${station.address}</p>
                </div>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span class="station-distance">${station.distance}</span>
                    <svg id="icon-${station._id}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2" style="transition: transform 0.3s;"><path d="M6 9l6 6 6-6"/></svg>
                </div>
            </div>
            
            <div id="details-${station._id}" class="station-body" style="display: none; padding-top: 1rem; border-top: 1px solid var(--border-color); margin-top: 1rem;">
                <div class="station-details" style="margin-bottom: 1.25rem;">
                    <div class="detail-item">
                        <span class="tag ${statusClass}">● ${statusText}</span>
                    </div>
                    <div class="detail-item">
                        <span style="font-weight: 500;">${station.slots_available}/${station.total_slots}</span> <span style="color: var(--text-secondary)">Slots Open</span>
                    </div>
                    <div class="detail-item">
                        <span style="color: var(--text-secondary)">⚡</span> ${station.type}
                    </div>
                    <div class="detail-item">
                        <span style="color: var(--text-secondary)">⏱️</span> Wait: ${displayWaitTime}
                    </div>
                </div>
                
                <h4 style="margin-bottom: 0.5rem; font-size: 1rem; color: #374151;">Live Occupancy</h4>
                <div style="width: 100%; height: 10px; background: #E5E7EB; border-radius: 5px; margin-bottom: 1rem; overflow: hidden;">
                    <div style="width: ${occupancyPercent}%; height: 100%; background: linear-gradient(90deg, #F59E0B, #EF4444); transition: width 0.3s ease;"></div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(30px, 1fr)); gap: 0.4rem; margin-bottom: 1.5rem;">
                    ${slotsHtml}
                </div>
                
                <div class="live-activity" style="margin-bottom: 0.75rem;">
                    <div class="pulse-dot"></div>
                    <span style="flex:1;">${occupied.length} vehicles charging currently</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 1.25rem; padding: 0.75rem; background: var(--background-color); border-radius: var(--radius-sm);">
                    <span>🔄 Updated ${Math.floor(Math.random() * 5) + 1} min ago</span>
                    <span>📈 Peak: 6 PM - 8 PM</span>
                </div>
                
                <div class="card-actions">
                    <button class="btn" style="flex: 2; width: 100%;" 
                        onclick="event.stopPropagation(); ${station.slots_available === 0 ? `alert('Can\\'t be booked until the time a slot in that station gets free.')` : `openBookingModal('${station._id}', '${station.name}', '${station.distance}')`}">
                        ${station.slots_available === 0 ? (station.next_available_time ? `Available at ${station.next_available_time}` : 'Station Full') : 'Reserve Slot'}
                    </button>
                    <a href="#" class="btn-outline" onclick="openNavigation(event, ${station.lat}, ${station.lng}, '${station.name}')">
                        Navigate
                    </a>
                </div>
            </div>
        `;
        
        stationsContainer.appendChild(card);
    });
}

function toggleStationDetails(id) {
    const details = document.getElementById(`details-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    } else {
        details.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

// Update Map Markers
function updateMapMarkers(stations) {
    if (!map) return;
    
    // Clear existing
    stationMarkers.forEach(marker => map.removeLayer(marker));
    stationMarkers = [];

    stations.forEach(station => {
        // Custom premium marker icon
        const iconColor = station.slots_available > 0 ? '#0F62FE' : '#EF4444';
        const customIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: ${iconColor}; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        const marker = L.marker([station.lat, station.lng], {icon: customIcon}).addTo(map);
        
        // Popup
        marker.bindPopup(`
            <div style="font-family: 'Inter', sans-serif; padding: 5px; min-width: 150px;">
                <h4 style="margin: 0 0 5px 0; color: #111827;">${station.name}</h4>
                <p style="margin: 0 0 5px 0; font-size: 12px; color: #4B5563;">${station.type}</p>
                <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 600; color: ${station.slots_available > 0 ? '#10B981' : '#EF4444'}">${station.slots_available} Slots Available</p>
                <button class="btn" style="width: 100%; padding: 0.4rem; font-size: 0.85rem;" 
                    onclick="${station.slots_available === 0 ? `alert('Can\\'t be booked until the time a slot in that station gets free.')` : `openBookingModal('${station._id}', '${station.name}', '${station.distance}')`}">
                    ${station.slots_available === 0 ? (station.next_available_time ? `Available at ${station.next_available_time}` : 'Station Full') : 'Reserve Slot'}
                </button>
            </div>
        `);
        
        stationMarkers.push(marker);
    });
}

// Distance Calculation Helpers
function deg2rad(deg) { return deg * (Math.PI/180); }

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; 
    return d.toFixed(1); 
}

// User Geolocation
function getUserLocation() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
    }

    const btn = document.getElementById('use-location-btn');
    btn.style.opacity = '0.5';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            btn.style.opacity = '1';
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            userLocation = { lat, lng };

            map.setView([lat, lng], 13);

            if (userMarker) map.removeLayer(userMarker);

            const userIcon = L.divIcon({
                className: 'user-div-icon',
                html: `<div style="background-color: #3B82F6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            userMarker = L.marker([lat, lng], {icon: userIcon}).addTo(map);
            userMarker.bindPopup('<b>Your Live Location</b>').openPopup();
            
            // Recalculate all distances based on real location
            allStations.forEach(station => {
                station.distance = calculateDistance(lat, lng, station.lat, station.lng) + " km";
            });
            
            // Re-render markers and force Nearest sort
            updateMapMarkers(allStations);
            const nearestBtn = document.querySelector('[data-sort="nearest"]');
            if(nearestBtn) nearestBtn.click();
        },
        (error) => {
            btn.style.opacity = '1';
            console.error("Geolocation error:", error);
            alert("Unable to retrieve your location. Please check browser permissions.");
        }
    );
}

// Filters & Sorting
function setupFilters() {
    const filterBtns = document.querySelectorAll('.filter-pill');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const sortType = e.target.getAttribute('data-sort');
            applySort(sortType);
        });
    });
}

function applySort(type) {
    let sortedStations = [...allStations];
    
    switch(type) {
        case 'fastest':
            // Simple mock: Sort by 'DC' vs 'AC'
            sortedStations.sort((a, b) => {
                if (a.type.includes('DC') && !b.type.includes('DC')) return -1;
                if (!a.type.includes('DC') && b.type.includes('DC')) return 1;
                return 0;
            });
            break;
        case 'price':
            sortedStations.sort((a, b) => a.price_per_kwh - b.price_per_kwh);
            break;
        case 'wait':
            sortedStations.sort((a, b) => {
                const getWaitInt = (waitStr) => waitStr.includes('No wait') ? 0 : parseInt(waitStr.replace(/[^0-9]/g, '')) || 99;
                return getWaitInt(a.wait_time) - getWaitInt(b.wait_time);
            });
            break;
        case 'nearest':
            // Mock sort based on the string value (e.g. "1.2 km")
            sortedStations.sort((a, b) => {
                const getDist = (d) => parseFloat(d.replace(/[^0-9.]/g, ''));
                return getDist(a.distance) - getDist(b.distance);
            });
            break;
        default:
            // default is original fetch order
            break;
    }
    
    renderStations(sortedStations);
}

// Modal Functions
function openBookingModal(stationId, stationName, stationDistance) {
    document.getElementById('station-id').value = stationId;
    document.getElementById('station-name-hidden').value = stationName;
    if(document.getElementById('station-distance-hidden')) document.getElementById('station-distance-hidden').value = stationDistance || '10';
    document.getElementById('station-name').value = stationName;
    
    // Sync booking time with time filter if available
    const timeFilter = document.getElementById('time-filter');
    if (timeFilter && timeFilter.value) {
        document.getElementById('time-slot').value = timeFilter.value;
    }
    
    const modal = document.getElementById('booking-modal');
    modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) {
        modal.classList.remove('active');
    }
    if (modalId === 'booking-modal') {
        bookingForm.reset();
    }
}

// Handle booking submission
async function handleBookingSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-booking-btn');
    submitBtn.innerText = 'Processing...';
    submitBtn.disabled = true;

    const bookingData = {
        station_id: document.getElementById('station-id').value,
        station_name: document.getElementById('station-name-hidden').value,
        user_name: document.getElementById('user-name').value,
        vehicle_no: document.getElementById('vehicle-no').value,
        time_slot: document.getElementById('time-slot').value,
        duration: document.getElementById('duration') ? document.getElementById('duration').value : 30
    };

    try {
        const response = await fetch(`${API_BASE_URL}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });

        const result = await response.json();

        if (result.status === 'success') {
            closeModal('booking-modal');
            
            // Find selected station to grab details for modal
            const selectedStation = allStations.find(s => s._id === bookingData.station_id);
            
            // Adjust title
            const modalTitle = document.querySelector('#success-modal .modal-title');
            const modalDesc = document.querySelector('#success-modal p');
            
            modalTitle.innerText = 'Booking Confirmed!';
            modalDesc.innerText = 'Your charging slot has been successfully reserved.';
            
            let confWaitTime = selectedStation ? (selectedStation.slots_available > 0 ? "0 mins" : selectedStation.wait_time) : 'Calculating...';
            
            // Show Success Modal
            document.getElementById('conf-station').innerText = result.data.station_name;
            document.getElementById('conf-time').innerText = result.data.time_slot;
            document.getElementById('conf-type').innerText = selectedStation ? selectedStation.type : 'Standard DC';
            document.getElementById('conf-wait').innerText = confWaitTime;
            document.getElementById('conf-id').innerText = result.data._id.substring(0, 8).toUpperCase();
            
            document.getElementById('success-modal').classList.add('active');
            
            // Refresh station data to update slots immediately
            fetchStations(); 
        } else {
            alert(`Error: ${result.message}`);
        }
    } catch (error) {
        console.error('Booking error:', error);
        alert('An error occurred while booking. Please try again.');
    } finally {
        submitBtn.innerText = 'Confirm Reservation';
        submitBtn.disabled = false;
    }
}

function showError(message) {
    if(stationsContainer) {
        stationsContainer.innerHTML = `<p style="color: var(--error-color); text-align: center; padding: 2rem;">${message}</p>`;
    }
}

function openNavigation(e, destLat, destLng, destName) {
    if(e) e.stopPropagation();
    if(e) e.preventDefault();
    let dest = (destLat && destLng) ? `${destLat},${destLng}` : encodeURIComponent(destName + ' Bhopal');
    let url = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    if (userLocation) {
        url += `&origin=${userLocation.lat},${userLocation.lng}`;
    }
    window.open(url, '_blank');
}

function promptAdmin(e) {
    if (e) e.preventDefault();
    
    if (!document.getElementById('admin-modal-custom')) {
        const modalHtml = `
        <div class="modal-overlay" id="admin-modal-custom" style="z-index: 10000; align-items: center; display: flex;">
            <div class="modal" style="text-align: center; max-width: 350px;">
                <h3 class="modal-title" style="margin-bottom: 1rem;">Admin Access</h3>
                <input type="password" id="admin-password-input" class="form-control" placeholder="Enter Password" style="margin-bottom: 1rem;">
                <button class="btn" style="width: 100%;" onclick="submitAdminPassword()">Login</button>
                <button class="btn-outline" style="width: 100%; margin-top: 0.5rem;" onclick="closeAdminModal()">Cancel</button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    const adminModal = document.getElementById('admin-modal-custom');
    adminModal.style.opacity = '1';
    adminModal.style.pointerEvents = 'auto';
    adminModal.classList.add('active');
}

function submitAdminPassword() {
    const pwd = document.getElementById('admin-password-input').value;
    if (pwd === "admin") {
        window.location.href = "admin.html";
    } else {
        alert("Incorrect password");
    }
}

function closeAdminModal() {
    const adminModal = document.getElementById('admin-modal-custom');
    if (adminModal) {
        adminModal.style.opacity = '0';
        adminModal.style.pointerEvents = 'none';
        adminModal.classList.remove('active');
    }
}

function checkSafety() {
    const battery = document.getElementById('battery-percent').value;
    const maxRange = document.getElementById('max-range').value;
    const result = document.getElementById('safety-result');
    
    if (!battery || !maxRange) {
        result.style.color = 'var(--error-color)';
        result.innerText = 'Please enter both battery % and max range.';
        return;
    }
    
    let distanceText = document.getElementById('station-distance-hidden').value;
    let distance = parseFloat(distanceText.replace(/[^0-9.]/g, ''));
    if (isNaN(distance)) {
        distance = 10; 
    }
    
    const currentRange = (battery / 100) * maxRange;
    if (currentRange >= distance + 5) {
        result.style.color = 'var(--success-color)';
        result.innerText = `Safe! You have ${currentRange.toFixed(1)} km range for a ${distance} km trip.`;
    } else {
        result.style.color = 'var(--error-color)';
        result.innerText = `Warning: You might not reach the station safely. Range: ${currentRange.toFixed(1)} km, Trip: ${distance} km.`;
    }
}
