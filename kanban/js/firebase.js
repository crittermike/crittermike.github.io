/**
 * Firebase configuration and initialization
 */

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBIAM_tIBqFUYQl5r-f7e78lNPzc0fIDcM",
    authDomain: "big-orca.firebaseapp.com",
    projectId: "big-orca",
    storageBucket: "big-orca.firebasestorage.app",
    messagingSenderId: "338206440353",
    appId: "1:338206440353:web:a6af4374836968379d29e0"
};

// Initialize Firebase with improved persistence options
export const app = firebase.initializeApp(firebaseConfig);
export const database = firebase.database();
export const auth = firebase.auth();

// Enable offline persistence for the Realtime Database
database.ref('.info/connected').on('value', (snapshot) => {
    // We're connected or reconnected
    if (snapshot.val() === true) {
        console.log('Connected to Firebase Realtime Database');
    } else {
        console.log('Disconnected from Firebase Realtime Database');
    }
});
