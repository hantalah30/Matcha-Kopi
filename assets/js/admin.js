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

    // --- PENGATURAN POP-UP PROMOSI (PERBAIKAN FINAL) ---
    function setupPopupSettings() {
      console.log("Setting up Popup Settings...");
      const popupForm = document.getElementById("popup-form");
      const imageUrlInput = document.getElementById("popup-image-url");
      const imagePreview = document.getElementById("popup-image-preview");
      const textInput = document.getElementById("popup-text");
      const linkUrlInput = document.getElementById("popup-link-url");
      const enabledCheckbox = document.getElementById("popup-enabled");
      const saveButton = popupForm
        ? popupForm.querySelector('button[type="submit"]')
        : null;
      const settingsRef = db.collection("settings").doc("popupConfig"); // Referensi dokumen Firestore

      // Pengecekan elemen yang lebih ketat
      if (
        !popupForm ||
        !imageUrlInput ||
        !imagePreview ||
        !textInput ||
        !linkUrlInput ||
        !enabledCheckbox ||
        !saveButton
      ) {
        console.error(
          "FATAL: Elemen form Pop-up atau tombol simpan tidak ditemukan. Fitur Pop-up tidak akan berfungsi."
        );
        const popupSection = document.getElementById("page-popup");
        if (popupSection)
          popupSection.innerHTML =
            "<h1>Pengaturan Pop-up Promo</h1><p style='color: red;'>Error: Elemen form penting tidak ditemukan dalam HTML. Periksa ID elemen.</p>";
        return; // Hentikan fungsi jika elemen penting hilang
      }

      const setLoadingState = (isLoading, message = "Menyimpan...") => {
        if (isLoading) {
          saveButton.disabled = true;
          saveButton.innerHTML = `<i class="ri-loader-4-line"></i> ${message}`;
        } else {
          saveButton.disabled = false;
          saveButton.innerHTML =
            '<i class="ri-save-line"></i> Simpan Pengaturan Pop-up';
        }
      };

      const loadPopupConfig = async () => {
        console.log("Loading popup config from Firestore...");
        setLoadingState(true, "Memuat..."); // Tampilkan loading saat memuat
        try {
          const doc = await settingsRef.get();
          if (doc.exists) {
            const data = doc.data();
            console.log("Popup config data found:", data);
            imageUrlInput.value = data.imageUrl || "";
            textInput.value = data.text || "";
            linkUrlInput.value = data.linkUrl || "";
            enabledCheckbox.checked = data.isEnabled || false;
            imagePreview.src = data.imageUrl || "#";
            imagePreview.style.display = data.imageUrl ? "block" : "none";
          } else {
            console.log("Popup config document does not exist yet.");
            imagePreview.style.display = "none";
            imagePreview.src = "#";
            // Kosongkan form jika data belum ada
            popupForm.reset();
            enabledCheckbox.checked = false; // Pastikan checkbox tidak aktif
          }
          showAdminNotification("Pengaturan pop-up dimuat.", true);
        } catch (error) {
          console.error("Gagal memuat konfigurasi pop-up:", error);
          showAdminNotification(
            `Gagal memuat pengaturan: ${error.message}`,
            false
          );
          imagePreview.style.display = "none"; // Sembunyikan preview jika error
          imagePreview.src = "#";
        } finally {
          setLoadingState(false); // Sembunyikan loading
        }
      };

      // Muat data saat fungsi ini dipanggil (saat initAdminApp)
      loadPopupConfig();

      // Update preview saat URL gambar berubah
      imageUrlInput.addEventListener("input", () => {
        imagePreview.src = imageUrlInput.value || "#";
        imagePreview.style.display = imageUrlInput.value ? "block" : "none";
      });

      // Event listener submit form (lebih robust)
      popupForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Panggil paling awal dan pastikan bekerja
        e.stopPropagation(); // Hentikan event bubbling (jaga-jaga)
        console.log("Popup form submission initiated...");

        setLoadingState(true); // Tampilkan loading

        const saveData = {
          imageUrl: imageUrlInput.value.trim(),
          text: textInput.value.trim(),
          linkUrl: linkUrlInput.value.trim(),
          isEnabled: enabledCheckbox.checked,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        console.log("Attempting to save data:", saveData);

        try {
          // Gunakan set dengan merge untuk membuat/update dokumen
          await settingsRef.set(saveData, { merge: true });
          console.log("Data successfully saved/updated in Firestore!");
          showAdminNotification("Pengaturan Pop-up berhasil disimpan!");
        } catch (error) {
          console.error("!!! Firebase Save Error:", error);
          showAdminNotification(`Gagal menyimpan: ${error.message}`, false);
        } finally {
          setLoadingState(false); // Sembunyikan loading
        }
        return false; // Pengaman ekstra untuk mencegah refresh default
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
}); // Akhir DOMContentLoaded
