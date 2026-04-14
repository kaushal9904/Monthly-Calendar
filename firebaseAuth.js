import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// 🔥 Firebase config (apna daal)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
};

// init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();

// 🔐 login function
export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

// 💾 save user
export const saveUser = async (user) => {
  await setDoc(doc(db, "users", user.uid), {
    name: user.displayName,
    email: user.email,
    photo: user.photoURL,
    createdAt: new Date()
  });
};