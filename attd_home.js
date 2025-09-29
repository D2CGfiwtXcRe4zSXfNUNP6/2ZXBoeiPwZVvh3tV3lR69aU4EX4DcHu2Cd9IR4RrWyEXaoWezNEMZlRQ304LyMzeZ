// Function to handle attendance button clicks
function handleAttendance(type) {
    // Show loading screen
    const loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.classList.add('active');
    
    // Store the attendance type in localStorage
    localStorage.setItem('attendanceType', type);
    
    // Wait a moment to show the loading screen, then redirect
    setTimeout(() => {
        window.location.href = 'attd_emplist.html';
    }, 1500); // 1.5 second delay to show the loading animation
}

// Update date and time in real-time
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

// Initial call to display date and time immediately
updateDateTime();

// Update date and time every second
setInterval(updateDateTime, 1000);

// Card hover effects
document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('.card');
    
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
    });
    
    // Add touch effects for mobile devices
    cards.forEach(card => {
        card.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.98)';
        }, {passive: true});
        
        card.addEventListener('touchend', function() {
            this.style.transform = '';
        }, {passive: true});
    });
});

// Handle swipe gestures for mobile
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
}, {passive: true});

document.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, {passive: true});

function handleSwipe() {
    // Simple swipe handling for demonstration
    if (touchEndX < touchStartX - 50) {
        document.getElementById('wfh-card').style.transform = 'translateX(-20px)';
        setTimeout(() => {
            document.getElementById('wfh-card').style.transform = '';
        }, 300);
    }
    
    if (touchEndX > touchStartX + 50) {
        document.getElementById('onsite-card').style.transform = 'translateX(20px)';
        setTimeout(() => {
            document.getElementById('onsite-card').style.transform = '';
        }, 300);
    }
}