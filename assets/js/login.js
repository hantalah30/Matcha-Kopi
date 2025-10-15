document.addEventListener("DOMContentLoaded", () => {
  if (typeof firebase === "undefined" || !firebase.auth) {
    console.error("Firebase Auth tidak terinisialisasi.");
    const loginError = document.getElementById("login-error");
    if (loginError)
      loginError.textContent = "Gagal memuat sistem. Coba refresh halaman.";
    return;
  }

  const auth = firebase.auth();
  const loginForm = document.getElementById("login-form");
  const loginButton = document.getElementById("login-button");
  const loginError = document.getElementById("login-error");
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("password-toggle");

  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener("click", () => {
      const type =
        passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);
      passwordToggle.classList.toggle("ri-eye-off-line");
      passwordToggle.classList.toggle("ri-eye-line");
    });
  }

  auth.onAuthStateChanged((user) => {
    if (user) {
      window.location.replace("admin.html");
    }
  });

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      loginButton.classList.add("loading");
      loginButton.disabled = true;
      loginError.textContent = "";

      const email = document.getElementById("email").value;
      const password = passwordInput.value;

      auth
        .signInWithEmailAndPassword(email, password)
        .then((userCredential) => {})
        .catch((error) => {
          if (
            error.code === "auth/user-not-found" ||
            error.code === "auth/wrong-password" ||
            error.code === "auth/invalid-credential"
          ) {
            loginError.textContent =
              "Email atau password yang Anda masukkan salah.";
          } else {
            loginError.textContent = "Terjadi kesalahan. Coba lagi nanti.";
          }
          loginButton.classList.remove("loading");
          loginButton.disabled = false;
        });
    });
  }
});
