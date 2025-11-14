// Application State
const state = {
    currentUser: null,
    users: JSON.parse(localStorage.getItem('users')) || [
        // Only one admin account - kawalsalman@gmail.com
        {
            id: 'admin1',
            name: 'System Administrator',
            email: 'kawalsalman@gmail.com',
            password: 'admin123',
            role: 'admin'
        }
    ],
    emergencyReports: JSON.parse(localStorage.getItem('emergencyReports')) || [],
    // Configuration - Only this email can be admin
    ALLOWED_ADMIN_EMAIL: 'kawalsalman@gmail.com',
    // Map instance
    map: null,
    mapMarker: null
};

// DOM Elements
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-link');
const userInfo = document.getElementById('user-info');
const userGreeting = document.getElementById('user-greeting');
const userRole = document.getElementById('user-role');
const logoutBtn = document.getElementById('logout-btn');
const dashboardNav = document.getElementById('dashboard-nav');
const reportNav = document.getElementById('report-nav');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    checkAuthentication();
    initializeMap();
});

// Initialize the application
function initializeApp() {
    // Clear any existing authentication
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    
    // Reset to only have the admin user
    const adminUser = {
        id: 'admin1',
        name: 'System Administrator',
        email: 'kawalsalman@gmail.com',
        password: 'admin123',
        role: 'admin'
    };
    
    // Set only the admin user
    state.users = [adminUser];
    localStorage.setItem('users', JSON.stringify(state.users));
    
    console.log('Admin user initialized:', adminUser);
    
    // Check if user is logged in
    const token = localStorage.getItem('authToken');
    if (token) {
        state.currentUser = {
            name: localStorage.getItem('userName'),
            email: localStorage.getItem('userEmail'),
            role: localStorage.getItem('userRole')
        };
        updateUIForUser();
    }
}

// Set up event listeners
function setupEventListeners() {
    // Navigation
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            showPage(page);
            
            // Update active nav link
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Auth buttons on home page
    document.getElementById('home-login-btn').addEventListener('click', function() {
        showPage('login');
        updateNavActiveState('login');
    });
    
    document.getElementById('home-register-btn').addEventListener('click', function() {
        showPage('register');
        updateNavActiveState('register');
    });

    // Auth form links
    document.getElementById('go-to-register').addEventListener('click', function(e) {
        e.preventDefault();
        showPage('register');
        updateNavActiveState('register');
    });
    
    document.getElementById('go-to-login').addEventListener('click', function(e) {
        e.preventDefault();
        showPage('login');
        updateNavActiveState('login');
    });

    // Form submissions
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('emergency-report-form').addEventListener('submit', handleEmergencyReport);
    
    // Location button
    document.getElementById('get-location-btn').addEventListener('click', getCurrentLocation);
    
    // Logout
    logoutBtn.addEventListener('click', handleLogout);
}

// Initialize Leaflet map
function initializeMap() {
    // Default to Karachi coordinates
    const karachiCoords = [24.8607, 67.0011];
    
    state.map = L.map('location-map').setView(karachiCoords, 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(state.map);
    
    // Add default marker
    state.mapMarker = L.marker(karachiCoords)
        .addTo(state.map)
        .bindPopup('Default location: Karachi')
        .openPopup();
}

// Update map with new coordinates
function updateMap(lat, lng, address = '') {
    const newCoords = [lat, lng];
    
    state.map.setView(newCoords, 15);
    
    // Remove existing marker
    if (state.mapMarker) {
        state.map.removeLayer(state.mapMarker);
    }
    
    // Add new marker
    state.mapMarker = L.marker(newCoords)
        .addTo(state.map)
        .bindPopup(address || `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
        .openPopup();
    
    // Show coordinates
    const coordinatesDisplay = document.getElementById('coordinates-display');
    const coordinatesText = document.getElementById('coordinates-text');
    
    coordinatesText.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    coordinatesDisplay.classList.remove('hidden');
}

// Get current location using Geolocation API
function getCurrentLocation() {
    const locationBtn = document.getElementById('get-location-btn');
    const locationStatus = document.getElementById('location-status');
    
    locationBtn.disabled = true;
    locationStatus.textContent = 'Getting your location...';
    locationStatus.style.color = 'var(--info-text)';
    
    if (!navigator.geolocation) {
        locationStatus.textContent = 'Geolocation is not supported by this browser.';
        locationStatus.style.color = 'var(--error-text)';
        locationBtn.disabled = false;
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Update map
            updateMap(lat, lng, 'Your current location');
            
            // Try to get address using reverse geocoding
            getAddressFromCoordinates(lat, lng);
            
            locationStatus.textContent = 'Location found!';
            locationStatus.style.color = 'var(--success-text)';
            locationBtn.disabled = false;
        },
        function(error) {
            let errorMessage = 'Unable to retrieve your location. ';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Please allow location access and try again.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Location request timed out.';
                    break;
                default:
                    errorMessage += 'An unknown error occurred.';
                    break;
            }
            
            locationStatus.textContent = errorMessage;
            locationStatus.style.color = 'var(--error-text)';
            locationBtn.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}

// Get address from coordinates using Nominatim (OpenStreetMap)
function getAddressFromCoordinates(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data && data.display_name) {
                document.getElementById('location-address').value = data.display_name;
            }
        })
        .catch(error => {
            console.log('Error getting address:', error);
            document.getElementById('location-address').value = `Near coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        });
}

// Handle emergency report submission
function handleEmergencyReport(e) {
    e.preventDefault();
    
    const formData = {
        fullname: document.getElementById('report-fullname').value.trim(),
        cnic: document.getElementById('report-cnic').value.trim(),
        emergencyType: document.getElementById('emergency-type').value,
        severity: document.getElementById('severity').value,
        description: document.getElementById('emergency-description').value.trim(),
        address: document.getElementById('location-address').value.trim(),
        landmark: document.getElementById('location-landmark').value.trim(),
        coordinates: document.getElementById('coordinates-text').textContent,
        timestamp: new Date().toISOString(),
        reportId: generateReportId()
    };
    
    // Clear previous errors
    clearReportErrors();
    
    // Validate form
    if (!validateEmergencyReport(formData)) {
        return;
    }
    
    // Save report
    saveEmergencyReport(formData);
    
    // Show confirmation
    showReportConfirmation(formData);
}

// Validate emergency report form
function validateEmergencyReport(formData) {
    let isValid = true;
    
    // Full Name validation
    if (!formData.fullname) {
        showReportError('fullname-error', 'Full name is required');
        isValid = false;
    }
    
    // CNIC validation (Pakistani CNIC format: XXXXX-XXXXXXX-X)
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (!formData.cnic) {
        showReportError('cnic-error', 'CNIC is required');
        isValid = false;
    } else if (!cnicRegex.test(formData.cnic)) {
        showReportError('cnic-error', 'Please enter a valid CNIC (format: XXXXX-XXXXXXX-X)');
        isValid = false;
    }
    
    // Emergency Type validation
    if (!formData.emergencyType) {
        showReportError('emergency-type-error', 'Please select an emergency type');
        isValid = false;
    }
    
    // Severity validation
    if (!formData.severity) {
        showReportError('severity-error', 'Please select severity level');
        isValid = false;
    }
    
    // Description validation
    if (!formData.description) {
        showReportError('description-error', 'Please provide emergency description');
        isValid = false;
    } else if (formData.description.length < 10) {
        showReportError('description-error', 'Description must be at least 10 characters long');
        isValid = false;
    }
    
    // Address validation
    if (!formData.address) {
        showReportError('address-error', 'Address is required');
        isValid = false;
    }
    
    return isValid;
}

// Show error for report form
function showReportError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
    }
}

// Clear all report errors
function clearReportErrors() {
    const errorElements = document.querySelectorAll('#report-page .error-message');
    errorElements.forEach(element => {
        element.textContent = '';
    });
}

// Generate unique report ID
function generateReportId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `ER-${timestamp}-${random}`.toUpperCase();
}

// Save emergency report to localStorage
function saveEmergencyReport(report) {
    state.emergencyReports.push(report);
    localStorage.setItem('emergencyReports', JSON.stringify(state.emergencyReports));
    console.log('Emergency report saved:', report);
}

// Show report confirmation page
function showReportConfirmation(report) {
    // Update confirmation details
    document.getElementById('confirmation-report-id').textContent = report.reportId;
    document.getElementById('confirmation-timestamp').textContent = new Date(report.timestamp).toLocaleString();
    document.getElementById('confirmation-type').textContent = getEmergencyTypeDisplay(report.emergencyType);
    document.getElementById('confirmation-severity').textContent = getSeverityDisplay(report.severity);
    document.getElementById('confirmation-location').textContent = report.address;
    
    // Show confirmation page
    showPage('confirmation');
    updateNavActiveState('confirmation');
}

// Get emergency type display name
function getEmergencyTypeDisplay(type) {
    const types = {
        'fire': '🔥 Fire',
        'medical': '🏥 Medical',
        'crime': '🚔 Crime',
        'accident': '🚗 Accident',
        'other': '❓ Other'
    };
    return types[type] || type;
}

// Get severity display name
function getSeverityDisplay(severity) {
    const severities = {
        'low': '🟢 Low',
        'medium': '🟡 Medium',
        'high': '🟠 High',
        'critical': '🔴 Critical'
    };
    return severities[severity] || severity;
}

// Show specific page
function showPage(pageId) {
    pages.forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`${pageId}-page`).classList.add('active');
    
    // If showing dashboard, update its content
    if (pageId === 'dashboard') {
        updateDashboard();
    }
    
    // If showing report page, reset form
    if (pageId === 'report') {
        resetReportForm();
    }
}

// Reset report form
function resetReportForm() {
    document.getElementById('emergency-report-form').reset();
    clearReportErrors();
    document.getElementById('location-status').textContent = '';
    document.getElementById('coordinates-display').classList.add('hidden');
    
    // Reset map to default Karachi view
    const karachiCoords = [24.8607, 67.0011];
    state.map.setView(karachiCoords, 12);
    
    // Update marker
    if (state.mapMarker) {
        state.map.removeLayer(state.mapMarker);
    }
    
    state.mapMarker = L.marker(karachiCoords)
        .addTo(state.map)
        .bindPopup('Default location: Karachi')
        .openPopup();
}

// Update navigation active state
function updateNavActiveState(activePage) {
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === activePage) {
            link.classList.add('active');
        }
    });
}

// Check authentication status
function checkAuthentication() {
    const token = localStorage.getItem('authToken');
    if (!token && window.location.hash === '#dashboard') {
        showPage('login');
        updateNavActiveState('login');
    }
}

// Handle login form submission
function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    // Clear previous errors
    clearErrors('login');
    
    // Validate form
    if (!validateLoginForm(email, password)) {
        return;
    }
    
    // Authenticate user
    authenticateUser(email, password);
}

// Handle register form submission
function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const role = document.getElementById('register-role').value;
    
    // Clear previous errors
    clearErrors('register');
    
    // Validate form
    if (!validateRegisterForm(name, email, password, confirmPassword, role)) {
        return;
    }
    
    // Register user
    registerUser(name, email, password, role);
}

// Validate login form
function validateLoginForm(email, password) {
    let isValid = true;
    
    if (!email) {
        showError('login-email-error', 'Email is required');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showError('login-email-error', 'Please enter a valid email address');
        isValid = false;
    }
    
    if (!password) {
        showError('login-password-error', 'Password is required');
        isValid = false;
    }
    
    return isValid;
}

// Validate register form
function validateRegisterForm(name, email, password, confirmPassword, role) {
    let isValid = true;
    
    if (!name) {
        showError('register-name-error', 'Full name is required');
        isValid = false;
    }
    
    if (!email) {
        showError('register-email-error', 'Email is required');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showError('register-email-error', 'Please enter a valid email address');
        isValid = false;
    }
    
    if (!password) {
        showError('register-password-error', 'Password is required');
        isValid = false;
    } else if (password.length < 6) {
        showError('register-password-error', 'Password must be at least 6 characters');
        isValid = false;
    }
    
    if (!confirmPassword) {
        showError('register-confirm-password-error', 'Please confirm your password');
        isValid = false;
    } else if (password !== confirmPassword) {
        showError('register-confirm-password-error', 'Passwords do not match');
        isValid = false;
    }
    
    if (!role) {
        showError('register-role-error', 'Please select a role');
        isValid = false;
    }
    
    return isValid;
}

// Check if email is valid
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Show error message
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
    }
}

// Clear error messages
function clearErrors(formType) {
    const errorElements = document.querySelectorAll(`#${formType}-page .error-message`);
    errorElements.forEach(element => {
        element.textContent = '';
    });
    
    // Clear message
    const messageElement = document.getElementById(`${formType}-message`);
    if (messageElement) {
        messageElement.textContent = '';
        messageElement.className = 'message';
    }
}

// Show message
function showMessage(elementId, message, type) {
    const messageElement = document.getElementById(elementId);
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `message ${type}`;
    }
}

// Authenticate user
function authenticateUser(email, password) {
    // Get users from state
    const users = state.users;
    
    console.log('Attempting login with:', { email, password });
    console.log('Available users:', users);
    
    // Find user with matching email and password
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        console.log('User found:', user);
        // Check if user is trying to login as admin with unauthorized email
        if (user.role === 'admin' && email !== state.ALLOWED_ADMIN_EMAIL) {
            showMessage('login-message', 'Admin access is restricted to authorized personnel only. It is not feasible to login as admin with this account. Please login with a different role or contact system administrator.', 'error');
            return;
        }
        
        // Create auth token (in a real app, this would be generated by the server)
        const authToken = generateToken();
        
        // Store user data in localStorage
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('userName', user.name);
        localStorage.setItem('userEmail', user.email);
        
        // Update state
        state.currentUser = {
            name: user.name,
            email: user.email,
            role: user.role
        };
        
        // Update UI
        updateUIForUser();
        
        // Show success message
        showMessage('login-message', 'Login successful! Redirecting to dashboard...', 'success');
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
            showPage('dashboard');
            updateNavActiveState('dashboard');
        }, 1500);
    } else {
        console.log('Login failed - no matching user found');
        // Check if user is trying to login as admin with wrong password
        if (email === state.ALLOWED_ADMIN_EMAIL) {
            showMessage('login-message', 'Invalid admin credentials. Please use the correct password "admin123" for the admin account.', 'error');
        } else {
            showMessage('login-message', 'Invalid email or password. Please try again or register for a new account.', 'error');
        }
    }
}

// Register user
function registerUser(name, email, password, role) {
    // Get users from state
    const users = state.users;
    
    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    
    if (existingUser) {
        showMessage('register-message', 'User with this email already exists. Please login or use a different email.', 'error');
        return;
    }
    
    // Prevent registration with admin email
    if (email === state.ALLOWED_ADMIN_EMAIL) {
        showMessage('register-message', 'This email is reserved for admin use only. It is not feasible to sign up as admin. Please use a different email address or contact system administrator for admin access.', 'error');
        return;
    }
    
    // Add new user
    const newUser = {
        id: generateId(),
        name,
        email,
        password, // In a real app, this would be hashed
        role,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    state.users = users;
    localStorage.setItem('users', JSON.stringify(users));
    
    showMessage('register-message', 'Registration successful! Redirecting to login...', 'success');
    
    // Redirect to login after a short delay
    setTimeout(() => {
        showPage('login');
        updateNavActiveState('login');
        
        // Clear form
        document.getElementById('register-form').reset();
    }, 2000);
}

// Update UI for logged in user
function updateUIForUser() {
    if (state.currentUser) {
        userGreeting.textContent = `Welcome, ${state.currentUser.name}`;
        userRole.textContent = getRoleDisplayName(state.currentUser.role);
        
        // Add special class for admin role
        if (state.currentUser.role === 'admin') {
            userRole.classList.add('admin');
        } else {
            userRole.classList.remove('admin');
        }
        
        logoutBtn.classList.remove('hidden');
        dashboardNav.classList.remove('hidden');
        reportNav.classList.remove('hidden');
    } else {
        userGreeting.textContent = 'Welcome, Guest';
        userRole.textContent = 'Not Logged In';
        userRole.classList.remove('admin');
        logoutBtn.classList.add('hidden');
        dashboardNav.classList.add('hidden');
        reportNav.classList.add('hidden');
    }
}

// Handle logout
function handleLogout() {
    // Clear user data from localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    
    // Update state
    state.currentUser = null;
    
    // Update UI
    updateUIForUser();
    
    // Redirect to home page
    showPage('home');
    updateNavActiveState('home');
    
    // Show logout message
    showPopup('Logout', 'You have been successfully logged out.');
}

// Update dashboard content based on user role
function updateDashboard() {
    const dashboardTitle = document.getElementById('dashboard-title');
    const dashboardInfo = document.getElementById('dashboard-info');
    const dashboardContent = document.getElementById('dashboard-content');
    
    if (state.currentUser) {
        dashboardTitle.textContent = `Welcome, ${state.currentUser.name}`;
        dashboardInfo.textContent = `Role: ${getRoleDisplayName(state.currentUser.role)} | ${new Date().toLocaleDateString()}`;
        dashboardContent.innerHTML = getRoleSpecificContent(state.currentUser.role);
    } else {
        dashboardTitle.textContent = 'Access Denied';
        dashboardInfo.textContent = 'Please log in to access the dashboard';
        dashboardContent.innerHTML = '<p>You need to be logged in to view this page.</p>';
    }
}

// Get role display name
function getRoleDisplayName(role) {
    const roleNames = {
        'citizen': 'Citizen',
        'dispatcher': 'Dispatcher',
        'hospital': 'Hospital Staff',
        'police': 'Police Officer',
        'admin': 'Administrator'
    };
    
    return roleNames[role] || role;
}

// Get role-specific content for dashboard
function getRoleSpecificContent(role) {
    const content = {
        'citizen': `
            <div class="role-card">
                <h3>Emergency Reporting</h3>
                <p>Report emergencies and track their status.</p>
                <div class="role-actions">
                    <button class="role-btn" onclick="showPage('report')">Report Emergency</button>
                    <button class="role-btn" onclick="showPopup('My Reports', 'Your emergency reports would be displayed here.')">View My Reports</button>
                </div>
            </div>
            <div class="role-card">
                <h3>Emergency Resources</h3>
                <p>Access emergency contacts and resources.</p>
                <div class="role-actions">
                    <button class="role-btn" onclick="showPopup('Emergency Contacts', 'Emergency contacts would be displayed here.')">Emergency Contacts</button>
                    <button class="role-btn" onclick="showPopup('Safety Tips', 'Safety tips would be displayed here.')">Safety Tips</button>
                </div>
            </div>
        `,
        'dispatcher': `
            <div class="role-card">
                <h3>Emergency Dispatch</h3>
                <p>Manage and assign emergency responses.</p>
                <div class="role-actions">
                    <button class="role-btn" onclick="showPopup('Active Emergencies', 'Active emergencies would be displayed here.')">Active Emergencies</button>
                    <button class="role-btn" onclick="showPopup('Assign Responders', 'Responder assignment interface would open here.')">Assign Responders</button>
                    <button class="role-btn" onclick="showPopup('Response Teams', 'Response teams would be displayed here.')">Response Teams</button>
                </div>
            </div>
            <div class="role-card">
                <h3>System Monitoring</h3>
                <p>Monitor system status and performance.</p>
                <div class="role-actions">
                    <button class="role-btn" onclick="showPopup('System Status', 'System status would be displayed here.')">System Status</button>
                    <button class="role-btn" onclick="showPopup('Generate Reports', 'Report generation would start here.')">Generate Reports</button>
                </div>
            </div>
        `,
        'hospital': `
            <div class="role-card">
                <h3>Medical Cases</h3>
                <p>Receive and manage medical emergency cases.</p>
                <div class="role-actions">
                    <button class="role-btn" onclick="showPopup('Medical Cases', 'Medical cases would be displayed here.')">Medical Cases</button>
                    <button class="role-btn" onclick="showPopup('Update Patient Status', 'Patient status update interface would open here.')">Update Patient Status</button>
                    <button class="role-btn" onclick="showPopup('Manage Resources', 'Resource management interface would open here.')">Manage Resources</button>
                </div>
            </div>
            <div class="role-card">
                <h3>Hospital Resources</h3>
                <p>Manage hospital capacity and resources.</p>
                <div class="role-actions">
                    <button class="role-btn" onclick="showPopup('Bed Availability', 'Bed availability would be displayed here.')">Bed Availability</button>
                    <button class="role-btn" onclick="showPopup('Staff Management', 'Staff management interface would open here.')">Staff Management</button>
                </div>
            </div>
        `,
        'police': `
            <div class="role-card">
                <h3>Law Enforcement</h3>
                <p>Handle law enforcement emergencies and incidents.</p>
                <div class="role-actions">
                    <button class="role-btn" onclick="showPopup('Law Enforcement Cases', 'Law enforcement cases would be displayed here.')">Law Enforcement Cases</button>
                    <button class="role-btn" onclick="showPopup('Update Case Status', 'Case status update interface would open here.')">Update Case Status</button>
                    <button class="role-btn" onclick="showPopup('Manage Patrols', 'Patrol management interface would open here.')">Manage Patrols</button>
                </div>
            </div>
            <div class="role-card">
                <h3>Police Resources</h3>
                <p>Access police resources and personnel.</p>
                <div class="role-actions">
                    <button class="role-btn" onclick="showPopup('Available Units', 'Available police units would be displayed here.')">Available Units</button>
                    <button class="role-btn" onclick="showPopup('Incident Reports', 'Incident report generation would start here.')">Incident Reports</button>
                </div>
            </div>
        `,
        'admin': `
            <div class="role-card admin-features">
                <h3>Administrator Panel</h3>
                <p>Full system access and management capabilities.</p>
                <div class="role-actions">
                    <button class="role-btn" onclick="showPopup('User Management', 'User management interface would open here.')">Manage Users</button>
                    <button class="role-btn" onclick="showPopup('System Configuration', 'System configuration panel would open here.')">System Config</button>
                    <button class="role-btn" onclick="showPopup('Audit Logs', 'System audit logs would be displayed here.')">View Audit Logs</button>
                </div>
            </div>
            <div class="role-card admin-features">
                <h3>User Management</h3>
                <p>Manage system users and their roles.</p>
                <div class="role-actions">
                    <button class="role-btn" onclick="showPopup('View Users', 'User management interface would open here.')">View Users</button>
                    <button class="role-btn" onclick="showPopup('Add User', 'Add user interface would open here.')">Add User</button>
                    <button class="role-btn" onclick="showPopup('Manage Roles', 'Role management interface would open here.')">Manage Roles</button>
                </div>
            </div>
            <div class="role-card admin-features">
                <h3>System Configuration</h3>
                <p>Configure system settings and parameters.</p>
                <div class="role-actions">
                    <button class="role-btn" onclick="showPopup('System Settings', 'System settings would be displayed here.')">System Settings</button>
                    <button class="role-btn" onclick="showPopup('Backup Data', 'Data backup would start here.')">Backup Data</button>
                    <button class="role-btn" onclick="showPopup('System Logs', 'System logs would be displayed here.')">System Logs</button>
                </div>
            </div>
            <div class="role-card admin-features">
                <h3>Analytics & Reports</h3>
                <p>View system analytics and generate reports.</p>
                <div class="role-actions">
                    <button class="role-btn" onclick="showPopup('View Analytics', 'System analytics would be displayed here.')">View Analytics</button>
                    <button class="role-btn" onclick="showPopup('Generate Reports', 'System report generation would start here.')">Generate Reports</button>
                </div>
            </div>
        `
    };
    
    return content[role] || '<p>No content available for your role.</p>';
}

// Generate token
function generateToken() {
    return 'token_' + Math.random().toString(36).substr(2) + Date.now().toString(36);
}

// Generate ID
function generateId() {
    return 'user_' + Math.random().toString(36).substr(2) + Date.now().toString(36);
}

// Popup functions
function showPopup(title, message) {
    document.getElementById('popup-title').textContent = title;
    document.getElementById('popup-message').textContent = message;
    document.getElementById('popup').classList.remove('hidden');
}

function closePopup() {
    document.getElementById('popup').classList.add('hidden');
}