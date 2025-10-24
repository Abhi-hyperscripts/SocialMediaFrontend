/**
 * Location Tracker App
 * Handles GPS, Camera, and File Upload with SQLite storage
 */

const LocationApp = (function() {
    'use strict';

    let db = null;
    let currentPosition = null;
    let cameraStream = null;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    async function init() {
        console.log('Initializing Location Tracker App...');

        // Initialize database
        try {
            db = await SQLiteHelper.init({
                dbName: 'locationTrackerDb',
                autoSave: true,
                debug: true
            });
            console.log('✅ Database ready');
            updateStats();
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
        }

        // Setup event listeners
        setupEventListeners();

        // Check for iOS
        if (isIOS) {
            document.getElementById('iosNotice')?.classList.add('show');
        }
    }

    // ============================================================================
    // EVENT LISTENERS
    // ============================================================================
    function setupEventListeners() {
        // Location button
        document.getElementById('getLocationBtn')?.addEventListener('click', getLocation);

        // Camera buttons
        document.getElementById('openCameraBtn')?.addEventListener('click', openCamera);
        document.getElementById('capturePhotoBtn')?.addEventListener('click', capturePhoto);
        document.getElementById('closeCameraBtn')?.addEventListener('click', closeCamera);

        // File upload
        document.getElementById('uploadFileBtn')?.addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('fileInput')?.addEventListener('change', handleFileUpload);

        // History buttons
        document.getElementById('viewHistoryBtn')?.addEventListener('click', showHistory);
        document.getElementById('viewPhotosBtn')?.addEventListener('click', showPhotos);
        document.getElementById('clearHistoryBtn')?.addEventListener('click', clearHistory);
        document.getElementById('exportDataBtn')?.addEventListener('click', exportData);
    }

    // ============================================================================
    // LOCATION FUNCTIONS
    // ============================================================================
    async function getLocation() {
        const button = document.getElementById('getLocationBtn');
        const errorMsg = document.getElementById('errorMsg');
        const status = document.getElementById('status');
        const locationInfo = document.getElementById('locationInfo');

        hideAllSections();
        hideError();
        hideStatus();

        if (!navigator.geolocation) {
            showError('❌ Geolocation is not supported by your browser');
            return;
        }

        button.disabled = true;
        button.textContent = 'Getting location...';
        showStatus('🔍 Requesting location access...');

        const options = {
            enableHighAccuracy: true,
            timeout: isIOS ? 15000 : 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            successCallback,
            errorCallback,
            options
        );
    }

    async function successCallback(position) {
        currentPosition = position;
        const button = document.getElementById('getLocationBtn');

        // Update UI
        updateLocationDisplay(position);
        updateMap(position.coords.latitude, position.coords.longitude);

        // Save to database
        await db.saveLocation(position);

        button.disabled = false;
        button.textContent = 'Update Location';
        showStatus('✅ Location found successfully!', 'success');
        updateStats();

        document.getElementById('locationInfo').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
        });
    }

    function errorCallback(error) {
        const button = document.getElementById('getLocationBtn');
        let errorMessage = '';

        switch(error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = '❌ Location access denied. Please enable location permissions in your ' + 
                             (isIOS ? 'Settings → Safari → Location' : 'browser settings');
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = '⚠️ Location information is unavailable. Please check your device settings.';
                break;
            case error.TIMEOUT:
                errorMessage = '⏱️ Location request timed out. Please try again.';
                break;
            default:
                errorMessage = '❗ An unknown error occurred. Please try again.';
        }

        showError(errorMessage);
        button.disabled = false;
        button.textContent = 'Get My Location';
        hideStatus();
    }

    function updateLocationDisplay(position) {
        const { latitude, longitude, accuracy, altitude, altitudeAccuracy, speed, heading } = position.coords;

        document.getElementById('latitude').textContent = latitude.toFixed(6) + '°';
        document.getElementById('longitude').textContent = longitude.toFixed(6) + '°';
        document.getElementById('accuracy').textContent = accuracy.toFixed(0) + ' meters';
        document.getElementById('timestamp').textContent = new Date(position.timestamp).toLocaleString();

        document.getElementById('altitude').textContent = 
            altitude !== null ? altitude.toFixed(1) + ' meters' : 'Not available';
        document.getElementById('altitudeAccuracy').textContent = 
            altitudeAccuracy !== null ? '±' + altitudeAccuracy.toFixed(1) + ' meters' : 'Not available';
        document.getElementById('speed').textContent = 
            speed !== null ? (speed * 3.6).toFixed(1) + ' km/h' : 'Stationary';

        if (heading !== null) {
            const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
            const index = Math.round(heading / 45) % 8;
            document.getElementById('heading').textContent = heading.toFixed(0) + '° (' + directions[index] + ')';
        } else {
            document.getElementById('heading').textContent = 'Not moving';
        }

        document.getElementById('locationInfo').classList.add('show');
    }

    function updateMap(lat, lon) {
        const mapContainer = document.getElementById('mapContainer');
        const mapUrl = `https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed`;

        mapContainer.innerHTML = `
            <iframe 
                src="${mapUrl}"
                allowfullscreen=""
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade">
            </iframe>
        `;
    }

    // ============================================================================
    // CAMERA FUNCTIONS
    // ============================================================================
    async function openCamera() {
        const cameraSection = document.getElementById('cameraSection');
        const videoElement = document.getElementById('cameraVideo');
        const errorMsg = document.getElementById('errorMsg');

        hideAllSections();
        hideError();

        try {
            // Request camera with high resolution
            const constraints = {
                video: {
                    facingMode: 'environment', // Use back camera on mobile
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };

            cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = cameraStream;
            cameraSection.classList.add('show');

            console.log('✅ Camera opened');
        } catch (error) {
            console.error('❌ Camera error:', error);
            
            let message = '❌ Failed to access camera. ';
            if (error.name === 'NotAllowedError') {
                message += 'Please allow camera access in your browser settings.';
            } else if (error.name === 'NotFoundError') {
                message += 'No camera found on this device.';
            } else {
                message += error.message;
            }
            
            showError(message);
        }
    }

    async function capturePhoto() {
        const videoElement = document.getElementById('cameraVideo');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        // Set canvas size to video size
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        // Draw video frame to canvas
        context.drawImage(videoElement, 0, 0);

        // Convert to base64
        const photoData = canvas.toDataURL('image/jpeg', 0.9);

        // Get current location if available
        let lat = null;
        let lon = null;
        if (currentPosition) {
            lat = currentPosition.coords.latitude;
            lon = currentPosition.coords.longitude;
        }

        // Save to database
        await db.saveMedia({
            type: 'photo',
            name: `Photo_${Date.now()}.jpg`,
            data: photoData,
            mimeType: 'image/jpeg',
            size: photoData.length,
            latitude: lat,
            longitude: lon
        });

        showStatus('📸 Photo captured and saved!', 'success');
        updateStats();

        // Show preview
        setTimeout(() => {
            closeCamera();
            showPhotos();
        }, 1000);
    }

    function closeCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }

        const videoElement = document.getElementById('cameraVideo');
        videoElement.srcObject = null;

        document.getElementById('cameraSection').classList.remove('show');
        console.log('Camera closed');
    }

    // ============================================================================
    // FILE UPLOAD FUNCTIONS
    // ============================================================================
    async function handleFileUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        showStatus('📤 Uploading file(s)...', 'info');

        for (const file of files) {
            await uploadFile(file);
        }

        // Clear input
        event.target.value = '';
        
        showStatus(`✅ ${files.length} file(s) uploaded successfully!`, 'success');
        updateStats();
    }

    async function uploadFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                const fileData = e.target.result;

                // Get current location if available
                let lat = null;
                let lon = null;
                if (currentPosition) {
                    lat = currentPosition.coords.latitude;
                    lon = currentPosition.coords.longitude;
                }

                // Determine file type
                let type = 'file';
                if (file.type.startsWith('image/')) type = 'photo';
                else if (file.type.startsWith('video/')) type = 'video';

                // Save to database
                await db.saveMedia({
                    type: type,
                    name: file.name,
                    data: fileData,
                    mimeType: file.type,
                    size: file.size,
                    latitude: lat,
                    longitude: lon
                });

                console.log(`✅ File uploaded: ${file.name}`);
                resolve();
            };

            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ============================================================================
    // HISTORY & DISPLAY FUNCTIONS
    // ============================================================================
    async function showHistory() {
        const historySection = document.getElementById('historySection');
        const historyContent = document.getElementById('historyContent');

        hideAllSections();
        historySection.classList.add('show');
        historyContent.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Loading history...</p></div>';

        try {
            const locations = await db.getLocations(100);

            if (locations.length === 0) {
                historyContent.innerHTML = '<div class="no-data">No location history yet. Start tracking to see your history!</div>';
                return;
            }

            let tableHTML = `
                <h3>Location History (${locations.length} records)</h3>
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Date/Time</th>
                            <th>Latitude</th>
                            <th>Longitude</th>
                            <th>Accuracy</th>
                            <th>Speed</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            locations.forEach(loc => {
                const date = new Date(loc.timestamp);
                tableHTML += `
                    <tr>
                        <td>${date.toLocaleString()}</td>
                        <td>${loc.latitude.toFixed(6)}°</td>
                        <td>${loc.longitude.toFixed(6)}°</td>
                        <td>${loc.accuracy ? loc.accuracy.toFixed(0) + 'm' : 'N/A'}</td>
                        <td>${loc.speed ? (loc.speed * 3.6).toFixed(1) + ' km/h' : 'N/A'}</td>
                        <td>
                            <button class="btn-small" onclick="LocationApp.showOnMap(${loc.latitude}, ${loc.longitude})">Map</button>
                            <button class="btn-small btn-danger" onclick="LocationApp.deleteLocation(${loc.id})">Delete</button>
                        </td>
                    </tr>
                `;
            });

            tableHTML += '</tbody></table>';
            historyContent.innerHTML = tableHTML;
        } catch (error) {
            console.error('Failed to load history:', error);
            historyContent.innerHTML = '<div class="no-data">Error loading history</div>';
        }
    }

    async function showPhotos() {
        const photosSection = document.getElementById('photosSection');
        const photosContent = document.getElementById('photosContent');

        hideAllSections();
        photosSection.classList.add('show');
        photosContent.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Loading photos...</p></div>';

        try {
            const photos = await db.getMedia('photo', 50);

            if (photos.length === 0) {
                photosContent.innerHTML = '<div class="no-data">No photos yet. Capture some photos to see them here!</div>';
                return;
            }

            let galleryHTML = `<h3>Photo Gallery (${photos.length} photos)</h3><div class="photo-grid">`;

            photos.forEach(photo => {
                const date = new Date(photo.timestamp);
                const location = photo.latitude && photo.longitude 
                    ? `${photo.latitude.toFixed(4)}°, ${photo.longitude.toFixed(4)}°` 
                    : 'No location';

                galleryHTML += `
                    <div class="photo-item">
                        <img src="${photo.data}" alt="${photo.name}" onclick="LocationApp.viewPhoto(${photo.id})">
                        <div class="photo-info">
                            <small>${date.toLocaleDateString()}</small>
                            <small>📍 ${location}</small>
                            <button class="btn-small btn-danger" onclick="LocationApp.deletePhoto(${photo.id})">Delete</button>
                        </div>
                    </div>
                `;
            });

            galleryHTML += '</div>';
            photosContent.innerHTML = galleryHTML;
        } catch (error) {
            console.error('Failed to load photos:', error);
            photosContent.innerHTML = '<div class="no-data">Error loading photos</div>';
        }
    }

    function showOnMap(lat, lon) {
        currentPosition = {
            coords: { latitude: lat, longitude: lon },
            timestamp: Date.now()
        };
        updateLocationDisplay(currentPosition);
        updateMap(lat, lon);
        document.getElementById('locationInfo').classList.add('show');
        hideAllSections();
    }

    async function deleteLocation(id) {
        if (confirm('Delete this location record?')) {
            await db.deleteLocation(id);
            showHistory();
            updateStats();
        }
    }

    async function deletePhoto(id) {
        if (confirm('Delete this photo?')) {
            await db.deleteMedia(id);
            showPhotos();
            updateStats();
        }
    }

    function viewPhoto(id) {
        // TODO: Implement full-screen photo viewer
        console.log('View photo:', id);
    }

    async function clearHistory() {
        if (confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
            await db.clear();
            showStatus('✅ All data cleared', 'success');
            hideAllSections();
            updateStats();
        }
    }

    async function exportData() {
        try {
            const jsonData = await db.export('json');
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `location-tracker-export-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showStatus('✅ Data exported successfully!', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            showError('❌ Failed to export data');
        }
    }

    // ============================================================================
    // UI HELPER FUNCTIONS
    // ============================================================================
    function hideAllSections() {
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('show');
        });
    }

    function showError(message) {
        const errorMsg = document.getElementById('errorMsg');
        errorMsg.textContent = message;
        errorMsg.classList.add('show');
    }

    function hideError() {
        document.getElementById('errorMsg')?.classList.remove('show');
    }

    function showStatus(message, type = 'info') {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = 'status show';
        
        if (type === 'success') {
            status.style.background = '#e8f5e9';
            status.style.color = '#2e7d32';
        } else if (type === 'error') {
            status.style.background = '#ffebee';
            status.style.color = '#c62828';
        } else {
            status.style.background = '#e3f2fd';
            status.style.color = '#1565c0';
        }
    }

    function hideStatus() {
        document.getElementById('status')?.classList.remove('show');
    }

    async function updateStats() {
        const stats = await db.stats();
        if (stats) {
            document.getElementById('statsLocations').textContent = stats.locations;
            document.getElementById('statsPhotos').textContent = stats.photos;
            document.getElementById('statsFiles').textContent = stats.files;
        }
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================
    return {
        init,
        getLocation,
        openCamera,
        showHistory,
        showPhotos,
        showOnMap,
        deleteLocation,
        deletePhoto,
        viewPhoto
    };
})();

// Initialize app when page loads
window.addEventListener('load', () => {
    LocationApp.init();
});