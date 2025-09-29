// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAI1Qh4eL5xS5w6_cqKA1iN8fFaCrddw8o",
  authDomain: "ravi-payroll.firebaseapp.com",
  databaseURL: "https://ravi-payroll-default-rtdb.firebaseio.com",
  projectId: "ravi-payroll",
  storageBucket: "ravi-payroll.firebasestorage.app",
  messagingSenderId: "228526283867",
  appId: "1:228526283867:web:39cc6d842bb2b991be737e"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database };
