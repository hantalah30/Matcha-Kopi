document.addEventListener("DOMContentLoaded", () => {
  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.error("Firebase SDK tidak terinisialisasi.");
    return;
  }
  const db = firebase.firestore();

  const reviewForm = document.getElementById("review-form");
  const starsContainer = document.getElementById("rating-stars");
  const stars = starsContainer.querySelectorAll("i");
  const nameInput = document.getElementById("reviewer-name");
  const reviewInput = document.getElementById("review-text");
  const submitBtn = document.getElementById("submit-review-btn");
  const skipLink = document.getElementById("skip-link");

  const params = new URLSearchParams(window.location.search);
  const items = JSON.parse(params.get("items"));
  const whatsappUrl = params.get("wa_url");

  if (!items || !whatsappUrl) {
    document.querySelector(".review-box").innerHTML =
      "<h1>Data pesanan tidak ditemukan.</h1>";
    return;
  }

  skipLink.href = whatsappUrl; // Atur link untuk tombol lewati

  let currentRating = 0;

  // Logika interaksi bintang
  stars.forEach((star) => {
    star.addEventListener("mouseover", () => {
      const rating = star.dataset.value;
      stars.forEach((s) => {
        s.classList.toggle("ri-star-fill", s.dataset.value <= rating);
        s.classList.toggle("ri-star-line", s.dataset.value > rating);
      });
    });

    star.addEventListener("mouseout", () => {
      stars.forEach((s) => {
        s.classList.toggle("ri-star-fill", s.dataset.value <= currentRating);
        s.classList.toggle("ri-star-line", s.dataset.value > currentRating);
      });
    });

    star.addEventListener("click", () => {
      currentRating = star.dataset.value;
    });
  });

  // Tentukan kategori utama pesanan
  function getPrimaryCategory(orderItems) {
    let kopiCount = 0;
    let matchaCount = 0;
    orderItems.forEach((item) => {
      // Asumsi kategori ada di nama produk
      if (item.name.toLowerCase().includes("kopi")) {
        kopiCount += item.quantity;
      } else if (item.name.toLowerCase().includes("matcha")) {
        matchaCount += item.quantity;
      }
    });
    return matchaCount > kopiCount ? "matcha" : "kopi";
  }

  // Submit form
  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (currentRating === 0) {
      alert("Harap berikan rating bintang terlebih dahulu.");
      return;
    }

    submitBtn.classList.add("loading");
    submitBtn.disabled = true;

    const reviewData = {
      name: nameInput.value,
      reviewText: reviewInput.value,
      rating: parseInt(currentRating),
      category: getPrimaryCategory(items),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      await db.collection("reviews").add(reviewData);
      // Langsung redirect ke WhatsApp setelah berhasil
      window.location.href = whatsappUrl;
    } catch (error) {
      console.error("Gagal menyimpan review: ", error);
      alert("Gagal menyimpan ulasan, tapi pesanan Anda tetap diproses.");
      // Tetap redirect ke WhatsApp meskipun review gagal
      window.location.href = whatsappUrl;
    }
  });
});
