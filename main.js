// 🔥 IMPORTS
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// 🔥 FIREBASE CONFIG (your project)
const firebaseConfig = {
  apiKey: "AIzaSyDS3wMI446kdr0AvH8UFkFnnuVSyV6d0-Q",
  authDomain: "calendar-app-3ff19.firebaseapp.com",
  projectId: "calendar-app-3ff19",
  storageBucket: "calendar-app-3ff19.appspot.com",
  messagingSenderId: "402960003673",
  appId: "1:402960003673:web:fbe2180b583f6cecbd3748",
};

// 🔥 INIT FIREBASE
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("🔥 JS RUNNING");

// 🔥 GET ALL CHECKBOXES
const checkboxes = document.querySelectorAll('input[type="checkbox"]');

// 🔥 LOOP THROUGH EACH CHECKBOX
checkboxes.forEach((checkbox) => {
  const week = checkbox.dataset.week;
  const pri = checkbox.dataset.pri;

  const taskId = `${week}-${pri}`;
  const taskRef = doc(db, "tasks", taskId);

  // ✅ REAL-TIME SYNC (VERY IMPORTANT)
  onSnapshot(taskRef, (docSnap) => {
    if (docSnap.exists()) {
      checkbox.checked = docSnap.data().completed;
    }
  });

  // ✅ SAVE WHEN USER CLICKS
  checkbox.addEventListener("change", async () => {
    try {
      console.log("Saving:", taskId);

      await setDoc(taskRef, {
        completed: checkbox.checked,
      });
    } catch (error) {
      console.error("❌ Error:", error);
    }
  });
});
