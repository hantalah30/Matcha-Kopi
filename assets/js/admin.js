document.addEventListener("DOMContentLoaded", function () {
  if (typeof firebase === "undefined" || !firebase.auth) {
    console.error("Firebase tidak terinisialisasi.");
    return;
  }

  const db = firebase.firestore();
  const auth = firebase.auth();
  let salesChartInstance, categoryChartInstance;

  auth.onAuthStateChanged((user) => {
    if (user) {
      initAdminApp();
    } else {
      window.location.replace("login");
    }
  });

  function initAdminApp() {
    setupEventListeners();
    loadDashboardData();
    renderOrderTable();
    renderProductTable();
    setupSpecialsCRUD();
    setupReviewsCRUD(); // PANGGIL FUNGSI BARU
  }

  function setupEventListeners() {
    // --- LOGIKA BARU UNTUK TOGGLE SIDEBAR ---
    const sidebarToggleDesktop = document.getElementById(
      "sidebar-toggle-desktop"
    );
    const sidebarToggleMobile = document.getElementById(
      "sidebar-toggle-mobile"
    );
    const body = document.body;

    // Toggle untuk menciutkan di desktop
    sidebarToggleDesktop.addEventListener("click", () => {
      body.classList.toggle("sidebar-collapsed");
    });

    // Toggle untuk menampilkan/menyembunyikan di mobile
    sidebarToggleMobile.addEventListener("click", () => {
      body.classList.toggle("sidebar-show");
    });

    // Navigasi Halaman
    const sidebarLinks = document.querySelectorAll(".sidebar__link");
    sidebarLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        if (link.id === "logout-btn") return; // Logout ditangani terpisah
        e.preventDefault();

        sidebarLinks.forEach((l) => l.classList.remove("active-link"));
        link.classList.add("active-link");

        const targetPageId = link.getAttribute("href").substring(1);
        document.querySelectorAll(".admin-page").forEach((page) => {
          page.classList.remove("active-page");
        });
        document
          .getElementById(`page-${targetPageId}`)
          .classList.add("active-page");

        // Otomatis tutup sidebar di mobile setelah link diklik
        body.classList.remove("sidebar-show");
      });
    });

    // Logout
    document.getElementById("logout-btn").addEventListener("click", (e) => {
      e.preventDefault();
      auth.signOut().then(() => window.location.replace("login"));
    });

    // Dark Mode Toggle
    const themeCheckbox = document.getElementById("theme-checkbox");
    if (themeCheckbox) {
      themeCheckbox.addEventListener("change", () => {
        document.body.classList.toggle("dark-mode");
        localStorage.setItem(
          "darkMode",
          document.body.classList.contains("dark-mode")
        );
      });
      if (localStorage.getItem("darkMode") === "true") {
        document.body.classList.add("dark-mode");
        themeCheckbox.checked = true;
      }
    }
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

      // Ambil data produk untuk mencocokkan kategori
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

        order.items.forEach((item) => {
          totalItemsSold += item.quantity;
          productSales[item.name] =
            (productSales[item.name] || 0) + item.quantity;

          const category = productCategories[item.name];
          if (category) {
            categorySales[category] =
              (categorySales[category] || 0) + item.price * item.quantity;
          }
        });
      });

      document.getElementById("revenue-today").textContent =
        formatRupiah(revenueToday);
      document.getElementById("total-revenue").textContent =
        formatRupiah(totalRevenue);
      document.getElementById("total-items-sold").textContent = totalItemsSold;
      document.getElementById("best-seller").textContent = Object.keys(
        productSales
      ).length
        ? Object.keys(productSales).reduce((a, b) =>
            productSales[a] > productSales[b] ? a : b
          )
        : "-";

      renderSalesChart(snapshot);
      renderCategoryChart(categorySales);
    });
  }

  function renderSalesChart(snapshot) {
    const salesData = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      salesData[d.toISOString().split("T")[0]] = 0;
    }

    snapshot.forEach((doc) => {
      const order = doc.data();
      if (order.createdAt && order.status === "completed") {
        const dateStr = order.createdAt.toDate().toISOString().split("T")[0];
        if (salesData[dateStr] !== undefined) {
          salesData[dateStr] += order.total;
        }
      }
    });

    const ctx = document.getElementById("salesChart").getContext("2d");
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
    const ctx = document.getElementById("categoryChart").getContext("2d");
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Kopi", "Matcha"],
        datasets: [
          {
            data: [categorySales.kopi, categorySales.matcha],
            backgroundColor: ["hsl(28, 80%, 50%)", "hsl(88, 48%, 57%)"],
          },
        ],
      },
    });
  }

  // --- Render Tabel Pesanan (DENGAN FUNGSI HAPUS) ---
  function renderOrderTable() {
    const orderTableBody = document.querySelector("#order-table tbody");
    if (!orderTableBody) return;

    db.collection("orders")
      .orderBy("createdAt", "desc")
      .limit(30)
      .onSnapshot((snapshot) => {
        if (
          !isFirstOrderLoad &&
          snapshot.docChanges().some((change) => change.type === "added")
        ) {
          notificationSound
            .play()
            .catch((e) => console.log("Gagal memutar suara notifikasi:", e));
          showAdminNotification("Ada pesanan baru!");
        }
        isFirstOrderLoad = false;

        orderTableBody.innerHTML = "";
        if (snapshot.empty) {
          orderTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Belum ada pesanan masuk.</td></tr>`;
          return;
        }

        snapshot.forEach((doc) => {
          const order = { id: doc.id, ...doc.data() }; // Sertakan ID dokumen
          const row = document.createElement("tr");

          // --- PERUBAHAN DI SINI: Menambahkan tombol hapus ---
          row.innerHTML = `
              <td>${formatTime(order.createdAt)}<br><small>${formatDate(
            order.createdAt
          )}</small></td>
              <td>${order.customerName}</td>
              <td>${formatRupiah(order.total)}</td>
              <td>${order.classSchedule} (${order.classroom})</td>
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
            statusSelect.className = "status-select";
            statusSelect.classList.add(`status-${statusSelect.value}`);
          };
          updateStatusClass();

          statusSelect.addEventListener("change", (e) => {
            db.collection("orders")
              .doc(e.target.dataset.id)
              .update({ status: e.target.value })
              .then(updateStatusClass);
          });

          row
            .querySelector(".view-details-btn")
            .addEventListener("click", () => showOrderDetails(order));

          // --- LOGIKA BARU UNTUK TOMBOL HAPUS ---
          row
            .querySelector(".delete-order-btn")
            .addEventListener("click", async (e) => {
              const orderId = e.currentTarget.dataset.id;
              if (
                confirm(
                  `Yakin ingin menghapus pesanan dari "${order.customerName}"? Tindakan ini tidak bisa dibatalkan.`
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

    const itemsList = order.items
      .map(
        (item) =>
          `<li><span>${item.quantity}x ${item.name}</span> <span>${formatRupiah(
            item.price * item.quantity
          )}</span></li>`
      )
      .join("");

    content.innerHTML = `
        <h3>Pelanggan</h3>
        <p><strong>Nama:</strong> ${order.customerName}</p>
        <p><strong>No. Telepon:</strong> ${order.phone}</p>
        <p><strong>Lokasi:</strong> ${order.classSchedule} (${
      order.classroom
    })</p>
        <h3>Detail Pembelian</h3>
        <p><strong>Metode Bayar:</strong> ${order.paymentMethod}</p>
        <p><strong>Waktu Pesan:</strong> ${formatTime(
          order.createdAt
        )}, ${formatDate(order.createdAt)}</p>
        <ul>${itemsList}</ul>
        <p style="margin-top: 1rem; text-align: right;"><strong>Total: ${formatRupiah(
          order.total
        )}</strong></p>
      `;

    modal.style.display = "block";
    modal.querySelector(".close-btn").onclick = () =>
      (modal.style.display = "none");
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
    const closeBtns = document.querySelectorAll(".close-btn");
    const imageUrlInput = document.getElementById("product-image-url");

    const openModal = (type = "add", data = {}) => {
      productForm.reset();
      document.getElementById("product-id").value = "";
      imagePreview.style.display = "none";

      if (type === "edit") {
        modalTitle.textContent = "Edit Produk";
        document.getElementById("product-id").value = data.id;
        document.getElementById("product-name").value = data.name;
        document.getElementById("product-price").value = data.price;
        document.getElementById("product-cost").value = data.cost || 0;
        document.getElementById("product-category").value = data.category;
        document.getElementById("product-composition").value =
          data.composition || "";
        imageUrlInput.value = data.imageUrl;
        imagePreview.src = data.imageUrl;
        imagePreview.style.display = "block";
      } else {
        modalTitle.textContent = "Tambah Produk Baru";
      }
      modal.style.display = "block";
    };

    const closeModal = () => {
      document
        .querySelectorAll(".modal")
        .forEach((m) => (m.style.display = "none"));
    };

    if (addProductBtn)
      addProductBtn.addEventListener("click", () => openModal("add"));
    closeBtns.forEach((btn) => btn.addEventListener("click", closeModal));

    imageUrlInput.addEventListener("input", () => {
      imagePreview.src = imageUrlInput.value;
      imagePreview.style.display = imageUrlInput.value ? "block" : "none";
    });

    productsRef.orderBy("createdAt", "desc").onSnapshot((snapshot) => {
      if (!productTableBody) return;
      productTableBody.innerHTML = "";
      snapshot.forEach((doc) => {
        const product = { id: doc.id, ...doc.data() };
        const row = document.createElement("tr");
        row.innerHTML = `
              <td><img src="${product.imageUrl}" alt="${
          product.name
        }" class="product-image-cell"></td>
              <td>${product.name}</td>
              <td>${formatRupiah(product.price)}</td>
              <td>${formatRupiah(product.cost || 0)}</td>
              <td>${product.category}</td>
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
            await productsRef.doc(product.id).delete();
            showAdminNotification("Produk berhasil dihapus.");
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
        price: parseFloat(document.getElementById("product-price").value),
        cost: parseFloat(document.getElementById("product-cost").value),
        category: document.getElementById("product-category").value,
        composition: document.getElementById("product-composition").value,
        imageUrl: document.getElementById("product-image-url").value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (id) {
        await productsRef.doc(id).update(productData);
        showAdminNotification("Produk berhasil diperbarui!");
      } else {
        productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await productsRef.add(productData);
        showAdminNotification("Produk berhasil ditambahkan!");
      }
      closeModal();
    });
  }

  // --- FUNGSI BARU: MENGELOLA MENU SPESIAL ---
  async function renderSpecialsManagement() {
    const kopiSelect = document.getElementById("special-kopi-select");
    const matchaSelect = document.getElementById("special-matcha-select");
    const saveKopiBtn = document.getElementById("save-kopi-special");
    const saveMatchaBtn = document.getElementById("save-matcha-special");

    if (!kopiSelect || !matchaSelect) return;

    // Ambil semua produk dari Firestore
    const productsSnapshot = await db.collection("products").get();
    const products = [];
    productsSnapshot.forEach((doc) =>
      products.push({ id: doc.id, ...doc.data() })
    );

    // Isi dropdown untuk kopi
    products
      .filter((p) => p.category === "kopi")
      .forEach((p) => {
        const option = new Option(p.name, p.id);
        kopiSelect.add(option);
      });

    // Isi dropdown untuk matcha
    products
      .filter((p) => p.category === "matcha")
      .forEach((p) => {
        const option = new Option(p.name, p.id);
        matchaSelect.add(option);
      });

    // Ambil data spesial yang saat ini aktif dan set di dropdown
    const specialKopiDoc = await db
      .collection("specials")
      .doc("kopi-special")
      .get();
    if (specialKopiDoc.exists) {
      kopiSelect.value = specialKopiDoc.data().productId;
    }
    const specialMatchaDoc = await db
      .collection("specials")
      .doc("matcha-special")
      .get();
    if (specialMatchaDoc.exists) {
      matchaSelect.value = specialMatchaDoc.data().productId;
    }

    // Fungsi untuk menyimpan
    const saveSpecial = async (docId, selectedProductId) => {
      if (!selectedProductId) {
        // Jika admin memilih "Tidak ada", hapus dokumen spesial
        await db.collection("specials").doc(docId).delete();
        showAdminNotification("Menu spesial berhasil dihapus.");
        return;
      }

      // Cari data produk lengkap berdasarkan ID yang dipilih
      const selectedProduct = products.find((p) => p.id === selectedProductId);
      if (selectedProduct) {
        const specialData = {
          productId: selectedProductId,
          name: selectedProduct.name,
          description:
            "Perpaduan rasa yang unik dan menyegarkan, wajib dicoba!", // Anda bisa menambahkan deskripsi di form jika mau
          imageUrl: selectedProduct.imageUrl,
          category: selectedProduct.category,
        };
        // Set (update atau buat baru) dokumen di Firestore
        await db.collection("specials").doc(docId).set(specialData);
        showAdminNotification("Menu spesial berhasil diperbarui!");
      }
    };

    // Event listener untuk tombol simpan
    saveKopiBtn.addEventListener("click", () =>
      saveSpecial("kopi-special", kopiSelect.value)
    );
    saveMatchaBtn.addEventListener("click", () =>
      saveSpecial("matcha-special", matchaSelect.value)
    );
  }
  // --- LOGIKA BARU: CRUD (CREATE, READ, UPDATE, DELETE) UNTUK SPESIAL ---
  function setupSpecialsCRUD() {
    const specialsRef = db.collection("specials");
    const listContainer = document.getElementById("specials-list-container");
    const modal = document.getElementById("special-modal");
    const modalTitle = document.getElementById("special-modal-title");
    const form = document.getElementById("special-form");
    const addBtn = document.getElementById("add-special-btn");

    const formFields = {
      id: document.getElementById("special-id"),
      name: document.getElementById("special-name"),
      description: document.getElementById("special-description"),
      imageUrl: document.getElementById("special-image-url"),
      category: document.getElementById("special-category"),
      preview: document.getElementById("special-image-preview"),
    };

    // Fungsi untuk membuka modal (baik untuk 'add' atau 'edit')
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

    const closeModal = () => (modal.style.display = "none");

    // Event listener untuk tombol dan modal
    addBtn.addEventListener("click", () => openModal());
    modal.querySelector(".close-btn").addEventListener("click", closeModal);
    formFields.imageUrl.addEventListener("input", () => {
      formFields.preview.src = formFields.imageUrl.value;
      formFields.preview.style.display = formFields.imageUrl.value
        ? "block"
        : "none";
    });

    // READ: Tampilkan daftar spesial secara real-time
    specialsRef.orderBy("createdAt", "desc").onSnapshot((snapshot) => {
      listContainer.innerHTML = "";
      if (snapshot.empty) {
        listContainer.innerHTML =
          "<p>Belum ada menu spesial yang ditambahkan.</p>";
        return;
      }
      snapshot.forEach((doc) => {
        const special = { id: doc.id, ...doc.data() };
        const card = document.createElement("div");
        card.className = "special-card";
        card.innerHTML = `
          <img src="${special.imageUrl}" alt="${special.name}" class="special-card__image">
          <div class="special-card__content">
            <h3 class="special-card__name">${special.name}</h3>
            <p class="special-card__description">${special.description}</p>
            <div class="special-card__footer">
              <button class="button edit-special-btn"><i class="ri-pencil-line"></i> Edit</button>
              <button class="button button-danger delete-special-btn"><i class="ri-delete-bin-line"></i> Hapus</button>
            </div>
          </div>
        `;

        // EDIT button
        card
          .querySelector(".edit-special-btn")
          .addEventListener("click", () => openModal(special));

        // DELETE button
        card
          .querySelector(".delete-special-btn")
          .addEventListener("click", async () => {
            if (
              confirm(`Yakin ingin menghapus menu spesial "${special.name}"?`)
            ) {
              await specialsRef.doc(special.id).delete();
              showAdminNotification("Menu spesial berhasil dihapus.");
            }
          });

        listContainer.appendChild(card);
      });
    });

    // CREATE & UPDATE: Logika saat form disubmit
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

      if (id) {
        // Update
        await specialsRef.doc(id).update(data);
        showAdminNotification("Menu spesial berhasil diperbarui!");
      } else {
        // Create
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await specialsRef.add(data);
        showAdminNotification("Menu spesial berhasil ditambahkan!");
      }
      closeModal();
    });
  } // Akhir dari setupSpecialsCRUD
  // --- LOGIKA BARU: CRUD UNTUK ULASAN PELANGGAN ---
  function setupReviewsCRUD() {
    const reviewsRef = db.collection("reviews");
    const listContainer = document.getElementById("reviews-list-container");
    const modal = document.getElementById("review-modal");
    const form = document.getElementById("review-edit-form");
    const starsEditContainer = document.getElementById("rating-stars-edit");

    if (!listContainer || !modal) return;

    let currentEditRating = 0;

    // Fungsi untuk membuka modal edit
    const openEditModal = (review) => {
      form.reset();
      form.querySelector("#review-id").value = review.id;
      form.querySelector("#review-name-edit").value = review.name;
      form.querySelector("#review-text-edit").value = review.reviewText;

      currentEditRating = review.rating;
      updateStars(starsEditContainer, currentEditRating);

      modal.style.display = "block";
    };

    const closeModal = () => (modal.style.display = "none");
    modal.querySelector(".close-btn").addEventListener("click", closeModal);

    // Interaksi bintang di modal edit
    const updateStars = (container, rating) => {
      container.querySelectorAll("i").forEach((star) => {
        star.className =
          star.dataset.value <= rating ? "ri-star-fill" : "ri-star-line";
      });
    };
    starsEditContainer.addEventListener("click", (e) => {
      if (e.target.tagName === "I") {
        currentEditRating = e.target.dataset.value;
        updateStars(starsEditContainer, currentEditRating);
      }
    });

    // READ: Tampilkan daftar ulasan
    reviewsRef.orderBy("createdAt", "desc").onSnapshot((snapshot) => {
      listContainer.innerHTML = "";
      if (snapshot.empty) {
        listContainer.innerHTML = "<p>Belum ada ulasan dari pelanggan.</p>";
        return;
      }
      snapshot.forEach((doc) => {
        const review = { id: doc.id, ...doc.data() };

        let starsHTML = "";
        for (let i = 1; i <= 5; i++) {
          starsHTML += `<i class="${
            i <= review.rating ? "ri-star-fill" : "ri-star-line"
          }"></i>`;
        }

        const card = document.createElement("div");
        card.className = "admin-review-card";
        card.innerHTML = `
          <div class="admin-review-card__header">
            <div>
              <h3 class="admin-review-card__name">${review.name}</h3>
              <div class="admin-review-card__stars">${starsHTML}</div>
            </div>
            <span class="admin-review-card__category ${review.category}">${
          review.category
        }</span>
          </div>
          <p class="admin-review-card__text">"${review.reviewText}"</p>
          <small class="admin-review-card__date">Dibuat pada: ${
            review.createdAt ? formatDate(review.createdAt) : "N/A"
          }</small>
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
              confirm(`Yakin ingin menghapus ulasan dari "${review.name}"?`)
            ) {
              await reviewsRef.doc(review.id).delete();
              showAdminNotification("Ulasan berhasil dihapus.");
            }
          });

        listContainer.appendChild(card);
      });
    });

    // UPDATE: Logika saat form edit disubmit
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = form.querySelector("#review-id").value;
      const data = {
        name: form.querySelector("#review-name-edit").value,
        reviewText: form.querySelector("#review-text-edit").value,
        rating: parseInt(currentEditRating),
      };

      await reviewsRef.doc(id).update(data);
      showAdminNotification("Ulasan berhasil diperbarui!");
      closeModal();
    });
  }
});
