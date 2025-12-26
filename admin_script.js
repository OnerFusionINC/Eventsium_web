
// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCfx5OqurrB7_0LYjt28-Y5p0xSJNfWBpY",
    authDomain: "eventsium.firebaseapp.com",
    projectId: "eventsium",
    storageBucket: "eventsium.firebasestorage.app",
    messagingSenderId: "428409794632",
    appId: "1:428409794632:web:placeholder" 
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const logoutBtn = document.getElementById('logoutBtn');
const eventsList = document.getElementById('eventsList');
const eventModal = document.getElementById('eventModal');
const eventForm = document.getElementById('eventForm');

// AUTHORIZED ADMIN EMAILS
// Add any email here that should have access to the dashboard
const AUTHORIZED_EMAILS = [
    'support@eventsium.com',
    'ashutosh.vicky3@gmail.com',
    'admin@eventsium.com' 
];

auth.onAuthStateChanged(user => {
    if (user) {
        // Broaden access if needed, or stick to list
        // For now, let's keep it safe but allow generic logins if they are in the list.
        if (AUTHORIZED_EMAILS.includes(user.email) || user.email.endsWith('@eventsium.com')) {
             showDashboard();
             loadEvents();
        } else {
            alert("Unauthorized access level for: " + user.email + ". Please contact support to whitelist this email.");
            // auth.signOut(); // Option: Don't sign out immediately, just don't show dashboard.
        }
    } else {
        showLogin();
    }
});

function showLogin() {
    loginSection.style.display = 'block';
    dashboardSection.style.display = 'none';
    logoutBtn.style.display = 'none';
}

function showDashboard() {
    loginSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    logoutBtn.style.display = 'inline-block';
}

// Google Login
document.getElementById('googleLoginBtn').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => alert(error.message));
});

// Email/Pass Login
document.getElementById('emailLoginBtn').addEventListener('click', () => {
    const email = document.getElementById('emailInput').value;
    const pass = document.getElementById('passwordInput').value;
    if(!email || !pass) {
        alert("Please enter email and password");
        return;
    }
    auth.signInWithEmailAndPassword(email, pass)
        .catch(error => alert("Login Failed: " + error.message));
});

logoutBtn.addEventListener('click', () => auth.signOut());

// Load Events
function loadEvents() {
    eventsList.innerHTML = '<p>Loading...</p>';
    // Added index check safety: simpler query if composite index missing
    db.collection('events').orderBy('date', 'desc').onSnapshot(snapshot => {
        eventsList.innerHTML = '';
        snapshot.forEach(doc => {
            const event = doc.data();
            const date = event.date ? new Date(event.date.seconds * 1000).toLocaleString() : 'No date';
            
            const card = document.createElement('div');
            card.className = 'event-card';
            card.innerHTML = `
                <img src="${event.imageUrl || 'assets/images/placeholder.jpg'}" onerror="this.src='https://via.placeholder.com/300'">
                <h3>${event.title}</h3>
                <p style="color:#aaa; font-size: 0.9rem;">${date}</p>
                <p>${event.location}</p>
                <button onclick="editEvent('${doc.id}')" style="margin-top:10px; background:#444; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Edit</button>
                <button onclick="deleteEvent('${doc.id}')" style="margin-top:10px; background:#b91c1c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Delete</button>
            `;
            eventsList.appendChild(card);
        });
    }, error => {
        console.error("Error loading events (Check indexes):", error);
        eventsList.innerHTML = '<p style="color:red">Error loading events. Check console.</p>';
    });
}

window.openModal = function() {
    eventForm.reset();
    document.getElementById('eventId').value = '';
    document.getElementById('modalTitle').innerText = 'Add New Event';
    eventModal.style.display = 'flex';
}

window.closeModal = function() {
    eventModal.style.display = 'none';
}

eventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('eventId').value;
    const dateInput = document.getElementById('date').value;
    const date = new Date(dateInput);
    
    const data = {
        title: document.getElementById('title').value,
        date: firebase.firestore.Timestamp.fromDate(date),
        location: document.getElementById('location').value,
        category: document.getElementById('category').value,
        description: document.getElementById('description').value,
        imageUrl: document.getElementById('imageUrl').value,
        source: 'admin_portal'
    };

    if (id) {
        db.collection('events').doc(id).update(data)
            .then(() => closeModal())
            .catch(err => alert(err.message));
    } else {
        db.collection('events').add(data)
            .then(() => closeModal())
            .catch(err => alert(err.message));
    }
});

window.editEvent = function(id) {
    db.collection('events').doc(id).get().then(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        document.getElementById('eventId').value = id;
        document.getElementById('title').value = data.title;
        document.getElementById('location').value = data.location;
        document.getElementById('imageUrl').value = data.imageUrl || '';
        document.getElementById('description').value = data.description || '';
        document.getElementById('category').value = data.category || 'Tech';
        
        if (data.date) {
             const d = new Date(data.date.seconds * 1000);
             // Adjust to local ISO string accounting for timezone
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
