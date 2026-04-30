import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage"; // <-- 1. Make sure this is here!

const firebaseConfig = {
  apiKey: "AIzaSyAG43OkmweuiuxwTPv6DDoPqSw_S5zbjUk",
  authDomain: "bookmylook-47824.firebaseapp.com",
  projectId: "bookmylook-47824",
  storageBucket: "bookmylook-47824.firebasestorage.app",
  messagingSenderId: "677663239827",
  appId: "1:677663239827:web:0f90aabd37c3d110c4e766"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app); // <-- 2. Make sure this is here!