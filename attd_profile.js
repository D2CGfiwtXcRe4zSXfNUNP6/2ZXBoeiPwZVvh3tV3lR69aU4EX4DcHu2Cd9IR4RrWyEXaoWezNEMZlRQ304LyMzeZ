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

// Global variables
let currentEmployee = null;
let currentDate = '';
let capturedImage = null;
let stream = null;
let attendanceData = {};

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function() {
  loadingScreen.classList.add('active');

  const storedData = localStorage.getItem('attendanceData');
  if (storedData) {
    attendanceData = JSON.parse(storedData);
    currentEmployee = {
      id: attendanceData.employeeId,
      name: attendanceData.employeeName
    };

    displayEmployeeInfo();
    loadAttendanceRecords();
  } else {
    showNotification("No employee data found. Redirecting...", "error");
    setTimeout(() => {
      window.location.href = 'attd_home.html';
    }, 2000);
    return;
  }

  setupEventListeners();
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Fallback: hide loading screen if Firebase takes too long
  setTimeout(() => {
    loadingScreen.classList.remove('active');
  }, 3000);

  updateButtons();
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

// ========== ATTENDANCE ==========
function recordAttendance(type) {
  if (!capturedImage) {
    showNotification("Please capture an image first.", "error");
    return;
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
    attendanceType: attendanceData.type // Add attendance type (WFH/On-Site)
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

  onValue(attendanceRef, (snapshot) => {
    const records = [];
    snapshot.forEach((childSnapshot) => {
      records.push(childSnapshot.val());
    });

    attendanceData.records = records;
    updateAttendanceRecords();
    updateButtons();

    // ✅ remove loading screen once data is loaded
    loadingScreen.classList.remove('active');
  });
}

function updateAttendanceRecords() {
  const records = attendanceData.records || [];
  if (records.length === 0) {
    attendanceRecords.innerHTML = `
      <tr>
        <td colspan="4" class="no-records">No attendance records for today</td>
      </tr>
    `;
    return;
  }

  attendanceRecords.innerHTML = '';
  records.forEach(record => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${record.type}</td>
      <td>${record.time}</td>
      <td>${record.attendanceType || 'On-Site'}</td>
      <td>
        <button class="view-image-btn" data-image="${record.image}">
          <i class="fas fa-eye"></i> View
        </button>
      </td>
    `;
    attendanceRecords.appendChild(row);
  });

  document.querySelectorAll('.view-image-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const imageData = e.currentTarget.dataset.image;
      viewImage(imageData);
    });
  });
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
  notification.style.backgroundColor = (type === 'error') ? '#f44336' : '#4CAF50';
  notification.classList.add('show');
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}