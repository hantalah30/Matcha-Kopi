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
      window.location.replace("login.html");
    }
  });

  function initAdminApp() {
    setupEventListeners();
    loadDashboardData();
    renderOrderTable();
    renderProductTable();
  }

  function setupEventListeners() {
    const sidebarLinks = document.querySelectorAll(".sidebar__link");
    sidebarLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        if (link.id === "logout-btn") return;
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
      });
    });

    const sidebarToggle = document.getElementById("sidebar-toggle");
    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", () => {
        document.body.classList.toggle("sidebar-show");
        sidebar.classList.toggle("collapsed");
      });
    }

    document.getElementById("logout-btn").addEventListener("click", (e) => {
      e.preventDefault();
      auth.signOut();
    });
  }

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

  const notificationSound = document.getElementById("notification-sound");
  let isFirstOrderLoad = true;
  const showAdminNotification = (message, isSuccess = true) => {
    const notification = document.getElementById("admin-notification");
    notification.textContent = message;
    notification.className =
      "admin-notification show " + (isSuccess ? "success" : "error");
    setTimeout(() => notification.classList.remove("show"), 3000);
  };

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

        // PERBAIKAN: Hitung pendapatan dari pesanan yang 'pending' atau 'completed'
        if (order.status === "completed" || order.status === "pending") {
          totalRevenue += order.total;
          if (order.createdAt && order.createdAt.toDate() >= todayStart) {
            revenueToday += order.total;
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
        }
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
      // PERBAIKAN: Chart juga harus menghitung pesanan 'pending' & 'completed'
      if (
        order.createdAt &&
        (order.status === "completed" || order.status === "pending")
      ) {
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
      options: {
        scales: {
          y: { ticks: { color: "rgba(255,255,255,0.7)" } },
          x: { ticks: { color: "rgba(255,255,255,0.7)" } },
        },
        plugins: { legend: { labels: { color: "rgba(255,255,255,0.7)" } } },
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
            borderColor: "hsl(215, 28%, 17%)",
            borderWidth: 4,
          },
        ],
      },
      options: {
        plugins: { legend: { labels: { color: "rgba(255,255,255,0.7)" } } },
      },
    });
  }

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
            .catch((e) => console.log("Gagal memutar notifikasi:", e));
          showAdminNotification("Ada pesanan baru!");
        }
        isFirstOrderLoad = false;

        orderTableBody.innerHTML = "";
        if (snapshot.empty) {
          orderTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Belum ada pesanan.</td></tr>`;
          return;
        }

        snapshot.forEach((doc) => {
          const order = doc.data();
          const row = document.createElement("tr");
          row.innerHTML = `
          <td>${formatTime(order.createdAt)}<br><small>${formatDate(
            order.createdAt
          )}</small></td>
          <td>${order.customerName}</td>
          <td>${formatRupiah(order.total)}</td>
          <td>${order.classSchedule} (${order.classroom})</td>
          <td><select class="status-select" data-id="${doc.id}"></select></td>
          <td><button class="action-btn view-details-btn" data-id="${
            doc.id
          }"><i class="ri-eye-line"></i></button></td>
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
        Object.keys(data).forEach((key) => {
          const el = document.getElementById(`product-${key.toLowerCase()}`);
          if (el) el.value = data[key];
        });
        document.getElementById("product-id").value = data.id;
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

    db.collection("products")
      .orderBy("name")
      .onSnapshot((snapshot) => {
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
          row
            .querySelector(".delete-btn")
            .addEventListener("click", async () => {
              if (confirm(`Yakin ingin menghapus ${product.name}?`)) {
                await db.collection("products").doc(product.id).delete();
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
      };

      if (id) {
        await db.collection("products").doc(id).update(productData);
        showAdminNotification("Produk berhasil diperbarui!");
      } else {
        productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection("products").add(productData);
        showAdminNotification("Produk berhasil ditambahkan!");
      }
      closeModal();
    });
  }
});
