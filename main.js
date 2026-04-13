import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDS3wMI446kdr0AvH8UFkFnnuVSyV6d0-Q",
  authDomain: "calendar-app-3ff19.firebaseapp.com",
  projectId: "calendar-app-3ff19",
  storageBucket: "calendar-app-3ff19.firebasestorage.app",
  messagingSenderId: "402960003673",
  appId: "1:402960003673:web:fbe2180b583f6cecbd3748"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ FIXED TEST FUNCTION
async function testFirebase() {
  try {
    await setDoc(doc(db, "test", "demo"), {
      working: true
    });
    console.log("✅ Data sent to Firebase");
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testFirebase();