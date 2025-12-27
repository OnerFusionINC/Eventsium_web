
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
const functions = firebase.functions();
const storage = firebase.storage();

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

// SMART LOGIN LOGIC
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

    // Call Cloud Function to resolve Alias
    const resolveFn = functions.httpsCallable('resolveLoginEmail');
    
    resolveFn({ email: email })
        .then(result => {
            const realEmail = result.data.email;
            // Proceed with Auth using the REAL email
            return auth.signInWithEmailAndPassword(realEmail, password);
        })
        .then(() => {
             btn.innerText = "Success!";
        })
        .catch(error => {
            console.error(error);
            btn.innerText = originalText;
            btn.disabled = false;
            
            let msg = error.message;
            if (error.code === 'auth/wrong-password') msg = "Incorrect Password.";
            else if (error.code === 'auth/user-not-found') msg = "User not found.";
            alert('Login Failed: ' + msg);
        });
});

window.logout = function() {
    auth.signOut();
}

// OTP RESET LOGIC
window.showOtpModal = function() {
    document.getElementById('otpModal').style.display = 'flex';
    const mainEmail = document.getElementById('emailInput').value;
    if (mainEmail) document.getElementById('resetEmailInput').value = mainEmail;
}
window.closeOtpModal = function() {
    document.getElementById('otpModal').style.display = 'none';
    document.getElementById('otpStep1').style.display = 'block';
    document.getElementById('otpStep2').style.display = 'none';
    document.getElementById('otpInput').value = '';
    document.getElementById('newPasswordInput').value = '';
}
window.sendOtp = function() {
    const email = document.getElementById('resetEmailInput').value;
    if (!email) { alert("Email required"); return; }
    
    const btn = event.target;
    btn.innerText = "Sending...";
    btn.disabled = true;

    functions.httpsCallable('sendForgotPasswordOtp')({ email: email })
        .then(() => {
             alert('OTP sent via Email!');
             document.getElementById('otpStep1').style.display = 'none';
             document.getElementById('otpStep2').style.display = 'block';
             btn.innerText = "Send OTP Code";
             btn.disabled = false;
        })
        .catch(e => {
            alert(e.message);
            btn.innerText = "Send OTP Code";
            btn.disabled = false;
        });
}
window.submitOtpReset = function() {
    const email = document.getElementById('resetEmailInput').value;
    const otp = document.getElementById('otpInput').value;
    const pass = document.getElementById('newPasswordInput').value;
    
    if(!otp || !pass) { alert("Fill all fields"); return; }

    const btn = event.target;
    btn.innerText = "Resetting...";
    btn.disabled = true;
    
    functions.httpsCallable('resetPasswordWithOtp')({ email: email, otp: otp, newPassword: pass })
        .then(() => {
            alert('Password Reset Success! Login now.');
            closeOtpModal();
            document.getElementById('passwordInput').value = pass;
            btn.innerText = "Set New Password";
            btn.disabled = false;
        })
        .catch(e => {
            alert(e.message);
            btn.innerText = "Set New Password";
            btn.disabled = false;
        });
}


// --- EVENTS LOGIC V2.0 ---

function loadStats() {
    // Basic stats
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
            // Fallback for date display
            let dateStr = 'TBA';
            if (data.startTime) dateStr = new Date(data.startTime.seconds * 1000).toLocaleDateString();
            else if (data.date) dateStr = new Date(data.date.seconds * 1000).toLocaleDateString();

            const isHidden = data.isHidden ? '<span style="color:#ef4444; font-size: 0.8em; border:1px solid #ef4444; padding:2px 6px; border-radius:4px; margin-left:8px;">HIDDEN</span>' : '';
            const isPaid = data.isPaid ? '💰' : '';
            const isVirtual = data.isOnlineOverride ? '💻' : '';

            const item = document.createElement('div');
            item.className = 'event-item';
            item.innerHTML = `
                <div class="event-info">
                    <h4>${data.title} ${isHidden}</h4>
                    <div class="event-meta">
                        <span>📅 ${dateStr}</span>
                        <span>📍 ${data.city || 'Unknown City'}, ${data.country || ''} ${isVirtual}</span>
                        <span>🏷️ ${data.category || 'General'} ${isPaid}</span>
                    </div>
                </div>
                <div class="event-actions">
                    <button class="btn-sm btn-secondary" onclick="editEvent('${doc.id}')">Edit</button>
                    <button class="btn-sm btn-danger" onclick="deleteEvent('${doc.id}')">Delete</button>
                </div>
            `;
            listDiv.appendChild(item);
        });
    });
}

// Helper: Convert Date inputs
function toDateTimeLocal(dateObj) {
    if (!dateObj) return '';
    const d = new Date(dateObj.seconds * 1000);
    // Adjust for local timezone for input[type=datetime-local]
    const tzOffset = d.getTimezoneOffset() * 60000; 
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
}

const eventModal = document.getElementById('eventModal');

window.openModal = function() {
    document.getElementById('eventForm').reset();
    document.getElementById('eventId').value = '';
    document.getElementById('modalTitle').innerText = 'Add New Event (V2.2)';
    eventModal.style.display = 'flex';
}

window.closeModal = function() {
    eventModal.style.display = 'none';
}

// UPLOAD IMAGE LOGIC
window.uploadImage = function(input, targetId) {
    const file = input.files[0];
    if (!file) return;

    // Use label as loading indicator
    const label = input.parentElement;
    const originalText = label.innerText;
    label.innerText = "⏳ Uploading...";
    input.disabled = true;

    // Path: events/banners/{random}_{filename}
    const path = 'events/' + Date.now() + '_' + file.name;
    const ref = storage.ref().child(path);

    ref.put(file).then(snapshot => {
        return snapshot.ref.getDownloadURL();
    }).then(url => {
        document.getElementById(targetId).value = url;
        label.innerText = "✅ Done!";
        setTimeout(() => { 
             label.innerHTML = `📁 Upload <input type="file" onchange="uploadImage(this, '${targetId}')">`; 
        }, 2000);
    }).catch(error => {
        console.error(error);
        alert("Upload Failed: " + error.message);
        label.innerText = "❌ Error";
        input.disabled = false;
    });
}

window.saveEvent = function(e) {
    e.preventDefault();
    const id = document.getElementById('eventId').value;
    
    // Collecting Data V2.0
    const title = document.getElementById('title').value;
    const startStr = document.getElementById('startTime').value;
    const endStr = document.getElementById('endTime').value;
    const category = document.getElementById('category').value;
    const city = document.getElementById('city').value;
    const country = document.getElementById('country').value;
    const imageUrl = document.getElementById('imageUrl').value;
    const hostLogoUrl = document.getElementById('hostLogoUrl').value;
    const hostWebsite = document.getElementById('hostWebsite').value;
    const agenda = document.getElementById('agenda').value;
    
    const isOnlineOverride = document.getElementById('isOnlineOverride').checked;
    const isPaid = document.getElementById('isPaid').checked;

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const data = {
        title: title,
        date: firebase.firestore.Timestamp.fromDate(startDate), // App uses 'date' for sorting
        startTime: firebase.firestore.Timestamp.fromDate(startDate),
        endTime: firebase.firestore.Timestamp.fromDate(endDate),
        city: city, 
        country: country,
        category: category,
        
        // URLs
        imageUrl: imageUrl, // Banner
        hostLogoUrl: hostLogoUrl, 
        hostWebsite: hostWebsite, // Ticket Link
        
        // Details
        agenda: agenda,
        
        // Flags
        isOnlineOverride: isOnlineOverride,
        isPaid: isPaid,
        
        source: 'manual'
    };
    
    if (id) {
        db.collection('events').doc(id).update(data).then(() => { closeModal(); loadEvents(); });
    } else {
        db.collection('events').add(data).then(() => { closeModal(); loadEvents(); });
    }
}

window.editEvent = function(id) {
    db.collection('events').doc(id).get().then(doc => {
        const data = doc.data();
        document.getElementById('eventId').value = id;
        document.getElementById('modalTitle').innerText = 'Edit Event';
        
        // Fill Fields
        document.getElementById('title').value = data.title || '';
        document.getElementById('startTime').value = toDateTimeLocal(data.startTime || data.date);
        document.getElementById('endTime').value = toDateTimeLocal(data.endTime);
        document.getElementById('category').value = data.category || 'Tech';
        
        document.getElementById('city').value = data.city || '';
        document.getElementById('country').value = data.country || '';
        document.getElementById('imageUrl').value = data.imageUrl || '';
        document.getElementById('hostLogoUrl').value = data.hostLogoUrl || '';
        document.getElementById('hostWebsite').value = data.hostWebsite || '';
        document.getElementById('agenda').value = data.agenda || '';
        
        document.getElementById('isOnlineOverride').checked = data.isOnlineOverride || false;
        document.getElementById('isPaid').checked = data.isPaid || false;

        eventModal.style.display = 'flex';
    });
}

window.deleteEvent = function(id) {
    if(confirm('Dynamic Delete: This will permanently remove the event from the database and all devices. Confirm?')) {
        db.collection('events').doc(id).delete().then(() => loadEvents());
    }
}
