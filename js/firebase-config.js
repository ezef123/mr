/* =========================================================================
   Подключение к Firebase Realtime Database.
   URL базы данных Республики Жакид.
   ========================================================================= */

const FIREBASE_DB_URL = "https://myrepublic-network-default-rtdb.firebaseio.com/";

firebase.initializeApp({ databaseURL: FIREBASE_DB_URL });
const db = firebase.database();
