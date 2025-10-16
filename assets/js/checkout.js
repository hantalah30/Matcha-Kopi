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

  // Fungsi update kartu pratinjau (tetap sama)
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

  // --- PERBAIKAN TOTAL PADA FUNGSI SUBMIT ---
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

    // 1. Simpan pesanan ke Firestore
    db.collection("orders")
      .add(orderData)
      .then(() => {
        // 2. Siapkan pesan dan URL WhatsApp
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

        // 3. Tampilkan animasi sukses
        successOverlay.classList.add("show");
        localStorage.removeItem("kopiMatchaCart");

        // 4. ALIHKAN KE HALAMAN THANKYOU/REVIEW, BUKAN LANGSUNG KE WHATSAPP
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
