import { database } from './firebase-config.js';
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

// DOM elements
const backButton = document.getElementById('backButton');
const employeeAvatar = document.getElementById('employeeAvatar');
const employeeName = document.getElementById('employeeName');
const employeeId = document.getElementById('employeeId');
const datetime = document.getElementById('datetime');
const captureBtn = document.getElementById('captureBtn');
const timeInBtn = document.getElementById('timeInBtn');
const timeOutBtn = document.getElementById('timeOutBtn');
const overtimeInBtn = document.getElementById('overtimeInBtn');
const overtimeOutBtn = document.getElementById('overtimeOutBtn');
const overtimeSection = document.getElementById('overtimeSection');
const overtimeNotice = document.getElementById('overtimeNotice');
const cameraPreview = document.getElementById('cameraPreview');
const cameraModal = document.getElementById('cameraModal');
const closeCamera = document.getElementById('closeCamera');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const takePictureBtn = document.getElementById('takePictureBtn');
const attendanceRecords = document.getElementById('attendanceRecords');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notification-text');
const loadingScreen = document.getElementById('loadingScreen');
const locationStatus = document.getElementById('locationStatus'); // Make sure this exists in HTML

// Global variables
let currentEmployee = null;
let currentDate = '';
let capturedImage = null;
let stream = null;
let attendanceData = {};
let currentLocation = null;
let watchId = null;

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded');
  loadingScreen.classList.add('active');

  const storedData = localStorage.getItem('attendanceData');
  if (storedData) {
    console.log('Found stored data');
    try {
      attendanceData = JSON.parse(storedData);
      currentEmployee = {
        id: attendanceData.employeeId,
        name: attendanceData.employeeName
      };

      displayEmployeeInfo();
      loadAttendanceRecords();
    } catch (error) {
      console.error('Error parsing stored data:', error);
      showNotification("Invalid employee data. Redirecting...", "error");
      setTimeout(() => {
        window.location.href = 'attd_home.html';
      }, 2000);
      return;
    }
  } else {
    console.log('No stored data found');
    showNotification("No employee data found. Redirecting...", "error");
    setTimeout(() => {
      window.location.href = 'attd_home.html';
    }, 2000);
    return;
  }

  setupEventListeners();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // Initialize location tracking with safe approach
  initializeLocationTracking();

  // Force hide loading screen after max 4 seconds as fallback
  setTimeout(() => {
    console.log('Forcing loading screen hide');
    loadingScreen.classList.remove('active');
    showNotification("System ready. Location may still be initializing.", "info");
  }, 4000);
});

// ========== UI HELPERS ==========
function displayEmployeeInfo() {
  if (currentEmployee) {
    employeeAvatar.textContent = currentEmployee.name.charAt(0).toUpperCase();
    employeeName.textContent = currentEmployee.name;
    employeeId.textContent = currentEmployee.id;
  }
}

function setupEventListeners() {
  backButton.addEventListener('click', () => {
    window.location.href = 'attd_home.html';
  });

  captureBtn.addEventListener('click', openCamera);
  closeCamera.addEventListener('click', closeCameraModal);
  takePictureBtn.addEventListener('click', takePicture);

  timeInBtn.addEventListener('click', () => recordAttendance('TimeIn'));
  timeOutBtn.addEventListener('click', () => recordAttendance('TimeOut'));
  overtimeInBtn.addEventListener('click', () => recordAttendance('Overtime-TimeIn'));
  overtimeOutBtn.addEventListener('click', () => recordAttendance('Overtime-TimeOut'));
}

// ========== CAMERA ==========
function openCamera() {
  cameraModal.classList.add('active');

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(function(mediaStream) {
        stream = mediaStream;
        video.srcObject = mediaStream;
        video.play();
      })
      .catch(function(error) {
        console.error("Camera error: ", error);
        showNotification("Camera access denied. Please enable camera permissions.", "error");
        closeCameraModal();
      });
  } else {
    showNotification("Your browser doesn't support camera access.", "error");
    closeCameraModal();
  }
}

function closeCameraModal() {
  cameraModal.classList.remove('active');
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}

function takePicture() {
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  capturedImage = canvas.toDataURL('image/jpeg', 0.6);

  cameraPreview.innerHTML = `
    <img src="${capturedImage}" alt="Captured Image"
        style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;">
  `;

  closeCameraModal();
  showNotification("Image captured successfully. You can now record attendance.");
  updateButtons();
}

// ========== LOCATION TRACKING ==========
function initializeLocationTracking() {
  if (!navigator.geolocation) {
    console.log('Geolocation not supported');
    if (locationStatus) {
      locationStatus.textContent = "Geolocation is not supported by this browser.";
      locationStatus.style.color = "#f44336";
    }
    return;
  }

  if (locationStatus) {
    locationStatus.textContent = "Getting location...";
    locationStatus.style.color = "#ff9800";
  }

  // Set timeout for location request
  const locationTimeout = setTimeout(() => {
    console.log('Location request timeout');
    if (locationStatus) {
      locationStatus.textContent = "Location timeout - using default location";
      locationStatus.style.color = "#ff9800";
    }
    // Set a default location so the app doesn't get stuck
    currentLocation = {
      latitude: 0,
      longitude: 0,
      accuracy: 0,
      timestamp: new Date().toISOString(),
      address: "Location unavailable"
    };
  }, 10000); // 10 second timeout

  // Get initial position
  navigator.geolocation.getCurrentPosition(
    (position) => {
      clearTimeout(locationTimeout);
      updateLocation(position);
      // Watch for position changes
      watchId = navigator.geolocation.watchPosition(
        updateLocation,
        handleLocationError,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        }
      );
    },
    (error) => {
      clearTimeout(locationTimeout);
      handleLocationError(error);
      // Set default location even on error so app continues working
      currentLocation = {
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        timestamp: new Date().toISOString(),
        address: "Location access denied"
      };
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function updateLocation(position) {
  const { latitude, longitude, accuracy } = position.coords;
  
  currentLocation = {
    latitude: latitude,
    longitude: longitude,
    accuracy: Math.round(accuracy),
    timestamp: new Date().toISOString()
  };

  if (locationStatus) {
    locationStatus.textContent = `Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (Accuracy: ${Math.round(accuracy)}m)`;
    locationStatus.style.color = "#4CAF50";
  }
  
  // Optional: Get address from coordinates (reverse geocoding)
  getAddressFromCoordinates(latitude, longitude);
}

function handleLocationError(error) {
  console.error("Location error: ", error);
  
  let errorMessage = "An unknown location error occurred.";
  switch(error.code) {
    case error.PERMISSION_DENIED:
      errorMessage = "Location access denied. Please enable location permissions.";
      break;
    case error.POSITION_UNAVAILABLE:
      errorMessage = "Location information unavailable.";
      break;
    case error.TIMEOUT:
      errorMessage = "Location request timed out.";
      break;
  }
  
  if (locationStatus) {
    locationStatus.textContent = errorMessage;
    locationStatus.style.color = "#f44336";
  }
  
  showNotification("Location services issue - attendance can still be recorded", "info");
}

function getAddressFromCoordinates(lat, lng) {
  // Using OpenStreetMap Nominatim for reverse geocoding (free service)
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
    .then(response => response.json())
    .then(data => {
      if (data && data.display_name) {
        const address = data.display_name;
        currentLocation.address = address;
        
        // Update location status with address
        if (locationStatus) {
          locationStatus.textContent = `Location: ${address.split(',').slice(0, 3).join(',')}`;
        }
      }
    })
    .catch(error => {
      console.error("Reverse geocoding error: ", error);
      // Continue without address - coordinates are sufficient
    });
}

function stopLocationTracking() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

// ========== ATTENDANCE ==========
function recordAttendance(type) {
  if (!capturedImage) {
    showNotification("Please capture an image first.", "error");
    return;
  }

  // Don't block attendance if location is not available
  if (!currentLocation) {
    showNotification("Location not available, recording attendance without location...", "info");
    // Set default location so attendance can be recorded
    currentLocation = {
      latitude: 0,
      longitude: 0,
      accuracy: 0,
      timestamp: new Date().toISOString(),
      address: "Location unavailable"
    };
  }

  updateButtons();
  const disallowed =
    (type === 'TimeIn' && timeInBtn.disabled) ||
    (type === 'TimeOut' && timeOutBtn.disabled) ||
    (type === 'Overtime-TimeIn' && overtimeInBtn.disabled) ||
    (type === 'Overtime-TimeOut' && overtimeOutBtn.disabled);

  if (disallowed) {
    if (type.startsWith("Overtime")) {
      showNotification("Overtime can only be recorded after 9 hours from Time In and with a new capture.", "error");
    } else {
      showNotification("Action not allowed at this time.", "error");
    }
    return;
  }

  const now = new Date();
  const time = now.toLocaleTimeString('en-US');
  const date = now.toLocaleDateString('en-US').replace(/\//g, '-');
  const timestamp = now.getTime();
  const filename = `${currentEmployee.id}_${date}_${type}_${timestamp}.jpg`;

  if (checkDuplicateAttendance(type)) {
    showNotification(`${type} has already been recorded today.`, "error");
    return;
  }

  const attendanceRecord = {
    type,
    time,
    timestamp,
    image: capturedImage,
    filename,
    attendanceType: attendanceData.type, // Add attendance type (WFH/On-Site)
    location: currentLocation // Add location data
  };

  saveAttendanceToFirebase(attendanceRecord);
}

function checkDuplicateAttendance(type) {
  const todayRecords = attendanceData.records || [];
  return todayRecords.some(record => record.type === type);
}

function saveAttendanceToFirebase(record) {
  const date = new Date().toLocaleDateString('en-US').replace(/\//g, '-');
  const attendanceRef = ref(database, `attendance/${currentEmployee.id}/${date}/${record.type}`);

  set(attendanceRef, record)
    .then(() => {
      showNotification(`${record.type} recorded successfully!`);

      capturedImage = null;
      cameraPreview.innerHTML = `
        <i class="fas fa-camera"></i>
        <p>Capture image to enable time tracking</p>
      `;

      updateButtons();
    })
    .catch((error) => {
      console.error("Error saving attendance: ", error);
      showNotification("Error recording attendance. Please try again.", "error");
    });
}

// ========== RECORDS ==========
function loadAttendanceRecords() {
  const date = new Date().toLocaleDateString('en-US').replace(/\//g, '-');
  const attendanceRef = ref(database, `attendance/${currentEmployee.id}/${date}`);

  console.log('Loading records from Firebase...');
  
  onValue(attendanceRef, (snapshot) => {
    console.log('Firebase data received:', snapshot.exists());
    
    const records = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        records.push(childSnapshot.val());
      });
    }

    attendanceData.records = records;
    updateAttendanceRecords();
    updateButtons();

    // ✅ Always remove loading screen once data is loaded (even if no records)
    console.log('Removing loading screen - Firebase data loaded');
    loadingScreen.classList.remove('active');
  }, (error) => {
    console.error('Firebase error:', error);
    // ✅ Remove loading screen even on error
    loadingScreen.classList.remove('active');
    showNotification("Error loading attendance records", "error");
    
    // Initialize empty records if Firebase fails
    attendanceData.records = [];
    updateAttendanceRecords();
    updateButtons();
  });
}

function updateAttendanceRecords() {
  const records = attendanceData.records || [];
  if (records.length === 0) {
    attendanceRecords.innerHTML = `
      <tr>
        <td colspan="5" class="no-records">No attendance records for today</td>
      </tr>
    `;
    return;
  }

  attendanceRecords.innerHTML = '';
  records.forEach(record => {
    const locationInfo = record.location ? 
      `${record.location.latitude.toFixed(4)}, ${record.location.longitude.toFixed(4)}` : 
      'No location';
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${record.type}</td>
      <td>${record.time}</td>
      <td>${record.attendanceType || 'On-Site'}</td>
      <td>${locationInfo}</td>
      <td>
        <button class="view-image-btn" data-image="${record.image}">
          <i class="fas fa-eye"></i> View
        </button>
        ${record.location && record.location.latitude !== 0 ? 
          `<button class="view-location-btn" data-lat="${record.location.latitude}" data-lng="${record.location.longitude}" data-address="${record.location.address || ''}">
            <i class="fas fa-map-marker-alt"></i> Map
          </button>` : ''}
      </td>
    `;
    attendanceRecords.appendChild(row);
  });

  // Add event listeners for view buttons
  document.querySelectorAll('.view-image-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const imageData = e.currentTarget.dataset.image;
      viewImage(imageData);
    });
  });

  document.querySelectorAll('.view-location-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const lat = parseFloat(e.currentTarget.dataset.lat);
      const lng = parseFloat(e.currentTarget.dataset.lng);
      const address = e.currentTarget.dataset.address;
      viewLocationOnMap(lat, lng, address);
    });
  });
}

// ========== VIEW LOCATION ON MAP ==========
function viewLocationOnMap(lat, lng, address) {
  const mapUrl = `https://www.google.com/maps?q=${lat},${lng}&z=17`;
  const mapWindow = window.open('', '_blank');
  
  mapWindow.document.write(`
    <html>
      <head>
        <title>Attendance Location</title>
        <style>
          body { margin: 0; font-family: Arial, sans-serif; }
          .header { background: #f5f5f5; padding: 10px; border-bottom: 1px solid #ddd; }
          .map-container { width: 100%; height: calc(100vh - 60px); }
          iframe { width: 100%; height: 100%; border: none; }
        </style>
      </head>
      <body>
        <div class="header">
          <strong>Attendance Location</strong><br>
          ${address ? `Address: ${address}<br>` : ''}
          Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}
        </div>
        <div class="map-container">
          <iframe 
            src="https://maps.google.com/maps?q=${lat},${lng}&z=17&output=embed"
            allowfullscreen>
          </iframe>
        </div>
      </body>
    </html>
  `);
}

// ========== BUTTON STATES & OT ==========
function updateButtons() {
  const records = attendanceData.records || [];
  const hasTI = records.some(r => r.type === 'TimeIn');
  const hasTO = records.some(r => r.type === 'TimeOut');
  const hasOTI = records.some(r => r.type === 'Overtime-TimeIn');
  const hasOTO = records.some(r => r.type === 'Overtime-TimeOut');

  let hoursWorked = 0;
  if (hasTI) {
    const ti = records.find(r => r.type === 'TimeIn').timestamp;
    hoursWorked = (Date.now() - ti) / (1000 * 60 * 60);
  }

  const overtimeEligible = hasTI && hoursWorked >= 9;
  const hasCapture = !!capturedImage;

  // Enable/disable buttons
  timeInBtn.disabled = !(hasCapture && !hasTI);
  timeOutBtn.disabled = !(hasCapture && hasTI && !hasTO);
  overtimeInBtn.disabled = !(hasCapture && overtimeEligible && !hasOTI);
  overtimeOutBtn.disabled = !(hasCapture && overtimeEligible && hasOTI && !hasOTO);

  // Show overtime info
  if (hasTI) {
    const nineHoursMs = 9 * 60 * 60 * 1000;
    const tiTime = records.find(r => r.type === 'TimeIn').timestamp;
    const now = Date.now();

    if (hasTO) {
      const workedMs = records.find(r => r.type === 'TimeOut').timestamp - tiTime;
      if (workedMs < nineHoursMs) {
        overtimeNotice.textContent = "Your attendance is not eligible for OT.";
        overtimeSection.classList.remove('active');
      } else {
        overtimeNotice.textContent = "You are eligible for overtime.";
        overtimeSection.classList.add('active');
      }
    } else {
      const elapsedMs = now - tiTime;
      if (elapsedMs >= nineHoursMs) {
        overtimeNotice.textContent = "You are eligible for overtime.";
        overtimeSection.classList.add('active');
      } else {
        const remainingMs = nineHoursMs - elapsedMs;
        const hrs = Math.floor(remainingMs / (1000 * 60 * 60));
        const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((remainingMs % (1000 * 60)) / 1000);
        overtimeNotice.textContent = `Overtime available in ${hrs}h ${mins}m ${secs}s`;
        overtimeSection.classList.remove('active');
      }
    }
  } else {
    overtimeNotice.textContent = "Overtime requires Time In first.";
    overtimeSection.classList.remove('active');
  }
}

// ========== VIEW IMAGE ==========
function viewImage(imageData) {
  const imageWindow = window.open('', '_blank');
  imageWindow.document.write(`
    <html>
      <head><title>Attendance Image</title></head>
      <body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#f0f0f0;">
        <img src="${imageData}" style="max-width:100%;max-height:100%;">
      </body>
    </html>
  `);
}

// ========== CLOCK ==========
function updateDateTime() {
  const now = new Date();
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  datetime.textContent = now.toLocaleDateString('en-US', options);
  currentDate = now.toLocaleDateString('en-US').replace(/\//g, '-');

  updateButtons(); // live OT check
}

// ========== NOTIFICATION ==========
function showNotification(message, type = 'success') {
  notificationText.textContent = message;
  
  // Set different colors based on type
  if (type === 'error') {
    notification.style.backgroundColor = '#f44336';
  } else if (type === 'info') {
    notification.style.backgroundColor = '#2196F3';
  } else {
    notification.style.backgroundColor = '#4CAF50';
  }
  
  notification.classList.add('show');
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// ========== CLEANUP ==========
// Stop location tracking when leaving the page
window.addEventListener('beforeunload', stopLocationTracking);