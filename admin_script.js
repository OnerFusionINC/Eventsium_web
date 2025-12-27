
// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCfx5OqurrB7_0LYjt28-Y5p0xSJNfWBpY",
    authDomain: "eventsium.firebaseapp.com",
    projectId: "eventsium",
    storageBucket: "eventsium.firebasestorage.app",
    messagingSenderId: "428409794632",
    appId: "1:428409794632:web:placeholder"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions(); // Initialize Functions

// Auth State Listener
auth.onAuthStateChanged(user => {
    if (user) {
        showDashboard();
        loadStats();
        loadEvents();
    } else {
        showLogin();
    }
});

function showLogin() {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
}


document.getElementById('emailLoginBtn').addEventListener('click', () => {
    const emailRaw = document.getElementById('emailInput').value;
    const email = emailRaw ? emailRaw.trim() : ''; 
    const password = document.getElementById('passwordInput').value;
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    const btn = document.getElementById('emailLoginBtn');
    const originalText = btn.innerText;
    btn.innerText = "Checking account...";
    btn.disabled = true;

    // Smart Login: Check if this is an Alias
    const resolveFn = functions.httpsCallable('resolveLoginEmail');
    
    resolveFn({ email: email })
        .then(result => {
            const realEmail = result.data.email;
            const isAlias = result.data.isAlias;
            
            if (isAlias) {
                 console.log("Smart Login: Alias detected. Switching " + email + " -> " + realEmail);
            }
            
            // Proceed with Auth using the REAL email
            return auth.signInWithEmailAndPassword(realEmail, password);
        })
        .then(() => {
             // Success! Listener will handle redirect
             btn.innerText = "Success!";
        })
        .catch(error => {
            console.error(error);
            btn.innerText = originalText;
            btn.disabled = false;
            
            let msg = error.message;
            if (error.code === 'auth/wrong-password') {
                msg = "Incorrect Password.";
            } else if (error.code === 'auth/user-not-found') {
                msg = "User not found (check email).";
            }
            alert('Login Failed: ' + msg);
        });
});

window.logout = function() {
    auth.signOut();
}

// --- OTP PASSWORD RESET LOGIC ---

window.showOtpModal = function() {
    document.getElementById('otpModal').style.display = 'flex';
    // Pre-fill email if they typed it in main login
    const mainEmail = document.getElementById('emailInput').value;
    if (mainEmail) {
        document.getElementById('resetEmailInput').value = mainEmail;
    }
}

window.closeOtpModal = function() {
    document.getElementById('otpModal').style.display = 'none';
    document.getElementById('otpStep1').style.display = 'block';
    document.getElementById('otpStep2').style.display = 'none';
    // Reset inputs
    document.getElementById('otpInput').value = '';
    document.getElementById('newPasswordInput').value = '';
}

window.sendOtp = function() {
    const email = document.getElementById('resetEmailInput').value;
    if (!email) {
        alert("Please enter your email");
        return;
    }

    // Call Cloud Function
    const sendOtpFn = functions.httpsCallable('sendForgotPasswordOtp');
    
    // Show loading state
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "Sending...";
    btn.disabled = true;

    console.log("Calling sendForgotPasswordOtp for " + email);
    
    sendOtpFn({ email: email })
        .then(result => {
             console.log("OTP Sent Result:", result);
             alert('OTP sent to ' + email + '. Check your inbox (and SPAM folder).');
             document.getElementById('otpStep1').style.display = 'none';
             document.getElementById('otpStep2').style.display = 'block';
             btn.innerText = originalText;
             btn.disabled = false;
        })
        .catch(error => {
             console.error("OTP Error:", error);
             alert('Failed to send OTP: ' + error.message);
             btn.innerText = originalText;
             btn.disabled = false;
        });
}

window.submitOtpReset = function() {
    const email = document.getElementById('resetEmailInput').value;
    const otp = document.getElementById('otpInput').value;
    const newPassword = document.getElementById('newPasswordInput').value;

    if (!otp || !newPassword) {
        alert("Please enter valid OTP and New Password");
        return;
    }

    const resetFn = functions.httpsCallable('resetPasswordWithOtp');
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "Resetting...";
    btn.disabled = true;

    console.log("Calling resetPasswordWithOtp...");

    // Cloud Function expects: { email, otp, newPassword }
    resetFn({ email: email, otp: otp, newPassword: newPassword })
        .then(result => {
            console.log("Reset Result:", result);
            alert('Password Reset Successful! You can now login.');
            closeOtpModal();
            // Auto fill password field for convenience
            document.getElementById('emailInput').value = email;
            document.getElementById('passwordInput').value = newPassword;
            btn.innerText = originalText;
            btn.disabled = false;
            
            // Auto login?
            auth.signInWithEmailAndPassword(email, newPassword);
        })
        .catch(error => {
            console.error("Reset Error:", error);
            alert('Reset Failed: ' + error.message);
            btn.innerText = originalText;
            btn.disabled = false;
        });
}


// --- DASHBOARD LOGIC ---

function loadStats() {
    document.getElementById('userCount').innerText = '12'; // Mock
    
    db.collection('events').get().then(snap => {
        document.getElementById('eventCount').innerText = snap.size;
    });
}

function loadEvents() {
    db.collection('events').orderBy('date', 'desc').get().then(querySnapshot => {
        const listDiv = document.getElementById('eventsList');
        listDiv.innerHTML = '';
        
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const date = data.date ? new Date(data.date.seconds * 1000).toLocaleDateString() : 'TBA';
            
            const item = document.createElement('div');
            item.className = 'event-item';
            item.innerHTML = `
                <div class="event-info">
                    <h4>${data.title}</h4>
                    <div class="event-meta">
                        <span>📅 ${date}</span>
                        <span>📍 ${data.location || 'Online'}</span>
                        <span>🏷️ ${data.category || 'General'}</span>
                    </div>
                </div>
                <div class="event-actions">
                    <button class="btn-sm" onclick="editEvent('${doc.id}')">Edit</button>
                    <button class="btn-sm btn-danger" onclick="deleteEvent('${doc.id}')">Delete</button>
                </div>
            `;
            listDiv.appendChild(item);
        });
    });
}

// Modal Logic
const eventModal = document.getElementById('eventModal');

window.openModal = function() {
    document.getElementById('eventForm').reset();
    document.getElementById('eventId').value = '';
    document.getElementById('modalTitle').innerText = 'Add Event';
    eventModal.style.display = 'flex';
}

window.closeModal = function() {
    eventModal.style.display = 'none';
}

window.saveEvent = function(e) {
    e.preventDefault();
    const id = document.getElementById('eventId').value;
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const imageUrl = document.getElementById('imageUrl').value;
    const dateVal = document.getElementById('date').value;
    const category = document.getElementById('category').value;
    
    const data = {
        title, description, imageUrl, category,
        date: firebase.firestore.Timestamp.fromDate(new Date(dateVal)),
        location: 'TBD' // Default
    };
    
    if (id) {
        db.collection('events').doc(id).update(data).then(() => {
            closeModal();
            loadEvents();
        });
    } else {
        db.collection('events').add(data).then(() => {
            closeModal();
            loadEvents();
        });
    }
}

window.editEvent = function(id) {
    db.collection('events').doc(id).get().then(doc => {
        const data = doc.data();
        document.getElementById('eventId').value = id;
        document.getElementById('title').value = data.title;
        document.getElementById('imageUrl').value = data.imageUrl || '';
        document.getElementById('description').value = data.description || '';
        document.getElementById('category').value = data.category || 'Tech';
        if (data.date) {
             const d = new Date(data.date.seconds * 1000);
             const iso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
             document.getElementById('date').value = iso; 
        }
        document.getElementById('modalTitle').innerText = 'Edit Event';
        eventModal.style.display = 'flex';
    });
}

window.deleteEvent = function(id) {
    if(confirm('Are you sure you want to delete this event?')) {
        db.collection('events').doc(id).delete();
    }
}
