import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCkQjghWrHCtpBwU8QTtup_L2F4-u5LL2A",
  authDomain: "tarjetacredito-82a4a.firebaseapp.com",
  projectId: "tarjetacredito-82a4a",
  storageBucket: "tarjetacredito-82a4a.firebasestorage.app",
  messagingSenderId: "120166410587",
  appId: "1:120166410587:web:e27a319b34d0920e6d527e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
export const APP_ID = 'logistica-pro-360';
