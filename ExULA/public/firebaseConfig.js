// frontend/firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyC-B_N3iFVui8MkoYOJdQRswvp2Jfmxz4s",
  authDomain: "hackathon-2025-39b06.firebaseapp.com",
  projectId: "hackathon-2025-39b06",
  storageBucket: "hackathon-2025-39b06.firebasestorage.app",
  messagingSenderId: "673968459579",
  appId: "1:673968459579:web:03ce7433cb5f1bb257f11e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
