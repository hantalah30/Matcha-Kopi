document.addEventListener("DOMContentLoaded", function () {
  if (typeof firebase === "undefined" || !firebase.auth) {
    console.error("Firebase tidak terinisialisasi.");
    return;
  }

  const db = firebase.firestore();
  const auth = firebase.auth();
  // Firebase Storage tidak diperlukan lagi, jadi kita hapus dari sini.

  auth.onAuthStateChanged((user) => {
    if (user) {
      loadDashboardData();
      renderProducts();
      renderCompositionTable();
    } else {
      window.location.replace("login.html");
    }
  });

  // --- FUNGSI-FUNGSI UTAMA (REKAP DATA, TABEL, DLL) ---
  const formatRupiah = (number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);

  const loadDashboardData = () => {
    db.collection("orders").onSnapshot((snapshot) => {
      let totalRevenue = 0,
        totalItemsSold = 0;
      const productSales = {};
      snapshot.forEach((doc) => {
        const order = doc.data();
        totalRevenue += order.total;
        order.items.forEach((item) => {
          totalItemsSold += item.quantity;
          productSales[item.name] =
            (productSales[item.name] || 0) + item.quantity;
        });
      });
      document.getElementById("total-revenue").textContent =
        formatRupiah(totalRevenue);
      document.getElementById("total-items-sold").textContent = totalItemsSold;
      if (Object.keys(productSales).length > 0) {
        const bestSeller = Object.keys(productSales).reduce((a, b) =>
          productSales[a] > productSales[b] ? a : b
        );
        document.getElementById("best-seller").textContent = bestSeller;
      } else {
        document.getElementById("best-seller").textContent = "-";
      }
    });
  };

  const renderCompositionTable = () => {
    const compositionTableBody = document.querySelector(
      "#composition-table tbody"
    );
    db.collection("products")
      .orderBy("name")
      .onSnapshot((snapshot) => {
        if (!compositionTableBody) return;
        compositionTableBody.innerHTML = "";
        if (snapshot.empty) {
          compositionTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Belum ada produk.</td></tr>`;
          return;
        }
        snapshot.forEach((doc) => {
          const product = doc.data();
          const cost = product.cost || 0,
            price = product.price || 0,
            profit = price - cost;
          const row = `<tr><td>${product.name}</td><td>${
            product.composition || "-"
          }</td><td>${formatRupiah(cost)}</td><td>${formatRupiah(
            price
          )}</td><td style="color: ${
            profit > 0 ? "var(--success-color)" : "var(--danger-color)"
          }; font-weight: 600;">${formatRupiah(profit)}</td></tr>`;
          compositionTableBody.innerHTML += row;
        });
      });
  };

  // --- FOKUS PERBAIKAN DI SINI ---

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn)
    logoutBtn.addEventListener("click", () =>
      auth.signOut().then(() => window.location.replace("login.html"))
    );

  const productsRef = db.collection("products");
  const productTableBody = document.querySelector("#product-table tbody");
  const modal = document.getElementById("product-modal");
  const modalTitle = document.getElementById("modal-title");
  const productForm = document.getElementById("product-form");
  const imagePreview = document.getElementById("image-preview");
  const addProductBtn = document.getElementById("add-product-btn");
  const closeBtn = document.querySelector(".close-btn");
  const imageUrlInput = document.getElementById("product-image-url"); // Input URL baru

  const showAdminNotification = (message, isSuccess = true) => {
    /* ... (fungsi notifikasi tetap sama) ... */
  };

  const renderProducts = () => {
    productsRef.orderBy("createdAt", "desc").onSnapshot(
      (snapshot) => {
        if (!productTableBody) return;
        productTableBody.innerHTML = "";
        if (snapshot.empty) {
          productTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Belum ada produk.</td></tr>`;
          return;
        }
        snapshot.forEach((doc) => {
          const product = doc.data();
          const row = `
            <tr>
              <td><img src="${
                product.imageUrl || "assets/img/favicon.png"
              }" alt="${product.name}" class="product-image-cell"></td>
              <td>${product.name}</td>
              <td>${formatRupiah(product.price)}</td>
              <td>${formatRupiah(product.cost || 0)}</td>
              <td>${product.category}</td>
              <td>
                <button class="action-btn edit-btn" data-id="${
                  doc.id
                }"><i class="ri-pencil-line"></i></button>
                <button class="action-btn delete-btn" data-id="${
                  doc.id
                }"><i class="ri-delete-bin-line"></i></button>
              </td>
            </tr>
          `;
          productTableBody.innerHTML += row;
        });
      },
      (error) => console.error("Gagal mengambil data produk: ", error)
    );
  };

  const openModal = () => {
    if (modal) modal.style.display = "block";
  };
  const closeModal = () => {
    if (modal) {
      modal.style.display = "none";
      productForm.reset();
      imagePreview.style.display = "none";
      imagePreview.src = "#";
      document.getElementById("product-id").value = "";
    }
  };

  if (addProductBtn)
    addProductBtn.addEventListener("click", () => {
      modalTitle.textContent = "Tambah Produk Baru";
      openModal();
    });
  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  if (imageUrlInput) {
    imageUrlInput.addEventListener("input", () => {
      const url = imageUrlInput.value;
      if (url) {
        imagePreview.src = url;
        imagePreview.style.display = "block";
      } else {
        imagePreview.style.display = "none";
      }
    });
  }

  // Logika saat form di-submit (DISEDERHANAKAN)
  if (productForm) {
    productForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitButton = productForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;

      const id = document.getElementById("product-id").value;
      const name = document.getElementById("product-name").value;
      const price = parseFloat(document.getElementById("product-price").value);
      const cost = parseFloat(document.getElementById("product-cost").value);
      const category = document.getElementById("product-category").value;
      const composition = document.getElementById("product-composition").value;
      const imageUrl = document.getElementById("product-image-url").value; // Ambil URL dari input

      if (!imageUrl) {
        alert("URL Gambar produk wajib diisi.");
        submitButton.disabled = false;
        return;
      }

      const productData = {
        name,
        price,
        cost,
        category,
        composition,
        imageUrl,
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
        closeModal();
      } catch (error) {
        console.error("Gagal menyimpan produk: ", error);
        showAdminNotification(`Error: ${error.message}`, false);
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  if (productTableBody) {
    productTableBody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button.action-btn");
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;

      if (btn.classList.contains("edit-btn")) {
        const doc = await productsRef.doc(id).get();
        if (!doc.exists) return;
        const product = doc.data();
        document.getElementById("product-id").value = id;
        document.getElementById("product-name").value = product.name;
        document.getElementById("product-price").value = product.price;
        document.getElementById("product-cost").value = product.cost || 0;
        document.getElementById("product-category").value = product.category;
        document.getElementById("product-composition").value =
          product.composition || "";
        imageUrlInput.value = product.imageUrl;
        imagePreview.src = product.imageUrl;
        imagePreview.style.display = "block";
        modalTitle.textContent = "Edit Produk";
        openModal();
      }

      if (btn.classList.contains("delete-btn")) {
        if (confirm("Apakah Anda yakin ingin menghapus produk ini?")) {
          await productsRef.doc(id).delete();
          showAdminNotification("Produk berhasil dihapus.");
        }
      }
    });
  }
});
