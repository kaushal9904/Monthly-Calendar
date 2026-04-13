// 🔥 IMPORTS
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// 🔥 CONFIG (your own)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "calendar-app-3ff19.firebaseapp.com",
  projectId: "calendar-app-3ff19",
  storageBucket: "calendar-app-3ff19.appspot.com",
  messagingSenderId: "402960003673",
  appId: "1:402960003673:web:fbe2180b583f6cecbd3748",
};

// 🔥 INIT FIREBASE
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ CHECK JS RUNNING
console.log("JS RUNNING");

// 🔥 GET CHECKBOXES
const checkboxes = document.querySelectorAll('input[type="checkbox"]');

checkboxes.forEach((checkbox) => {
  const week = checkbox.dataset.week;
  const pri = checkbox.dataset.pri;

  const taskId = `${week}-${pri}`;
  const taskRef = doc(db, "tasks", taskId);

  // SAVE
  checkbox.addEventListener("change", async () => {
    console.log("Saving:", taskId);

    await setDoc(taskRef, {
      completed: checkbox.checked,
    });
  });

  // REALTIME
  onSnapshot(taskRef, (docSnap) => {
    if (docSnap.exists()) {
      checkbox.checked = docSnap.data().completed;
    }
  });
});
