
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore'
import { getStorage } from "firebase/storage";
// import firebaseui from 'firebaseui';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBT6cusdCse2rF7YQbKh5sEGQjF3UAPKjM",
    authDomain: "inventarioslabsceutec.firebaseapp.com",
    projectId: "inventarioslabsceutec",
    storageBucket: "inventarioslabsceutec.appspot.com",
    messagingSenderId: "1015499109529",
    appId: "1:1015499109529:web:113f40238169121bf43408",
    measurementId: "G-YTM0GKD1ZV"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const firestore = getFirestore(app);

//Auth
// Initialize the FirebaseUI Widget using Firebase.
// Initialize the FirebaseUI Widget using Firebase.


export { storage, firestore, app };
