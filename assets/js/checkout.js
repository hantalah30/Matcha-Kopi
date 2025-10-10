checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const checkoutButton = e.target.querySelector(".checkout__button");
  checkoutButton.classList.add("loading");
  checkoutButton.disabled = true;

  const orderData = {
    customerName: document.getElementById("name").value,
    phone: document.getElementById("phone").value,
    classSchedule: document.getElementById("class-schedule").value,
    classroom: document.getElementById("classroom").value,
    paymentMethod: document.getElementById("payment-method").value,
    items: items,
    total: total,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    status: "pending",
  };

  try {
    // Simpan data pesanan ke Firestore
    await db.collection("orders").add(orderData);

    // Tampilkan animasi sukses
    successOverlay.classList.add("show");

    // Siapkan pesan WhatsApp
    let message = `Halo, saya mau pesan:\n\n`;
    items.forEach((item) => {
      message += `- ${item.name} (${item.quantity} pcs) - ${formatRupiah(
        item.price * item.quantity
      )}\n`;
    });
    message += `\n*Total: ${formatRupiah(total)}*\n\n`;
    message += `*Detail Pemesan:*\n`;
    message += `Nama: ${orderData.customerName}\n`;
    message += `No. Telepon: ${orderData.phone}\n`;
    message += `Jadwal Kelas: ${orderData.classSchedule}\n`;
    message += `Ruangan: ${orderData.classroom}\n`;
    message += `Metode Pembayaran: ${orderData.paymentMethod}\n\n`;
    message += `Terima kasih!`;

    const phoneNumber = "+6285775603396";
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodeURIComponent(
      message
    )}`;

    // PERUBAHAN UTAMA DI SINI:
    // Setelah animasi selesai, alihkan halaman ini ke WhatsApp
    setTimeout(() => {
      // Menggunakan window.location.href lebih andal di iPhone
      window.location.href = whatsappUrl;
    }, 2500);
  } catch (error) {
    console.error("Gagal menyimpan pesanan: ", error);
    alert("Terjadi kesalahan saat membuat pesanan. Silakan coba lagi.");
    checkoutButton.classList.remove("loading");
    checkoutButton.disabled = false;
  }
});
