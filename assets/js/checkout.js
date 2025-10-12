document.addEventListener("DOMContentLoaded", () => {
  // Pastikan Firebase sudah siap
  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.error("Firebase tidak terinisialisasi.");
    document.body.innerHTML = "<h1>Error: Gagal memuat sistem.</h1>";
    return;
  }

  const db = firebase.firestore();
  const checkoutItems = document.getElementById("checkout-items");
  const checkoutTotalPrice = document.getElementById("checkout-total-price");
  const checkoutForm = document.getElementById("checkout-form");
  const successOverlay = document.getElementById("success-overlay");

  // Fungsi untuk format harga ke Rupiah
  const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  // Mendapatkan data item dari URL
  const params = new URLSearchParams(window.location.search);
  const items = JSON.parse(params.get("items"));
  let total = 0;

  if (items && items.length > 0) {
    items.forEach((item) => {
      const itemElement = document.createElement("div");
      itemElement.classList.add("checkout__item");
      itemElement.innerHTML = `
        <img src="${item.imageUrl}" alt="${
        item.name
      }" class="checkout__item-img">
        <div class="checkout__item-details">
            <span class="checkout__item-name">${item.name}</span>
            <span class="checkout__item-quantity">${item.quantity} pcs (${
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
  }

  checkoutTotalPrice.innerText = formatRupiah(total);

  checkoutForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const checkoutButton = e.target.querySelector(".checkout__button");
    checkoutButton.classList.add("loading");
    checkoutButton.disabled = true;

    // Kumpulkan semua data dari form
    const orderData = {
      customerName: document.getElementById("name").value,
      phone: document.getElementById("phone").value,
      classSchedule: document.getElementById("class-schedule").value,
      classroom: document.getElementById("classroom").value,
      paymentMethod: document.getElementById("payment-method").value,
      items: items,
      total: total,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: "pending", // Status awal pesanan
    };

    try {
      // **LANGKAH PENTING: Simpan data pesanan ke Firestore**
      await db.collection("orders").add(orderData);

      // Tampilkan animasi sukses
      successOverlay.classList.add("show");

      // Siapkan pesan WhatsApp
      let message = `Halo, saya mau pesan:\n\n`;
      items.forEach((item) => {
        message += `- ${item.name} (${item.quantity} pcs)\n`;
        message += `  (Opsi: ${item.options.sugar}, ${item.options.ice})\n`;
        message += `  Subtotal: ${formatRupiah(
          item.price * item.quantity
        )}\n\n`;
      });
      message += `*Total: ${formatRupiah(total)}*\n\n`;
      message += `*Detail Pemesan:*\n`;
      message += `Nama: ${orderData.customerName}\n`;
      message += `No. Telepon: ${orderData.phone}\n`;
      message += `Jadwal Kelas: ${orderData.classSchedule}\n`;
      message += `Ruangan: ${orderData.classroom}\n`;
      message += `Metode Pembayaran: ${orderData.paymentMethod}\n\n`;
      message += `Terima kasih!`;

      const phoneNumber = "+6287899451847"; // GANTI DENGAN NOMOR WA ANDA
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodeURIComponent(
        message
      )}`;

      // ==== PERBAIKAN UNTUK IPHONE ADA DI SINI ====
      // Setelah animasi selesai, alihkan halaman ini langsung ke WhatsApp.
      // Metode ini lebih andal di iOS daripada window.open().
      setTimeout(() => {
        window.location.href = whatsappUrl;
      }, 2500);
    } catch (error) {
      console.error("Gagal menyimpan pesanan: ", error);
      alert("Terjadi kesalahan saat membuat pesanan. Silakan coba lagi.");
      checkoutButton.classList.remove("loading");
      checkoutButton.disabled = false;
    }
  });
});
