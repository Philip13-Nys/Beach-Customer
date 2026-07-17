// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCK-OcxL1VnKr_b3Cps5B7_8GvuChQClCw",
  authDomain: "customeraccount-ce2ae.firebaseapp.com",
  projectId: "customeraccount-ce2ae",
  storageBucket: "customeraccount-ce2ae.firebasestorage.app",
  messagingSenderId: "9548262291",
  appId: "1:9548262291:web:d2ace301dcba4638671666"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth=getAuth();
export const db=getFirestore(app);
export default app;