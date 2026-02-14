import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
   apiKey: "AIzaSyAbcosP9y2czuIJmzJfNwZdZm9H8Oukzak",
    authDomain: "demo3-rt360-2secciones.firebaseapp.com",
    projectId: "demo3-rt360-2secciones",
    storageBucket: "demo3-rt360-2secciones.firebasestorage.app",
    messagingSenderId: "1026745450194",
    appId: "1:1026745450194:web:0914754c167b94f420f70b",
    measurementId: "G-77VZPQEBSB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
export const APP_ID = 'logistica-pro-360';
