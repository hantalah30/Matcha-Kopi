document.addEventListener("DOMContentLoaded", function () {
  if (typeof firebase === "undefined" || !firebase.auth) {
    console.error("Firebase tidak terinisialisasi.");
    // Tampilkan pesan error jika perlu
    return;
  }

  const db = firebase.firestore();
  const auth = firebase.auth();
  let salesChartInstance, categoryChartInstance;

  auth.onAuthStateChanged((user) => {
    if (user) {
      initAdminApp();
    } else {
      window.location.replace("login.html"); // Pastikan ekstensi .html ada
    }
  });

  function initAdminApp() {
    setupEventListeners();
    loadDashboardData();
    renderOrderTable();
    renderProductTable();
    setupSpecialsCRUD();
    setupReviewsCRUD();
    setupPopupSettings(); // <--- Tambahkan ini
    renderFeedbackList(); // <--- TAMBAHKAN INI
  }

  function setupEventListeners() {
    const sidebarToggleDesktop = document.getElementById(
      "sidebar-toggle-desktop"
    );
    const sidebarToggleMobile = document.getElementById(
      "sidebar-toggle-mobile"
    );
    const body = document.body;
    const sidebar = document.getElementById("sidebar");
    const sidebarLinks = document.querySelectorAll(".sidebar__link");

    sidebarToggleDesktop.addEventListener("click", () => {
      body.classList.toggle("sidebar-collapsed");
    });

    sidebarToggleMobile.addEventListener("click", () => {
      body.classList.toggle("sidebar-show");
    });

    // Menutup sidebar mobile ketika area di luar sidebar diklik
    document.addEventListener("click", (e) => {
      if (
        body.classList.contains("sidebar-show") &&
        !sidebar.contains(e.target) &&
        e.target !== sidebarToggleMobile &&
        !sidebarToggleMobile.contains(e.target)
      ) {
        body.classList.remove("sidebar-show");
      }
    });

    sidebarLinks.forEach((link, index) => {
      // Tambahkan index
      link.addEventListener("click", (e) => {
        if (link.id === "logout-btn") return;
        e.preventDefault();

        sidebarLinks.forEach((l) => l.classList.remove("active-link"));
        link.classList.add("active-link");

        // Logika indikator aktif (jika ada elemen indikator)
        const indicator = document.querySelector(".sidebar__active-indicator");
        if (indicator) {
          indicator.style.top = `${link.offsetTop}px`;
        }

        const targetPageId = link.getAttribute("href").substring(1);
        document.querySelectorAll(".admin-page").forEach((page) => {
          page.classList.remove("active-page");
        });
        const targetPage = document.getElementById(`page-${targetPageId}`);
        if (targetPage) {
          targetPage.classList.add("active-page");
        } else {
          console.error(`Page with id page-${targetPageId} not found.`);
          // Arahkan ke dashboard jika halaman target tidak ada
          document
            .getElementById("page-dashboard")
            .classList.add("active-page");
          sidebarLinks[0].classList.add("active-link"); // Aktifkan link dashboard
          if (indicator) indicator.style.top = `${sidebarLinks[0].offsetTop}px`;
        }

        body.classList.remove("sidebar-show");
      });
    });

    document.getElementById("logout-btn").addEventListener("click", (e) => {
      e.preventDefault();
      auth.signOut().then(() => window.location.replace("login.html")); // Pastikan ekstensi .html ada
    });

    // Close modals
    document.querySelectorAll(".close-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".modal")
          .forEach((modal) => (modal.style.display = "none"));
      });
    });
    window.addEventListener("click", (event) => {
      document.querySelectorAll(".modal").forEach((modal) => {
        if (event.target == modal) {
          modal.style.display = "none";
        }
      });
    });
  }

  // --- Fungsi Format ---
  const formatRupiah = (number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  const formatDate = (timestamp) =>
    timestamp
      ? timestamp.toDate().toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "N/A";
  const formatTime = (timestamp) =>
    timestamp
      ? timestamp
          .toDate()
          .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
      : "N/A";

  // --- Fungsi Notifikasi ---
  const notificationSound = document.getElementById("notification-sound");
  let isFirstOrderLoad = true;
  const showAdminNotification = (message, isSuccess = true) => {
    const notification = document.getElementById("admin-notification");
    if (!notification) return; // Tambahkan pengecekan
    notification.textContent = message;
    notification.className =
      "admin-notification show " + (isSuccess ? "success" : "error");
    setTimeout(() => notification.classList.remove("show"), 3000);
  };

  // --- Memuat Data Dashboard & Chart ---
  function loadDashboardData() {
    db.collection("orders").onSnapshot(async (snapshot) => {
      let totalRevenue = 0,
        totalItemsSold = 0,
        revenueToday = 0;
      const productSales = {},
        categorySales = { kopi: 0, matcha: 0 };
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const productsSnapshot = await db.collection("products").get();
      const productCategories = {};
      productsSnapshot.forEach((doc) => {
        productCategories[doc.data().name] = doc.data().category;
      });

      snapshot.forEach((doc) => {
        const order = doc.data();
        if (order.status === "completed") {
          totalRevenue += order.total;
          if (order.createdAt && order.createdAt.toDate() >= todayStart) {
            revenueToday += order.total;
          }
        }

        if (order.items && Array.isArray(order.items)) {
          // Pengecekan order.items
          order.items.forEach((item) => {
            if (item && item.name && item.quantity) {
              // Pengecekan item
              totalItemsSold += item.quantity;
              productSales[item.name] =
                (productSales[item.name] || 0) + item.quantity;
              const category = productCategories[item.name];
              if (category && item.price) {
                categorySales[category] =
                  (categorySales[category] || 0) + item.price * item.quantity;
              }
            } else {
              console.warn("Skipping invalid item in order:", doc.id, item);
            }
          });
        } else {
          console.warn("Order missing or invalid items array:", doc.id, order);
        }
      });

      // Update elemen DOM (tambahkan pengecekan elemen)
      const revenueTodayEl = document.getElementById("revenue-today");
      const totalRevenueEl = document.getElementById("total-revenue");
      const totalItemsSoldEl = document.getElementById("total-items-sold");
      const bestSellerEl = document.getElementById("best-seller");

      if (revenueTodayEl)
        revenueTodayEl.textContent = formatRupiah(revenueToday);
      if (totalRevenueEl)
        totalRevenueEl.textContent = formatRupiah(totalRevenue);
      if (totalItemsSoldEl) totalItemsSoldEl.textContent = totalItemsSold;
      if (bestSellerEl)
        bestSellerEl.textContent = Object.keys(productSales).length
          ? Object.keys(productSales).reduce((a, b) =>
              productSales[a] > productSales[b] ? a : b
            )
          : "-";

      renderSalesChart(snapshot);
      renderCategoryChart(categorySales);
    });
  }

  function renderSalesChart(snapshot) {
    const salesChartCanvas = document.getElementById("salesChart");
    if (!salesChartCanvas) return;
    const ctx = salesChartCanvas.getContext("2d");

    const salesData = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      salesData[d.toISOString().split("T")[0]] = 0;
    }

    snapshot.forEach((doc) => {
      const order = doc.data();
      if (order.createdAt && order.status === "completed" && order.total) {
        // Check order.total
        const dateStr = order.createdAt.toDate().toISOString().split("T")[0];
        if (salesData[dateStr] !== undefined) {
          salesData[dateStr] += order.total;
        }
      }
    });

    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: Object.keys(salesData).map((d) =>
          new Date(d).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
          })
        ),
        datasets: [
          {
            label: "Pendapatan",
            data: Object.values(salesData),
            borderColor: "hsl(28, 80%, 50%)",
            backgroundColor: "hsla(28, 80%, 50%, 0.1)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
    });
  }

  function renderCategoryChart(categorySales) {
    const categoryChartCanvas = document.getElementById("categoryChart");
    if (!categoryChartCanvas) return;
    const ctx = categoryChartCanvas.getContext("2d");
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Kopi", "Matcha"],
        datasets: [
          {
            data: [categorySales.kopi || 0, categorySales.matcha || 0], // Pastikan ada nilai default 0
            backgroundColor: ["hsl(28, 80%, 50%)", "hsl(88, 48%, 57%)"],
          },
        ],
      },
    });
  }

  // --- Render Tabel Pesanan (Dengan Kolom Detail) ---
  function renderOrderTable() {
    const orderTableBody = document.querySelector("#order-table tbody");
    if (!orderTableBody) return;

    db.collection("orders")
      .orderBy("createdAt", "desc")
      .limit(30) // Batasi jumlah pesanan awal yang ditampilkan
      .onSnapshot((snapshot) => {
        if (
          !isFirstOrderLoad &&
          snapshot.docChanges().some((change) => change.type === "added")
        ) {
          if (notificationSound) {
            notificationSound
              .play()
              .catch((e) => console.log("Gagal memutar suara notifikasi:", e));
          }
          showAdminNotification("Ada pesanan baru!");
        }
        isFirstOrderLoad = false;

        orderTableBody.innerHTML = "";
        if (snapshot.empty) {
          orderTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Belum ada pesanan masuk.</td></tr>`; // Ubah colspan jadi 7
          return;
        }

        snapshot.forEach((doc) => {
          const order = { id: doc.id, ...doc.data() };
          const row = document.createElement("tr");

          // Buat daftar item pesanan
          let itemsSummary = '<ul class="order-items-summary">';
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach((item) => {
              if (item && item.name && item.quantity && item.options) {
                // Lebih ketat pengecekannya
                itemsSummary += `<li>${item.quantity}x ${item.name} <small>(${item.options.sugar}, ${item.options.ice})</small></li>`;
              } else {
                itemsSummary += `<li>Item tidak valid</li>`;
              }
            });
          } else {
            itemsSummary += `<li>Data item tidak ditemukan</li>`;
          }
          itemsSummary += "</ul>";

          row.innerHTML = `
              <td>${formatTime(order.createdAt)}<br><small>${formatDate(
            order.createdAt
          )}</small></td>
              <td>${order.customerName || "N/A"}<br><small>${
            order.phone || ""
          }</small></td>
              <td>${itemsSummary}</td>
              <td>${formatRupiah(order.total || 0)}</td>
              <td>${order.classSchedule || "?"} (${order.classroom || "?"})</td>
              <td><select class="status-select" data-id="${
                order.id
              }"></select></td>
              <td>
                <button class="action-btn view-details-btn" data-id="${
                  order.id
                }"><i class="ri-eye-line"></i></button>
                <button class="action-btn delete-order-btn" data-id="${
                  order.id
                }"><i class="ri-delete-bin-line"></i></button>
              </td>
          `;

          const statusSelect = row.querySelector(".status-select");
          ["pending", "completed", "cancelled"].forEach((status) => {
            const option = document.createElement("option");
            option.value = status;
            option.textContent =
              status.charAt(0).toUpperCase() + status.slice(1);
            if (order.status === status) option.selected = true;
            statusSelect.appendChild(option);
          });

          const updateStatusClass = () => {
            statusSelect.className = "status-select"; // Reset kelas
            statusSelect.classList.add(`status-${statusSelect.value}`);
          };
          updateStatusClass(); // Panggil saat pertama render

          statusSelect.addEventListener("change", (e) => {
            db.collection("orders")
              .doc(e.target.dataset.id)
              .update({ status: e.target.value })
              .then(updateStatusClass) // Update kelas setelah berhasil
              .catch((err) => console.error("Gagal update status:", err));
          });

          row
            .querySelector(".view-details-btn")
            .addEventListener("click", () => showOrderDetails(order));
          row
            .querySelector(".delete-order-btn")
            .addEventListener("click", async (e) => {
              const orderId = e.currentTarget.dataset.id;
              if (
                confirm(
                  `Yakin ingin menghapus pesanan dari "${
                    order.customerName || "Pelanggan"
                  }"? Tindakan ini tidak bisa dibatalkan.`
                )
              ) {
                try {
                  await db.collection("orders").doc(orderId).delete();
                  showAdminNotification("Pesanan berhasil dihapus.");
                } catch (error) {
                  console.error("Gagal menghapus pesanan: ", error);
                  showAdminNotification("Gagal menghapus pesanan.", false);
                }
              }
            });

          orderTableBody.appendChild(row);
        });
      });
  }
  // --- Render Tabel Pesanan (Dengan Pengelompokan Tanggal & Status) ---
  function renderOrderTable() {
    // Dapatkan container untuk setiap status dan elemen tab
    const pendingContainer = document.querySelector(
      "#orders-pending .order-table-container"
    );
    const completedContainer = document.querySelector(
      "#orders-completed .order-table-container"
    );
    const cancelledContainer = document.querySelector(
      "#orders-cancelled .order-table-container"
    );
    const tabButtons = document.querySelectorAll(".order-tabs .tab-btn");
    const statusSections = document.querySelectorAll(".order-status-section");

    // Pastikan semua elemen ditemukan
    if (
      !pendingContainer ||
      !completedContainer ||
      !cancelledContainer ||
      !tabButtons.length ||
      !statusSections.length
    ) {
      console.error("Elemen DOM untuk tabel pesanan (baru) tidak ditemukan.");
      return;
    }

    // Logika untuk perpindahan tab
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const targetStatus = button.dataset.status; // Dapatkan status dari data-status tombol

        // Hapus kelas aktif dari semua tombol dan section
        tabButtons.forEach((btn) => btn.classList.remove("active"));
        statusSections.forEach((section) => section.classList.remove("active"));

        // Tambahkan kelas aktif ke tombol yang diklik dan section yang sesuai
        button.classList.add("active");
        const targetSection = document.getElementById(`orders-${targetStatus}`);
        if (targetSection) {
          targetSection.classList.add("active");
        }
      });
    });

    // Ambil data pesanan dari Firestore dan urutkan berdasarkan waktu terbaru
    db.collection("orders")
      .orderBy("createdAt", "desc")
      // .limit(100) // Anda bisa batasi jumlah data awal jika perlu performa
      .onSnapshot((snapshot) => {
        // Logika notifikasi pesanan baru (jika diperlukan)
        if (
          !isFirstOrderLoad &&
          snapshot.docChanges().some((change) => change.type === "added")
        ) {
          if (notificationSound) {
            notificationSound
              .play()
              .catch((e) => console.log("Gagal memutar suara notifikasi:", e));
          }
          showAdminNotification("Ada pesanan baru!");
        }
        isFirstOrderLoad = false; // Tandai bahwa load awal sudah selesai

        // Reset tampilan container sebelum mengisi data baru
        pendingContainer.innerHTML =
          '<p class="loading-message">Memuat pesanan pending...</p>';
        completedContainer.innerHTML =
          '<p class="loading-message">Memuat pesanan completed...</p>';
        cancelledContainer.innerHTML =
          '<p class="loading-message">Memuat pesanan cancelled...</p>';

        // Jika tidak ada pesanan sama sekali
        if (snapshot.empty) {
          pendingContainer.innerHTML =
            '<p class="info-text">Tidak ada pesanan pending.</p>';
          completedContainer.innerHTML =
            '<p class="info-text">Tidak ada pesanan completed.</p>';
          cancelledContainer.innerHTML =
            '<p class="info-text">Tidak ada pesanan cancelled.</p>';
          return;
        }

        // Siapkan objek untuk mengelompokkan pesanan
        const ordersByDateAndStatus = {
          pending: {},
          completed: {},
          cancelled: {},
        };

        // Proses pengelompokan data pesanan
        snapshot.forEach((doc) => {
          const order = { id: doc.id, ...doc.data() };
          const status = order.status || "pending"; // Default ke 'pending' jika status tidak ada
          // Dapatkan tanggal pesanan (YYYY-MM-DD) untuk pengelompokan
          const orderDate = order.createdAt
            ? order.createdAt.toDate().toISOString().split("T")[0]
            : "unknown-date";

          // Jika tanggal ini belum ada di grup status, buat array baru
          if (!ordersByDateAndStatus[status][orderDate]) {
            ordersByDateAndStatus[status][orderDate] = [];
          }
          // Masukkan pesanan ke grup tanggal dan status yang sesuai
          ordersByDateAndStatus[status][orderDate].push(order);
        });

        // --- Fungsi untuk merender tabel untuk status tertentu ---
        const renderStatusTable = (status, container) => {
          const ordersByDate = ordersByDateAndStatus[status]; // Ambil data pesanan untuk status ini

          // Jika tidak ada pesanan untuk status ini
          if (Object.keys(ordersByDate).length === 0) {
            container.innerHTML = `<p class="info-text">Tidak ada pesanan ${status}.</p>`;
            return;
          }

          container.innerHTML = ""; // Hapus pesan 'Memuat...' atau 'Tidak ada pesanan'

          // Urutkan tanggal dari yang terbaru (descending)
          const sortedDates = Object.keys(ordersByDate).sort(
            (a, b) => new Date(b) - new Date(a)
          );

          // Loop untuk setiap tanggal
          sortedDates.forEach((date) => {
            const orders = ordersByDate[date]; // Ambil pesanan untuk tanggal ini
            // Format tanggal agar lebih mudah dibaca
            const formattedDate = new Date(date).toLocaleDateString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            });

            // Buat elemen H3 sebagai pemisah tanggal
            const dateHeader = document.createElement("h3");
            dateHeader.className = "order-date-separator"; // Kelas untuk styling
            dateHeader.textContent = formattedDate;
            container.appendChild(dateHeader); // Tambahkan header tanggal ke container

            // Buat tabel untuk pesanan pada tanggal ini
            const table = document.createElement("table");
            table.innerHTML = `
                    <thead>
                        <tr>
                            <th>Waktu</th>
                            <th>Pelanggan</th>
                            <th>Pesanan</th>
                            <th>Total</th>
                            <th>Lokasi</th>
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                `;
            const tbody = table.querySelector("tbody"); // Dapatkan body tabel

            // Loop untuk setiap pesanan pada tanggal ini
            orders.forEach((order) => {
              // Buat ringkasan item pesanan
              let itemsSummary = '<ul class="order-items-summary">';
              if (order.items && Array.isArray(order.items)) {
                order.items.forEach((item) => {
                  // Pastikan data item valid
                  if (item && item.name && item.quantity && item.options) {
                    itemsSummary += `<li>${item.quantity}x ${item.name} <small>(${item.options.sugar}, ${item.options.ice})</small></li>`;
                  } else {
                    itemsSummary += `<li>Item tidak valid</li>`; // Pesan jika item bermasalah
                  }
                });
              } else {
                itemsSummary += `<li>Data item tidak ditemukan</li>`; // Pesan jika data items tidak ada
              }
              itemsSummary += "</ul>";

              // Buat baris (row) untuk pesanan ini
              const row = document.createElement("tr");
              row.innerHTML = `
                        <td>${formatTime(order.createdAt)}</td>
                        <td>${order.customerName || "N/A"}<br><small>${
                order.phone || ""
              }</small></td>
                        <td>${itemsSummary}</td>
                        <td>${formatRupiah(order.total || 0)}</td>
                        <td>${order.classSchedule || "?"} (${
                order.classroom || "?"
              })</td>
                        <td><select class="status-select" data-id="${
                          order.id
                        }"></select></td>
                        <td>
                            <button class="action-btn view-details-btn" data-id="${
                              order.id
                            }" title="Lihat Detail"><i class="ri-eye-line"></i></button>
                            <button class="action-btn delete-order-btn" data-id="${
                              order.id
                            }" title="Hapus Pesanan"><i class="ri-delete-bin-line"></i></button>
                        </td>
                    `;

              // Tambahkan opsi status ke dropdown
              const statusSelect = row.querySelector(".status-select");
              ["pending", "completed", "cancelled"].forEach((s) => {
                const option = document.createElement("option");
                option.value = s;
                option.textContent = s.charAt(0).toUpperCase() + s.slice(1); // Capitalize: Pending, Completed, Cancelled
                if (order.status === s) option.selected = true; // Pilih status yang sesuai
                statusSelect.appendChild(option);
              });

              // Fungsi untuk update kelas CSS dropdown berdasarkan status
              const updateStatusClass = () => {
                statusSelect.className = "status-select"; // Reset kelas
                statusSelect.classList.add(`status-${statusSelect.value}`); // Tambah kelas sesuai status
              };
              updateStatusClass(); // Terapkan kelas saat pertama kali render

              // Event listener saat status di dropdown diubah
              statusSelect.addEventListener("change", (e) => {
                // Update status di Firestore
                db.collection("orders")
                  .doc(e.target.dataset.id)
                  .update({ status: e.target.value })
                  // Kita tidak perlu updateStatusClass() di sini karena onSnapshot akan otomatis
                  // mengambil data baru dan merender ulang tabel saat data berubah
                  .catch((err) => console.error("Gagal update status:", err));
              });

              // Event listener untuk tombol lihat detail
              row
                .querySelector(".view-details-btn")
                .addEventListener("click", () => showOrderDetails(order));
              // Event listener untuk tombol hapus
              row
                .querySelector(".delete-order-btn")
                .addEventListener("click", async (e) => {
                  const orderId = e.currentTarget.dataset.id;
                  if (
                    confirm(
                      `Yakin ingin menghapus pesanan dari "${
                        order.customerName || "Pelanggan"
                      }"? Tindakan ini tidak dapat dibatalkan.`
                    )
                  ) {
                    try {
                      await db.collection("orders").doc(orderId).delete();
                      showAdminNotification("Pesanan berhasil dihapus.");
                    } catch (error) {
                      console.error("Gagal menghapus pesanan: ", error);
                      showAdminNotification("Gagal menghapus pesanan.", false);
                    }
                  }
                });

              tbody.appendChild(row); // Tambahkan baris ke body tabel
            }); // Akhir loop pesanan per tanggal

            container.appendChild(table); // Tambahkan tabel ke container status
          }); // Akhir loop tanggal
        }; // Akhir fungsi renderStatusTable

        // Panggil fungsi render untuk setiap status
        renderStatusTable("pending", pendingContainer);
        renderStatusTable("completed", completedContainer);
        renderStatusTable("cancelled", cancelledContainer);
      }); // Akhir onSnapshot
  }
  function showOrderDetails(order) {
    const modal = document.getElementById("order-details-modal");
    const content = document.getElementById("order-details-content");
    if (!modal || !content) return;

    let itemsList = "<ul>";
    if (order.items && Array.isArray(order.items)) {
      itemsList += order.items
        .map((item) => {
          if (item && item.name && item.quantity && item.price) {
            return `<li><span>${item.quantity}x ${item.name} ${
              item.options ? `(${item.options.sugar}, ${item.options.ice})` : ""
            }</span> <span>${formatRupiah(
              item.price * item.quantity
            )}</span></li>`;
          }
          return "<li>Item tidak valid</li>";
        })
        .join("");
    } else {
      itemsList += "<li>Data item tidak ditemukan</li>";
    }
    itemsList += "</ul>";

    content.innerHTML = `
        <h3>Pelanggan</h3>
        <p><strong>Nama:</strong> ${order.customerName || "N/A"}</p>
        <p><strong>No. Telepon:</strong> ${order.phone || "-"}</p>
        <p><strong>Lokasi:</strong> ${order.classSchedule || "?"} (${
      order.classroom || "?"
    })</p>
        <h3>Detail Pembelian</h3>
        <p><strong>Metode Bayar:</strong> ${order.paymentMethod || "N/A"}</p>
        <p><strong>Waktu Pesan:</strong> ${formatTime(
          order.createdAt
        )}, ${formatDate(order.createdAt)}</p>
        ${itemsList}
        <p style="margin-top: 1rem; text-align: right;"><strong>Total: ${formatRupiah(
          order.total || 0
        )}</strong></p>
      `;

    modal.style.display = "block";
  }

  // --- Render Tabel Produk & Modal ---
  const productsRef = db.collection("products");
  function renderProductTable() {
    const productTableBody = document.querySelector("#product-table tbody");
    const modal = document.getElementById("product-modal");
    const modalTitle = document.getElementById("modal-title");
    const productForm = document.getElementById("product-form");
    const imagePreview = document.getElementById("image-preview");
    const addProductBtn = document.getElementById("add-product-btn");
    const imageUrlInput = document.getElementById("product-image-url");

    if (
      !productTableBody ||
      !modal ||
      !productForm ||
      !addProductBtn ||
      !imageUrlInput
    ) {
      console.error("Satu atau lebih elemen DOM untuk Produk tidak ditemukan.");
      return;
    }

    const openModal = (type = "add", data = {}) => {
      productForm.reset();
      document.getElementById("product-id").value = "";
      imagePreview.style.display = "none";
      imagePreview.src = "#"; // Reset src

      if (type === "edit" && data.id) {
        // Pastikan data.id ada
        modalTitle.textContent = "Edit Produk";
        document.getElementById("product-id").value = data.id;
        document.getElementById("product-name").value = data.name || "";
        document.getElementById("product-price").value = data.price || 0;
        document.getElementById("product-cost").value = data.cost || 0;
        document.getElementById("product-category").value =
          data.category || "kopi";
        document.getElementById("product-composition").value =
          data.composition || "";
        imageUrlInput.value = data.imageUrl || "";
        if (data.imageUrl) {
          imagePreview.src = data.imageUrl;
          imagePreview.style.display = "block";
        }
      } else {
        modalTitle.textContent = "Tambah Produk Baru";
      }
      modal.style.display = "block";
    };

    addProductBtn.addEventListener("click", () => openModal("add"));

    imageUrlInput.addEventListener("input", () => {
      imagePreview.src = imageUrlInput.value || "#"; // Fallback ke # jika kosong
      imagePreview.style.display = imageUrlInput.value ? "block" : "none";
    });
    // Menampilkan preview saat modal edit dibuka (sudah ada di openModal)

    productsRef.orderBy("createdAt", "desc").onSnapshot((snapshot) => {
      productTableBody.innerHTML = "";
      if (snapshot.empty) {
        productTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Belum ada produk. Klik 'Tambah Produk'.</td></tr>`;
        return;
      }
      snapshot.forEach((doc) => {
        const product = { id: doc.id, ...doc.data() };
        const row = document.createElement("tr");
        row.innerHTML = `
              <td><img src="${product.imageUrl || "placeholder.png"}" alt="${
          product.name || "Produk"
        }" class="product-image-cell"></td>
              <td>${product.name || "N/A"}</td>
              <td>${formatRupiah(product.price || 0)}</td>
              <td>${formatRupiah(product.cost || 0)}</td>
              <td>${product.category || "?"}</td>
              <td>
                <button class="action-btn edit-btn"><i class="ri-pencil-line"></i></button>
                <button class="action-btn delete-btn"><i class="ri-delete-bin-line"></i></button>
              </td>
          `;
        row
          .querySelector(".edit-btn")
          .addEventListener("click", () => openModal("edit", product));
        row.querySelector(".delete-btn").addEventListener("click", async () => {
          if (confirm(`Yakin ingin menghapus ${product.name}?`)) {
            try {
              await productsRef.doc(product.id).delete();
              showAdminNotification("Produk berhasil dihapus.");
            } catch (error) {
              console.error("Gagal menghapus produk:", error);
              showAdminNotification("Gagal menghapus produk.", false);
            }
          }
        });
        productTableBody.appendChild(row);
      });
    });

    productForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("product-id").value;
      const productData = {
        name: document.getElementById("product-name").value,
        price: parseFloat(document.getElementById("product-price").value) || 0,
        cost: parseFloat(document.getElementById("product-cost").value) || 0,
        category: document.getElementById("product-category").value,
        composition: document.getElementById("product-composition").value || "",
        imageUrl: document.getElementById("product-image-url").value || "",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      try {
        if (id) {
          await productsRef.doc(id).update(productData);
          showAdminNotification("Produk berhasil diperbarui!");
        } else {
          productData.createdAt =
            firebase.firestore.FieldValue.serverTimestamp();
          await productsRef.add(productData);
          showAdminNotification("Produk berhasil ditambahkan!");
        }
        modal.style.display = "none"; // Tutup modal setelah berhasil
      } catch (error) {
        console.error("Gagal menyimpan produk:", error);
        showAdminNotification("Gagal menyimpan produk.", false);
      }
    });
  }

  // --- CRUD UNTUK SPESIAL ---
  function setupSpecialsCRUD() {
    const specialsRef = db.collection("specials");
    const listContainer = document.getElementById("specials-list-container");
    const modal = document.getElementById("special-modal");
    const modalTitle = document.getElementById("special-modal-title");
    const form = document.getElementById("special-form");
    const addBtn = document.getElementById("add-special-btn");

    // Pastikan semua elemen ada
    if (!listContainer || !modal || !form || !addBtn) {
      console.error("Elemen DOM untuk Spesial tidak ditemukan.");
      // Nonaktifkan tombol tambah jika list tidak ada
      if (addBtn && !listContainer) addBtn.style.display = "none";
      return;
    }

    const formFields = {
      id: document.getElementById("special-id"),
      name: document.getElementById("special-name"),
      description: document.getElementById("special-description"),
      imageUrl: document.getElementById("special-image-url"),
      category: document.getElementById("special-category"),
      preview: document.getElementById("special-image-preview"),
    };

    const openModal = (data = {}) => {
      form.reset();
      formFields.id.value = data.id || "";
      formFields.name.value = data.name || "";
      formFields.description.value = data.description || "";
      formFields.imageUrl.value = data.imageUrl || "";
      formFields.category.value = data.category || "kopi";

      formFields.preview.src = data.imageUrl || "#";
      formFields.preview.style.display = data.imageUrl ? "block" : "none";

      modalTitle.textContent = data.id
        ? "Edit Menu Spesial"
        : "Tambah Menu Spesial";
      modal.style.display = "block";
    };

    addBtn.addEventListener("click", () => openModal());

    formFields.imageUrl.addEventListener("input", () => {
      formFields.preview.src = formFields.imageUrl.value || "#";
      formFields.preview.style.display = formFields.imageUrl.value
        ? "block"
        : "none";
    });

    specialsRef.orderBy("createdAt", "desc").onSnapshot((snapshot) => {
      listContainer.innerHTML = "";
      if (snapshot.empty) {
        listContainer.innerHTML =
          "<p style='text-align:center;'>Belum ada menu spesial yang ditambahkan.</p>";
        return;
      }
      snapshot.forEach((doc) => {
        const special = { id: doc.id, ...doc.data() };
        const card = document.createElement("div");
        card.className = "special-card"; // Class styling dari admin.css
        card.innerHTML = `
          <img src="${special.imageUrl || "placeholder.png"}" alt="${
          special.name || "Spesial"
        }" class="special-card__image">
          <div class="special-card__content">
            <h3 class="special-card__name">${special.name || "N/A"}</h3>
            <p class="special-card__description">${
              special.description || "-"
            }</p>
            <div class="special-card__footer">
              <button class="button edit-special-btn"><i class="ri-pencil-line"></i> Edit</button>
              <button class="button button-danger delete-special-btn"><i class="ri-delete-bin-line"></i> Hapus</button>
            </div>
          </div>
        `;

        card
          .querySelector(".edit-special-btn")
          .addEventListener("click", () => openModal(special));
        card
          .querySelector(".delete-special-btn")
          .addEventListener("click", async () => {
            if (
              confirm(
                `Yakin ingin menghapus menu spesial "${special.name || "ini"}"?`
              )
            ) {
              try {
                await specialsRef.doc(special.id).delete();
                showAdminNotification("Menu spesial berhasil dihapus.");
              } catch (error) {
                console.error("Gagal menghapus spesial:", error);
                showAdminNotification("Gagal menghapus spesial.", false);
              }
            }
          });

        listContainer.appendChild(card);
      });
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = formFields.id.value;
      const data = {
        name: formFields.name.value,
        description: formFields.description.value,
        imageUrl: formFields.imageUrl.value,
        category: formFields.category.value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      try {
        if (id) {
          await specialsRef.doc(id).update(data);
          showAdminNotification("Menu spesial berhasil diperbarui!");
        } else {
          data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          await specialsRef.add(data);
          showAdminNotification("Menu spesial berhasil ditambahkan!");
        }
        modal.style.display = "none"; // Tutup modal
      } catch (error) {
        console.error("Gagal menyimpan spesial:", error);
        showAdminNotification("Gagal menyimpan spesial.", false);
      }
    });
  }

  // --- CRUD UNTUK ULASAN ---
  function setupReviewsCRUD() {
    const reviewsRef = db.collection("reviews");
    const listContainer = document.getElementById("reviews-list-container");
    const modal = document.getElementById("review-modal");
    const form = document.getElementById("review-edit-form");
    const starsEditContainer = document.getElementById("rating-stars-edit");

    if (!listContainer || !modal || !form || !starsEditContainer) {
      console.error("Elemen DOM untuk Ulasan tidak ditemukan.");
      return;
    }

    let currentEditRating = 0;

    const openEditModal = (review) => {
      form.reset();
      form.querySelector("#review-id").value = review.id || "";
      form.querySelector("#review-name-edit").value = review.name || "";
      form.querySelector("#review-text-edit").value = review.reviewText || "";

      currentEditRating = review.rating || 0;
      updateStars(starsEditContainer, currentEditRating);

      modal.style.display = "block";
    };

    const updateStars = (container, rating) => {
      container.querySelectorAll("i").forEach((star) => {
        star.className =
          star.dataset.value <= rating ? "ri-star-fill" : "ri-star-line";
      });
    };

    starsEditContainer.addEventListener("click", (e) => {
      if (e.target.tagName === "I" && e.target.dataset.value) {
        currentEditRating = parseInt(e.target.dataset.value);
        updateStars(starsEditContainer, currentEditRating);
      }
    });

    reviewsRef.orderBy("createdAt", "desc").onSnapshot((snapshot) => {
      listContainer.innerHTML = "";
      if (snapshot.empty) {
        listContainer.innerHTML =
          "<p style='text-align:center;'>Belum ada ulasan dari pelanggan.</p>";
        return;
      }
      snapshot.forEach((doc) => {
        const review = { id: doc.id, ...doc.data() };
        let starsHTML = "";
        for (let i = 1; i <= 5; i++) {
          starsHTML += `<i class="${
            i <= (review.rating || 0) ? "ri-star-fill" : "ri-star-line"
          }"></i>`;
        }

        const card = document.createElement("div");
        card.className = "admin-review-card"; // Class styling dari admin.css
        card.innerHTML = `
          <div class="admin-review-card__header">
            <div>
              <h3 class="admin-review-card__name">${
                review.name || "Anonim"
              }</h3>
              <div class="admin-review-card__stars">${starsHTML}</div>
            </div>
            <span class="admin-review-card__category ${
              review.category || ""
            }">${review.category || "?"}</span>
          </div>
          <p class="admin-review-card__text">"${review.reviewText || "-"}"</p>
          <small class="admin-review-card__date">Dibuat pada: ${formatDate(
            review.createdAt
          )}</small>
          <div class="admin-review-card__actions">
            <button class="button edit-review-btn"><i class="ri-pencil-line"></i> Edit</button>
            <button class="button button-danger delete-review-btn"><i class="ri-delete-bin-line"></i> Hapus</button>
          </div>
        `;

        card
          .querySelector(".edit-review-btn")
          .addEventListener("click", () => openEditModal(review));
        card
          .querySelector(".delete-review-btn")
          .addEventListener("click", async () => {
            if (
              confirm(
                `Yakin ingin menghapus ulasan dari "${
                  review.name || "Anonim"
                }"?`
              )
            ) {
              try {
                await reviewsRef.doc(review.id).delete();
                showAdminNotification("Ulasan berhasil dihapus.");
              } catch (error) {
                console.error("Gagal menghapus ulasan:", error);
                showAdminNotification("Gagal menghapus ulasan.", false);
              }
            }
          });

        listContainer.appendChild(card);
      });
    });

    // --- PENGATURAN POP-UP PROMOSI (PERBAIKAN TOTAL) ---
    function setupPopupSettings() {
      console.log("Setting up Popup Settings...");
      const popupForm = document.getElementById("popup-form");
      const imageUrlInput = document.getElementById("popup-image-url");
      const imagePreview = document.getElementById("popup-image-preview");
      const textInput = document.getElementById("popup-text");
      const linkUrlInput = document.getElementById("popup-link-url");
      const enabledCheckbox = document.getElementById("popup-enabled");
      const saveButton = document.getElementById("save-popup-button"); // Gunakan ID tombol
      const saveButtonText = document.getElementById("save-popup-button-text");
      const popupFormTitle = document.getElementById("popup-form-title");
      const cancelEditBtn = document.getElementById("cancel-edit-popup-btn");

      // Elemen untuk display
      const currentPopupDisplay = document.getElementById(
        "current-popup-display"
      );
      const currentPopupContent = document.getElementById(
        "current-popup-content"
      );
      const currentPopupImage = document.getElementById("current-popup-image");
      const currentPopupText = document.getElementById("current-popup-text");
      const currentPopupLinkInfo = document.getElementById(
        "current-popup-link-info"
      );
      const currentPopupLink = document.getElementById("current-popup-link");
      const currentPopupStatus = document.getElementById(
        "current-popup-status"
      );
      const editPopupBtn = document.getElementById("edit-popup-btn");
      const deletePopupBtn = document.getElementById("delete-popup-btn");
      const noPopupMessage = document.getElementById("no-popup-message");
      const formContainer = document.getElementById("popup-form-container");

      const settingsRef = db.collection("settings").doc("popupConfig");
      let currentConfigData = null; // Simpan data config saat ini

      // Pengecekan elemen
      if (
        !popupForm ||
        !imageUrlInput ||
        !imagePreview ||
        !textInput ||
        !linkUrlInput ||
        !enabledCheckbox ||
        !saveButton ||
        !currentPopupDisplay ||
        !editPopupBtn ||
        !deletePopupBtn ||
        !noPopupMessage ||
        !formContainer ||
        !cancelEditBtn
      ) {
        console.error(
          "FATAL: Elemen penting untuk Pop-up tidak ditemukan. Periksa ID elemen di admin.html."
        );
        const popupSection = document.getElementById("page-popup");
        if (popupSection)
          popupSection.innerHTML =
            "<h1>Error: Elemen Pop-up tidak lengkap.</h1>";
        return;
      }

      const setLoadingState = (isLoading, message = "Menyimpan...") => {
        if (isLoading) {
          saveButton.disabled = true;
          saveButton.innerHTML = `<i class="ri-loader-4-line spinner"></i> ${message}`; // Tambahkan class spinner
        } else {
          saveButton.disabled = false;
          // Kembalikan teks asli (yang disimpan di saveButtonText)
          saveButton.innerHTML = `<i class="ri-save-line"></i> <span id="save-popup-button-text">${saveButtonText.textContent}</span>`;
        }
      };

      const resetFormAndDisplay = () => {
        popupForm.reset();
        imagePreview.style.display = "none";
        imagePreview.src = "#";
        popupFormTitle.textContent = "Tambah Pop-up Baru";
        saveButtonText.textContent = "Simpan Pengaturan";
        currentPopupDisplay.style.display = "none";
        noPopupMessage.style.display = "block";
        formContainer.style.display = "block"; // Tampilkan form untuk menambah baru
        cancelEditBtn.style.display = "none";
        currentConfigData = null;
      };

      const displayCurrentPopup = (data) => {
        currentConfigData = data; // Simpan data saat ini
        if (data && data.imageUrl && data.text) {
          // Pastikan data valid
          currentPopupImage.src = data.imageUrl;
          currentPopupImage.style.display = "block";
          currentPopupText.textContent = data.text;

          if (data.linkUrl) {
            currentPopupLink.href = data.linkUrl;
            currentPopupLink.textContent = data.linkUrl;
            currentPopupLinkInfo.style.display = "block";
          } else {
            currentPopupLinkInfo.style.display = "none";
          }

          currentPopupStatus.textContent = data.isEnabled
            ? "Status: Aktif"
            : "Status: Tidak Aktif";
          currentPopupStatus.style.color = data.isEnabled
            ? "var(--success-color)"
            : "var(--danger-color)";

          currentPopupDisplay.style.display = "block";
          noPopupMessage.style.display = "none";
          formContainer.style.display = "none"; // Sembunyikan form saat view
          cancelEditBtn.style.display = "none"; // Sembunyikan tombol batal
        } else {
          resetFormAndDisplay(); // Jika tidak ada data valid, reset
        }
      };

      const loadPopupConfig = async () => {
        console.log("Loading popup config from Firestore...");
        // Tidak perlu loading state di sini karena display di-handle displayCurrentPopup
        try {
          const doc = await settingsRef.get();
          if (doc.exists) {
            const data = doc.data();
            console.log("Popup config data found:", data);
            displayCurrentPopup(data); // Tampilkan data yang ada
            // Juga isi form (untuk edit nanti), tapi jangan tampilkan form
            imageUrlInput.value = data.imageUrl || "";
            textInput.value = data.text || "";
            linkUrlInput.value = data.linkUrl || "";
            enabledCheckbox.checked = data.isEnabled || false;
            imagePreview.src = data.imageUrl || "#";
            imagePreview.style.display = data.imageUrl ? "block" : "none";
          } else {
            console.log("Popup config document does not exist yet.");
            resetFormAndDisplay(); // Reset jika tidak ada data
          }
        } catch (error) {
          console.error("Gagal memuat konfigurasi pop-up:", error);
          showAdminNotification(
            `Gagal memuat pengaturan: ${error.message}`,
            false
          );
          resetFormAndDisplay(); // Reset jika error
        }
      };

      // Muat data saat fungsi ini dipanggil
      loadPopupConfig();

      // Update preview saat URL gambar berubah di form
      imageUrlInput.addEventListener("input", () => {
        imagePreview.src = imageUrlInput.value || "#";
        imagePreview.style.display = imageUrlInput.value ? "block" : "none";
      });

      // Event listener tombol EDIT
      editPopupBtn.addEventListener("click", () => {
        if (!currentConfigData) return; // Harusnya tidak terjadi jika tombol terlihat

        // Isi form dengan data saat ini (seharusnya sudah terisi dari load)
        imageUrlInput.value = currentConfigData.imageUrl || "";
        textInput.value = currentConfigData.text || "";
        linkUrlInput.value = currentConfigData.linkUrl || "";
        enabledCheckbox.checked = currentConfigData.isEnabled || false;
        imagePreview.src = currentConfigData.imageUrl || "#";
        imagePreview.style.display = currentConfigData.imageUrl
          ? "block"
          : "none";

        // Ubah tampilan
        popupFormTitle.textContent = "Edit Pop-up";
        saveButtonText.textContent = "Simpan Perubahan";
        currentPopupDisplay.style.display = "none"; // Sembunyikan display
        formContainer.style.display = "block"; // Tampilkan form
        cancelEditBtn.style.display = "inline-block"; // Tampilkan tombol batal
        formContainer.scrollIntoView({ behavior: "smooth" }); // Scroll ke form
      });

      // Event listener tombol Batal Edit
      cancelEditBtn.addEventListener("click", () => {
        // Cukup tampilkan lagi display yang sudah ada
        if (currentConfigData) {
          displayCurrentPopup(currentConfigData);
        } else {
          resetFormAndDisplay(); // Kembali ke state tambah baru jika tidak ada data
        }
      });

      // Event listener tombol HAPUS
      deletePopupBtn.addEventListener("click", async () => {
        if (
          confirm(
            "Yakin ingin menghapus konfigurasi pop-up ini? Tindakan ini tidak bisa dibatalkan."
          )
        ) {
          try {
            await settingsRef.delete();
            showAdminNotification("Konfigurasi pop-up berhasil dihapus.");
            resetFormAndDisplay(); // Reset tampilan ke state awal (tambah baru)
          } catch (error) {
            console.error("Gagal menghapus konfigurasi pop-up:", error);
            showAdminNotification(`Gagal menghapus: ${error.message}`, false);
          }
        }
      });

      // Event listener submit form (untuk Simpan Baru / Simpan Perubahan)
      popupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("Popup form submission initiated...");

        // Validasi sederhana (karena sudah ada 'required' di HTML)
        if (!imageUrlInput.value || !textInput.value) {
          showAdminNotification(
            "URL Gambar dan Teks Promosi wajib diisi.",
            false
          );
          return;
        }

        setLoadingState(true);

        const saveData = {
          imageUrl: imageUrlInput.value.trim(),
          text: textInput.value.trim(),
          linkUrl: linkUrlInput.value.trim(),
          isEnabled: enabledCheckbox.checked,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        console.log("Attempting to save data:", saveData);

        try {
          await settingsRef.set(saveData, { merge: true }); // set dgn merge:true akan membuat jika belum ada, atau update jika sudah ada
          console.log("Data successfully saved/updated in Firestore!");
          showAdminNotification("Pengaturan Pop-up berhasil disimpan!");
          displayCurrentPopup(saveData); // Tampilkan data yang baru disimpan
        } catch (error) {
          console.error("!!! Firebase Save Error:", error);
          showAdminNotification(`Gagal menyimpan: ${error.message}`, false);
        } finally {
          setLoadingState(false);
        }
      });

      console.log("Popup settings event listeners attached.");
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = form.querySelector("#review-id").value;
      if (!id) return; // Jangan lakukan update jika ID tidak ada

      const data = {
        name: form.querySelector("#review-name-edit").value,
        reviewText: form.querySelector("#review-text-edit").value,
        rating: parseInt(currentEditRating),
        // Kita tidak update createdAt atau category saat edit
      };

      try {
        await reviewsRef.doc(id).update(data);
        showAdminNotification("Ulasan berhasil diperbarui!");
        modal.style.display = "none"; // Tutup modal
      } catch (error) {
        console.error("Gagal memperbarui ulasan:", error);
        showAdminNotification("Gagal memperbarui ulasan.", false);
      }
    });
  }
  // --- PENGATURAN POP-UP PROMOSI (BARU & LENGKAP) ---
  function setupPopupSettings() {
    console.log("Setting up Popup Settings...");
    const popupForm = document.getElementById("popup-form");
    const imageUrlInput = document.getElementById("popup-image-url");
    const imagePreview = document.getElementById("popup-image-preview");
    const textInput = document.getElementById("popup-text");
    const linkUrlInput = document.getElementById("popup-link-url");
    const enabledCheckbox = document.getElementById("popup-enabled");
    const saveButton = document.getElementById("save-popup-button");
    const saveButtonText = document.getElementById("save-popup-button-text"); // Butuh span ini di HTML tombol save
    const popupFormTitle = document.getElementById("popup-form-title");
    const cancelEditBtn = document.getElementById("cancel-edit-popup-btn");
    const addNewPopupBtnFromEmpty = document.getElementById(
      "add-new-popup-btn-from-empty"
    ); // Tombol tambah dari state kosong

    // Elemen untuk display
    const currentPopupDisplay = document.getElementById(
      "current-popup-display"
    );
    const currentPopupContent = document.getElementById(
      "current-popup-content"
    ); // Pastikan ID ini ada
    const currentPopupImage = document.getElementById("current-popup-image");
    const currentPopupText = document.getElementById("current-popup-text");
    const currentPopupLinkInfo = document.getElementById(
      "current-popup-link-info"
    );
    const currentPopupLink = document.getElementById("current-popup-link");
    const currentPopupStatus = document.getElementById("current-popup-status");
    const editPopupBtn = document.getElementById("edit-popup-btn");
    const deletePopupBtn = document.getElementById("delete-popup-btn");
    const noPopupMessage = document.getElementById("no-popup-message");
    const formContainer = document.getElementById("popup-form-container");

    // Firestore reference
    const settingsRef = db.collection("settings").doc("popupConfig");
    let currentConfigData = null; // Simpan data config saat ini

    // Pengecekan elemen penting
    if (
      !popupForm ||
      !imageUrlInput ||
      !imagePreview ||
      !textInput ||
      !linkUrlInput ||
      !enabledCheckbox ||
      !saveButton ||
      !saveButtonText ||
      !popupFormTitle ||
      !cancelEditBtn ||
      !currentPopupDisplay ||
      !currentPopupContent ||
      !currentPopupImage ||
      !currentPopupText ||
      !currentPopupLinkInfo ||
      !currentPopupLink ||
      !currentPopupStatus ||
      !editPopupBtn ||
      !deletePopupBtn ||
      !noPopupMessage ||
      !formContainer ||
      !addNewPopupBtnFromEmpty
    ) {
      console.error(
        "FATAL: Satu atau lebih elemen penting untuk Pop-up tidak ditemukan. Periksa ID elemen di admin.html."
      );
      const popupSection = document.getElementById("page-popup");
      if (popupSection)
        popupSection.innerHTML =
          "<h1>Error: Elemen Pop-up tidak lengkap. Silakan periksa konsol.</h1>";
      return; // Hentikan eksekusi jika elemen tidak lengkap
    }

    // Fungsi untuk menampilkan/menyembunyikan loading pada tombol simpan
    const setLoadingState = (isLoading, message = "Menyimpan...") => {
      if (!saveButton) return;
      if (isLoading) {
        saveButton.disabled = true;
        saveButton.innerHTML = `<i class="ri-loader-4-line spinner" style="animation: spin 1s linear infinite;"></i> ${message}`;
      } else {
        saveButton.disabled = false;
        // Kembalikan teks asli (yang disimpan di saveButtonText)
        const originalText = saveButtonText
          ? saveButtonText.textContent
          : "Simpan";
        saveButton.innerHTML = `<i class="ri-save-line"></i> <span id="save-popup-button-text">${originalText}</span>`;
      }
    };

    // Fungsi untuk mereset form dan tampilan ke state "Tambah Baru"
    const resetFormAndDisplay = () => {
      popupForm.reset();
      imagePreview.style.display = "none";
      imagePreview.src = "#";
      popupFormTitle.textContent = "Tambah Pop-up Baru";
      if (saveButtonText) saveButtonText.textContent = "Simpan Pengaturan";
      currentPopupDisplay.style.display = "none";
      noPopupMessage.style.display = "block"; // Tampilkan pesan 'belum ada'
      formContainer.style.display = "none"; // Sembunyikan form dulu
      cancelEditBtn.style.display = "none";
      currentConfigData = null;
    };

    // Fungsi untuk menampilkan detail pop-up yang sedang aktif
    const displayCurrentPopup = (data) => {
      currentConfigData = data; // Simpan data saat ini
      if (data && data.imageUrl && data.text) {
        currentPopupImage.src = data.imageUrl;
        currentPopupImage.style.display = "block";
        currentPopupText.textContent = data.text;

        if (data.linkUrl) {
          currentPopupLink.href = data.linkUrl;
          currentPopupLink.textContent = data.linkUrl;
          currentPopupLinkInfo.style.display = "block";
        } else {
          currentPopupLinkInfo.style.display = "none";
        }

        currentPopupStatus.textContent = data.isEnabled
          ? "Status: Aktif"
          : "Status: Tidak Aktif";
        currentPopupStatus.style.color = data.isEnabled
          ? "var(--success-color)"
          : "var(--danger-color)";

        currentPopupDisplay.style.display = "block";
        noPopupMessage.style.display = "none";
        formContainer.style.display = "none"; // Sembunyikan form saat view
        cancelEditBtn.style.display = "none"; // Sembunyikan tombol batal
      } else {
        // Jika data tidak valid (misal, dihapus), reset ke state tambah baru
        resetFormAndDisplay();
      }
    };

    // Fungsi untuk memuat konfigurasi pop-up dari Firestore
    const loadPopupConfig = async () => {
      console.log("Loading popup config from Firestore...");
      try {
        const doc = await settingsRef.get();
        if (doc.exists) {
          const data = doc.data();
          console.log("Popup config data found:", data);
          displayCurrentPopup(data); // Tampilkan data yang ada
          // Isi form (untuk edit nanti), tapi jangan tampilkan form
          imageUrlInput.value = data.imageUrl || "";
          textInput.value = data.text || "";
          linkUrlInput.value = data.linkUrl || "";
          enabledCheckbox.checked = data.isEnabled === true; // Pastikan boolean
          imagePreview.src = data.imageUrl || "#";
          imagePreview.style.display = data.imageUrl ? "block" : "none";
        } else {
          console.log("Popup config document does not exist yet.");
          resetFormAndDisplay(); // Reset jika tidak ada data
        }
      } catch (error) {
        console.error("Gagal memuat konfigurasi pop-up:", error);
        showAdminNotification(
          `Gagal memuat pengaturan: ${error.message}`,
          false
        );
        resetFormAndDisplay(); // Reset jika error
      }
    };

    // Muat data saat fungsi ini dipanggil
    loadPopupConfig();

    // Update preview saat URL gambar berubah di form
    imageUrlInput.addEventListener("input", () => {
      imagePreview.src = imageUrlInput.value || "#";
      imagePreview.style.display = imageUrlInput.value ? "block" : "none";
    });

    // Event listener tombol TAMBAH BARU (dari state kosong)
    addNewPopupBtnFromEmpty.addEventListener("click", () => {
      noPopupMessage.style.display = "none"; // Sembunyikan pesan
      formContainer.style.display = "block"; // Tampilkan form
      popupFormTitle.textContent = "Tambah Pop-up Baru";
      if (saveButtonText) saveButtonText.textContent = "Simpan Pengaturan";
      popupForm.reset(); // Kosongkan form
      imagePreview.style.display = "none";
      imagePreview.src = "#";
      enabledCheckbox.checked = true; // Default aktif
      cancelEditBtn.style.display = "none"; // Pastikan tombol batal tersembunyi
    });

    // Event listener tombol EDIT
    editPopupBtn.addEventListener("click", () => {
      if (!currentConfigData) return;

      // Isi form dengan data saat ini (seharusnya sudah terisi dari load)
      imageUrlInput.value = currentConfigData.imageUrl || "";
      textInput.value = currentConfigData.text || "";
      linkUrlInput.value = currentConfigData.linkUrl || "";
      enabledCheckbox.checked = currentConfigData.isEnabled === true; // Pastikan boolean
      imagePreview.src = currentConfigData.imageUrl || "#";
      imagePreview.style.display = currentConfigData.imageUrl
        ? "block"
        : "none";

      // Ubah tampilan
      popupFormTitle.textContent = "Edit Pop-up";
      if (saveButtonText) saveButtonText.textContent = "Simpan Perubahan";
      currentPopupDisplay.style.display = "none"; // Sembunyikan display
      formContainer.style.display = "block"; // Tampilkan form
      cancelEditBtn.style.display = "inline-block"; // Tampilkan tombol batal
      formContainer.scrollIntoView({ behavior: "smooth" }); // Scroll ke form
    });

    // Event listener tombol Batal Edit
    cancelEditBtn.addEventListener("click", () => {
      // Cukup tampilkan lagi display yang sudah ada
      if (currentConfigData) {
        displayCurrentPopup(currentConfigData);
      } else {
        // Jika entah bagaimana data hilang, kembali ke state tambah baru
        resetFormAndDisplay();
      }
    });

    // Event listener tombol HAPUS
    deletePopupBtn.addEventListener("click", async () => {
      if (
        confirm(
          "Yakin ingin menghapus konfigurasi pop-up ini? Tindakan ini tidak dapat dibatalkan."
        )
      ) {
        try {
          await settingsRef.delete();
          showAdminNotification("Konfigurasi pop-up berhasil dihapus.");
          resetFormAndDisplay(); // Reset tampilan ke state awal (tambah baru)
        } catch (error) {
          console.error("Gagal menghapus konfigurasi pop-up:", error);
          showAdminNotification(`Gagal menghapus: ${error.message}`, false);
        }
      }
    });

    // Event listener submit form (untuk Simpan Baru / Simpan Perubahan)
    popupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("Popup form submission initiated...");

      // Validasi sederhana
      if (!imageUrlInput.value || !textInput.value) {
        showAdminNotification(
          "URL Gambar dan Teks Promosi wajib diisi.",
          false
        );
        return;
      }

      setLoadingState(true);

      const saveData = {
        imageUrl: imageUrlInput.value.trim(),
        text: textInput.value.trim(),
        linkUrl: linkUrlInput.value.trim() || null, // Simpan null jika kosong
        isEnabled: enabledCheckbox.checked,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      console.log("Attempting to save data:", saveData);

      try {
        // set dengan merge:true akan create jika belum ada, atau update jika sudah ada
        await settingsRef.set(saveData, { merge: true });
        console.log("Data successfully saved/updated in Firestore!");
        showAdminNotification("Pengaturan Pop-up berhasil disimpan!");
        // Muat ulang data untuk memastikan sinkron dan tampilkan
        loadPopupConfig(); // Memanggil load lagi akan otomatis memanggil displayCurrentPopup
      } catch (error) {
        console.error("!!! Firebase Save Error:", error);
        showAdminNotification(`Gagal menyimpan: ${error.message}`, false);
      } finally {
        setLoadingState(false);
      }
    });

    console.log("Popup settings event listeners attached.");
  }

  // --- Render Daftar Kritik & Saran ---
  function renderFeedbackList() {
    const feedbackContainer = document.getElementById(
      "feedback-list-container"
    );
    const feedbackRef = db.collection("feedback");

    if (!feedbackContainer) {
      console.error("Elemen container feedback tidak ditemukan.");
      return;
    }

    feedbackRef.orderBy("createdAt", "desc").onSnapshot(
      (snapshot) => {
        feedbackContainer.innerHTML = ""; // Kosongkan container

        if (snapshot.empty) {
          feedbackContainer.innerHTML =
            '<p style="text-align:center; color: var(--text-color);">Belum ada kritik atau saran.</p>';
          return;
        }

        snapshot.forEach((doc) => {
          const feedback = { id: doc.id, ...doc.data() };
          const card = document.createElement("div");
          card.className = "feedback-card";

          const timestamp = feedback.createdAt
            ? feedback.createdAt.toDate()
            : new Date();
          const formattedTime = timestamp.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const formattedDate = timestamp.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });

          card.innerHTML = `
          <div class="feedback-card__header">
            <span class="feedback-card__name">${
              feedback.name || "Anonim"
            }</span>
            <span class="feedback-card__timestamp">${formattedTime}<br>${formattedDate}</span>
          </div>
          <p class="feedback-card__message">${feedback.message || "-"}</p>
          <div class="feedback-card__actions">
            <button class="button button-danger delete-feedback-btn" data-id="${
              feedback.id
            }">
              <i class="ri-delete-bin-line"></i> Hapus
            </button>
          </div>
        `;

          // Event listener untuk tombol hapus
          card
            .querySelector(".delete-feedback-btn")
            .addEventListener("click", async (e) => {
              const feedbackId = e.currentTarget.dataset.id;
              if (
                confirm(
                  `Yakin ingin menghapus masukan dari "${
                    feedback.name || "Anonim"
                  }"?`
                )
              ) {
                try {
                  await feedbackRef.doc(feedbackId).delete();
                  showAdminNotification("Feedback berhasil dihapus.");
                  // List akan otomatis update karena onSnapshot
                } catch (error) {
                  console.error("Gagal menghapus feedback:", error);
                  showAdminNotification("Gagal menghapus feedback.", false);
                }
              }
            });

          feedbackContainer.appendChild(card);
        });
      },
      (error) => {
        console.error("Error fetching feedback:", error);
        feedbackContainer.innerHTML =
          '<p style="text-align:center; color: var(--danger-color);">Gagal memuat kritik dan saran.</p>';
      }
    );
  } // Akhir renderFeedbackList
}); // Akhir DOMContentLoaded
