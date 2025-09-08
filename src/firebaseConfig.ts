import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBNQbiMNfrjl5e7r2DIU6tEeznRkTNILd0",
  authDomain: "expense-tracker-50a2b.firebaseapp.com",
  projectId: "expense-tracker-50a2b",
  storageBucket: "expense-tracker-50a2b.appspot.com",
  messagingSenderId: "904042921800",
  appId: "1:904042921800:web:4e093f9c8bfa039e09fd7d"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
