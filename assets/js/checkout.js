document.addEventListener("DOMContentLoaded", () => {
  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.error("Firebase tidak terinisialisasi.");
    document.body.innerHTML =
      "<h1>Error: Gagal memuat sistem. Coba refresh.</h1>";
    return;
  }

  const db = firebase.firestore();
  const checkoutItems = document.getElementById("checkout-items");
  const checkoutTotalPrice = document.getElementById("checkout-total-price");
  const checkoutForm = document.getElementById("checkout-form");
  const successOverlay = document.getElementById("success-overlay");

  const formatRupiah = (number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);

  const params = new URLSearchParams(window.location.search);
  const items = JSON.parse(params.get("items"));
  let total = 0;

  if (!items || items.length === 0) {
    document.querySelector(".checkout__container").innerHTML =
      "<h1>Keranjang Anda kosong. Silakan kembali dan pilih menu.</h1>";
    return;
  }

  items.forEach((item) => {
    const itemElement = document.createElement("div");
    itemElement.classList.add("checkout__item");
    itemElement.innerHTML = `
      <img src="${item.imageUrl}" alt="${item.name}" class="checkout__item-img">
      <div class="checkout__item-details">
          <span class="checkout__item-name">${item.name}</span>
          <span class="checkout__item-quantity">${item.quantity}x (${
      item.options.sugar
    }, ${item.options.ice})</span>
      </div>
      <span class="checkout__item-price">${formatRupiah(
        item.price * item.quantity
      )}</span>
    `;
    checkoutItems.appendChild(itemElement);
    total += item.price * item.quantity;
  });

  checkoutTotalPrice.innerText = formatRupiah(total);
  document.getElementById("card-total-preview").innerText = formatRupiah(total);

  // --- FUNGSI Generate data untuk sertifikat ---
  const certificateNumber = document.getElementById("certificate-number");
  const certificateDate = document.getElementById("certificate-date");

  if (certificateNumber && certificateDate) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    certificateNumber.textContent = `TK/${new Date().getFullYear()}/${randomNum}`;
    const today = new Date();
    certificateDate.textContent = today.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  // --- FUNGSI Untuk Mengunduh Sertifikat (DIPERBAIKI) ---
  const downloadBtn = document.getElementById("download-cert-btn");
  const certificateCard = document.getElementById("certificate-card");

  if (downloadBtn && certificateCard) {
    downloadBtn.addEventListener("click", () => {
      // Simpan gaya asli untuk dikembalikan nanti
      const originalStyle = {
        width: certificateCard.style.width,
        position: certificateCard.style.position,
        left: certificateCard.style.left,
        top: certificateCard.style.top,
      };

      // Terapkan gaya sementara untuk rendering resolusi tinggi
      Object.assign(certificateCard.style, {
        position: "absolute",
        left: "0",
        top: "0",
        width: "800px", // Paksa lebar menjadi besar
      });

      const options = {
        scale: 3, // Skala ditingkatkan untuk kejernihan maksimal
        useCORS: true,
        backgroundColor: null,
      };

      html2canvas(certificateCard, options)
        .then((canvas) => {
          const link = document.createElement("a");
          link.download = `sertifikat-titik-koma-${Date.now()}.png`;
          link.href = canvas.toDataURL("image/png");
          link.click();

          // Kembalikan gaya elemen ke kondisi semula setelah selesai
          Object.assign(certificateCard.style, originalStyle);
        })
        .catch((err) => {
          console.error("Gagal membuat canvas:", err);
          // Pastikan gaya tetap kembali normal meskipun terjadi error
          Object.assign(certificateCard.style, originalStyle);
        });
    });
  }

  // Fungsi update kartu pratinjau
  const nameInput = document.getElementById("name");
  const classScheduleInput = document.getElementById("class-schedule");
  const classroomInput = document.getElementById("classroom");

  const updateCardPreview = () => {
    document.getElementById("card-name-preview").textContent =
      nameInput.value || "-";
    const schedule = classScheduleInput.value;
    const room = classroomInput.value;
    document.getElementById("card-location-preview").textContent =
      schedule && room ? `${schedule} / ${room}` : "-";
  };
  [nameInput, classScheduleInput, classroomInput].forEach((input) =>
    input.addEventListener("input", updateCardPreview)
  );

  // --- Proses Submit Form ---
  checkoutForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const checkoutButton = e.target.querySelector(".checkout__button");
    checkoutButton.classList.add("loading");
    checkoutButton.disabled = true;

    const orderData = {
      customerName: document.getElementById("name").value,
      phone: document.getElementById("phone").value,
      classSchedule: document.getElementById("class-schedule").value,
      classroom: document.getElementById("classroom").value,
      paymentMethod: document.querySelector(
        'input[name="payment-method"]:checked'
      ).value,
      items: items,
      total: total,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: "pending",
    };

    db.collection("orders")
      .add(orderData)
      .then(() => {
        let message = `Halo, saya mau pesan:\n\n`;
        items.forEach((item) => {
          message += `- ${item.name} (${item.quantity}x)\n  (Opsi: ${item.options.sugar}, ${item.options.ice})\n\n`;
        });
        message += `*Total: ${formatRupiah(
          total
        )}*\n\n*Detail Pemesan:*\nNama: ${orderData.customerName}\nNo. HP: ${
          orderData.phone
        }\nLokasi: ${orderData.classSchedule} / ${
          orderData.classroom
        }\nBayar: ${orderData.paymentMethod}\n\nTerima kasih!`;
        const phoneNumber = "6287899451847";
        const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodeURIComponent(
          message
        )}`;

        successOverlay.classList.add("show");
        localStorage.removeItem("kopiMatchaCart");

        setTimeout(() => {
          window.location.href = `thankyou.html?items=${encodeURIComponent(
            JSON.stringify(items)
          )}&wa_url=${encodeURIComponent(whatsappUrl)}`;
        }, 2000);
      })
      .catch((error) => {
        console.error("Gagal menyimpan pesanan: ", error);
        alert("Gagal menyimpan pesanan. Silakan coba lagi.");
        checkoutButton.classList.remove("loading");
        checkoutButton.disabled = false;
      });
  });
});
