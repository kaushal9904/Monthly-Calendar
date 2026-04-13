import { doc, setDoc, onSnapshot } from "firebase/firestore";

// Get all checkboxes
const checkboxes = document.querySelectorAll('input[type="checkbox"]');

checkboxes.forEach((checkbox) => {
  const week = checkbox.dataset.week;
  const pri = checkbox.dataset.pri;

  // unique id
  const taskId = `${week}-${pri}`;
  const taskRef = doc(db, "tasks", taskId);

  // 🔥 SAVE DATA
  checkbox.addEventListener("change", async () => {
    await setDoc(taskRef, {
      completed: checkbox.checked,
    });
  });

  // 🔥 REALTIME SYNC
  onSnapshot(taskRef, (docSnap) => {
    if (docSnap.exists()) {
      checkbox.checked = docSnap.data().completed;
    }
  });
});
