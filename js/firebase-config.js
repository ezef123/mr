/* =========================================================================
   Подключение к Firebase: Auth + Realtime Database (compat SDK).
   Config взят из Firebase Console для проекта myrepublic-network.
   ========================================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyA3CQjynU-y8z-k-mnII9T3M-uhYIGs17M",
  authDomain: "myrepublic-network.firebaseapp.com",
  databaseURL: "https://myrepublic-network-default-rtdb.firebaseio.com",
  projectId: "myrepublic-network",
  storageBucket: "myrepublic-network.firebasestorage.app",
  messagingSenderId: "254718565649",
  appId: "1:254718565649:web:164a8ddb3d8205b504c0b0"
};

firebase.initializeApp(firebaseConfig);

const db   = firebase.database();
const auth = firebase.auth();
