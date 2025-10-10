// Konfigurasi Firebase Anda (disesuaikan untuk SDK v8)
const firebaseConfig = {
  apiKey: "AIzaSyBWMK0SdGKZGl5cNEFxbmlBkT6jf9AoGGI",
  authDomain: "kopimatcha-16061.firebaseapp.com",
  projectId: "kopimatcha-16061",
  storageBucket: "kopimatcha-16061.appspot.com",
  messagingSenderId: "830220434721",
  appId: "1:830220434721:web:133647b80b768dc4771260",
  measurementId: "G-VE4T78H302",
};

// Inisialisasi Firebase
// Pastikan file HTML Anda memuat skrip Firebase v8
if (typeof firebase !== "undefined") {
  const app = firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth();
  const storage = firebase.storage();
} else {
  console.error(
    "Firebase SDK tidak termuat. Pastikan skrip Firebase ada di file HTML Anda."
  );
}
