/* =========================================================================
   Подключение к Firebase: Auth + Realtime Database.
   ========================================================================= */

const FIREBASE_DB_URL = "https://myrepublic-network-default-rtdb.firebaseio.com/";

firebase.initializeApp({ databaseURL: FIREBASE_DB_URL });

const db   = firebase.database();
const auth = firebase.auth();
