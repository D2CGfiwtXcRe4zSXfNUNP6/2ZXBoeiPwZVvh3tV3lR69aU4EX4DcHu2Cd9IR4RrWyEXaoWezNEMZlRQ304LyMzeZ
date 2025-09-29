import { database } from './firebase-config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

// Global variables
let employees = [];
let currentEmployeeId = null;
let currentEmployeeName = null;
let pinInput = '';
let attendanceType = '';

// Employee PIN codes
const employeePins = {
    'DOMINIC OCTUBRE RAMOS': '0218',
    'ESPERANZA RAMOS': '1427'
};

// DOM elements
const employeesContainer = document.getElementById('employeesContainer');
const searchInput = document.getElementById('searchInput');
const backButton = document.getElementById('backButton');
const pinModal = document.getElementById('pinModal');
const employeeNameSpan = document.getElementById('employeeName');
const pinDots = [
    document.getElementById('pinDot1'),
    document.getElementById('pinDot2'),
    document.getElementById('pinDot3'),
    document.getElementById('pinDot4')
];
const pinError = document.getElementById('pinError');
const pinClear = document.getElementById('pinClear');
const pinSubmit = document.getElementById('pinSubmit');
const closePin = document.getElementById('closePin');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notification-text');
const attendanceTypeDisplay = document.getElementById('attendanceTypeDisplay');
const toggleAttendanceTypeBtn = document.getElementById('toggleAttendanceTypeBtn');

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Get attendance type from localStorage or default to 'On-Site'
    attendanceType = localStorage.getItem('attendanceType') || 'On-Site';
    
    // Update attendance type display and button
    updateAttendanceTypeUI();
    
    // Load employees from Firebase
    loadEmployees();
    
    // Set up event listeners
    setupEventListeners();
    
    // Start date/time updater
    updateDateTime();
    setInterval(updateDateTime, 1000);
});

// Update attendance type UI elements
function updateAttendanceTypeUI() {
    // Update display text
    attendanceTypeDisplay.textContent = `Marking ${attendanceType} Attendance - Select an employee`;
    
    // Update toggle button text and style
    if (toggleAttendanceTypeBtn) {
        toggleAttendanceTypeBtn.textContent = `Switch to ${attendanceType === 'On-Site' ? 'WFH' : 'On-Site'}`;
        toggleAttendanceTypeBtn.className = `attendance-toggle ${attendanceType.toLowerCase()}`;
    }
    
    // Save to localStorage
    localStorage.setItem('attendanceType', attendanceType);
    
    // Re-render employees if already loaded
    if (employees.length > 0) {
        renderEmployees();
    }
}

// Toggle attendance type between WFH and On-Site
function toggleAttendanceType() {
    attendanceType = attendanceType === 'On-Site' ? 'WFH' : 'On-Site';
    updateAttendanceTypeUI();
}

// Load employees from Firebase
function loadEmployees() {
    const employeesRef = ref(database, 'employees');
    
    onValue(employeesRef, (snapshot) => {
        employees = [];
        snapshot.forEach((childSnapshot) => {
            const employee = childSnapshot.val();
            employee.id = childSnapshot.key;
            employees.push(employee);
        });
        
        // Render employees
        renderEmployees();
    }, (error) => {
        console.error("Error loading employees:", error);
        showNotification("Error loading employees. Please try again.", "error");
    });
}

// Render employees
function renderEmployees() {
    const searchTerm = searchInput.value.toLowerCase();

    // Filter employees based on search and attendance type
    let filteredEmployees = employees.filter(employee =>
        employee.name.toLowerCase().includes(searchTerm) ||
        employee.id.toLowerCase().includes(searchTerm)
    );

    if (attendanceType === "WFH") {
        filteredEmployees = filteredEmployees.filter(employee =>
            ["DOMINIC OCTUBRE RAMOS", "ESPERANZA RAMOS"].includes(employee.name.toUpperCase())
        );
    }
    // If attendanceType = "On-Site", we keep all employees

    renderCardView(filteredEmployees);
}

// Render card view
function renderCardView(employeesList) {
    employeesContainer.innerHTML = '';
    
    if (employeesList.length === 0) {
        employeesContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search" style="font-size: 3rem; color: #ccc; margin-bottom: 15px;"></i>
                <p>No employees found</p>
            </div>
        `;
        return;
    }
    
    employeesList.forEach(employee => {
        const firstLetter = employee.name.charAt(0).toUpperCase();
        
        const employeeCard = document.createElement('div');
        employeeCard.className = 'employee-card';
        employeeCard.innerHTML = `
            <div class="employee-id">ID: ${employee.id}</div>
            <div class="employee-avatar">${firstLetter}</div>
            <div class="employee-name">${employee.name}</div>
            <div class="employee-card-footer">Click to mark ${attendanceType} attendance</div>
        `;
        
        employeeCard.addEventListener('click', () => {
            openPinModal(employee);
        });
        
        employeesContainer.appendChild(employeeCard);
    });
}

// Set up event listeners
function setupEventListeners() {
    // Search functionality
    searchInput.addEventListener('input', renderEmployees);
    
    // Back button
    backButton.addEventListener('click', () => {
        window.location.href = 'attd_home.html';
    });
    
    // Attendance type toggle button
    if (toggleAttendanceTypeBtn) {
        toggleAttendanceTypeBtn.addEventListener('click', toggleAttendanceType);
    }
    
    // PIN modal functionality
    closePin.addEventListener('click', closePinModal);
    
    // PIN number buttons
    document.querySelectorAll('.pin-btn[data-value]').forEach(button => {
        button.addEventListener('click', () => {
            if (pinInput.length < 4) {
                pinInput += button.getAttribute('data-value');
                updatePinDots();
            }
        });
    });
    
    // PIN clear button
    pinClear.addEventListener('click', () => {
        pinInput = '';
        updatePinDots();
        pinError.textContent = '';
    });
    
    // PIN submit button
    pinSubmit.addEventListener('click', validatePin);
    
    // Close modal when clicking outside
    pinModal.addEventListener('click', (e) => {
        if (e.target === pinModal) {
            closePinModal();
        }
    });
}

// Open PIN modal for an employee
function openPinModal(employee) {
    currentEmployeeId = employee.id;
    currentEmployeeName = employee.name;
    employeeNameSpan.textContent = employee.name;
    pinInput = '';
    updatePinDots();
    pinError.textContent = '';
    pinModal.classList.add('active');
}

// Close PIN modal
function closePinModal() {
    pinModal.classList.remove('active');
    currentEmployeeId = null;
    currentEmployeeName = null;
    pinInput = '';
}

// Update PIN dots display
function updatePinDots() {
    pinDots.forEach((dot, index) => {
        if (index < pinInput.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}

// Validate PIN
function validatePin() {
    if (pinInput.length !== 4) {
        pinError.textContent = 'Please enter a 4-digit PIN';
        return;
    }
    
    // Check if employee requires PIN validation
    if (employeePins.hasOwnProperty(currentEmployeeName.toUpperCase())) {
        // Validate PIN for specific employees
        if (pinInput === employeePins[currentEmployeeName.toUpperCase()]) {
            markAttendance();
        } else {
            pinError.textContent = 'Invalid PIN. Please try again.';
        }
    } else {
        // For other employees, any 4-digit PIN is considered valid
        markAttendance();
    }
}

// Mark attendance for the current employee
function markAttendance() {
    // Store attendance data in localStorage to pass to profile page
    const attendanceData = {
        employeeId: currentEmployeeId,
        employeeName: currentEmployeeName,
        type: attendanceType,
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-US'),
        time: new Date().toLocaleTimeString('en-US')
    };
    
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    
    // Show success notification
    showNotification(`${attendanceType} attendance marked for ${currentEmployeeName}`);
    
    // Close PIN modal
    closePinModal();
    
    // Clear PIN input
    pinInput = '';
    updatePinDots();
    
    // Redirect to profile page after a short delay
    setTimeout(() => {
        window.location.href = 'attd_profile.html';
    }, 1500);
}

// Show notification
function showNotification(message, type = 'success') {
    notificationText.textContent = message;
    
    if (type === 'error') {
        notification.style.backgroundColor = '#f44336';
    } else {
        notification.style.backgroundColor = '#4CAF50';
    }
    
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Update date and time
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
    const dateTimeStr = now.toLocaleDateString('en-US', options);
    document.getElementById('datetime').textContent = dateTimeStr;
}