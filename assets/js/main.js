document.addEventListener("DOMContentLoaded", () => {
  // Pastikan Firebase sudah siap
  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.error("Firebase tidak terinisialisasi dengan benar.");
    // Tampilkan pesan error yang lebih jelas di halaman jika Firebase gagal dimuat
    document.body.innerHTML =
      "<h1>Error Kritis: Firebase Gagal Dimuat. Periksa koneksi internet dan file firebase-config.js</h1>";
    return;
  }
  const db = firebase.firestore();

  const formatRupiah = (number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);

  /*=============== THEME & INTERACTIVITY SETUP ===============*/
  const body = document.body;

  // Efek hanya untuk desktop
  if (window.matchMedia("(min-width: 769px)").matches) {
    const home = document.getElementById("home");
    const kopiPanel = document.querySelector(".kopi-panel");
    const matchaPanel = document.querySelector(".matcha-panel");
    const cursorGlow = document.querySelector(".cursor-glow");

    if (home && kopiPanel && matchaPanel) {
      kopiPanel.addEventListener("mouseenter", () =>
        home.classList.add("hover-kopi")
      );
      kopiPanel.addEventListener("mouseleave", () =>
        home.classList.remove("hover-kopi")
      );
      matchaPanel.addEventListener("mouseenter", () =>
        home.classList.add("hover-matcha")
      );
      matchaPanel.addEventListener("mouseleave", () =>
        home.classList.remove("hover-matcha")
      );
    }

    if (cursorGlow) {
      window.addEventListener("mousemove", (e) => {
        cursorGlow.style.left = `${e.clientX}px`;
        cursorGlow.style.top = `${e.clientY}px`;
      });
    }
  }

  /*=============== DYNAMIC PRODUCTS ===============*/
  const productsContainer = document.querySelector(".products__container");
  const renderProducts = async (filter = "all") => {
    if (!productsContainer) return;
    productsContainer.innerHTML =
      '<p class="loading-text">Memuat produk...</p>';
    try {
      const snapshot = await db.collection("products").orderBy("name").get();
      productsContainer.innerHTML = "";
      if (snapshot.empty) {
        productsContainer.innerHTML =
          '<p class="info-text">Belum ada produk.</p>';
        return;
      }
      snapshot.forEach((doc) => {
        const product = { id: doc.id, ...doc.data() };
        if (filter === "all" || product.category === filter) {
          const card = document.createElement("article");
          card.className = "products__card";
          card.dataset.id = doc.id;
          card.dataset.name = product.name;
          card.dataset.price = product.price;
          card.dataset.imageUrl = product.imageUrl;
          card.innerHTML = `
            <div class="products__images">
              <img src="${product.imageUrl}" alt="${
            product.name
          }" class="products__coffee" />
            </div>
            <div class="products__data">
              <h3 class="products__name">${product.name.toUpperCase()}</h3>
              <span class="products__price">${formatRupiah(
                product.price
              )}</span>
            </div>
            <div class="products__buttons">
              <button class="button products__button-action choose-options-btn">Pilih Opsi</button>
            </div>`;
          productsContainer.appendChild(card);
        }
      });
      if (productsContainer.innerHTML === "") {
        productsContainer.innerHTML = `<p class="info-text">Tidak ada produk di kategori ini.</p>`;
      }
    } catch (error) {
      console.error("Error fetching products: ", error);
      productsContainer.innerHTML =
        '<p class="error-text">Gagal memuat produk.</p>';
    }
  };

  /*=============== CART & MODAL LOGIC ===============*/
  const cart = document.getElementById("cart");
  const cartContent = document.getElementById("cart-content");
  const customizationModal = document.getElementById("customization-modal");
  let cartItems = JSON.parse(localStorage.getItem("kopiMatchaCart")) || [];
  let currentProductForModal = {};

  const saveCart = () =>
    localStorage.setItem("kopiMatchaCart", JSON.stringify(cartItems));
  const showCart = () => {
    cart.classList.add("show-cart");
    body.style.overflow = "hidden";
  };
  const hideCart = () => {
    cart.classList.remove("show-cart");
    body.style.overflow = "auto";
  };

  const showNotification = (message) => {
    const notification = document.createElement("div");
    notification.classList.add("notification");
    notification.innerText = message;
    body.appendChild(notification);
    setTimeout(() => notification.classList.add("show"), 10);
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => body.removeChild(notification), 500);
    }, 2000);
  };

  const flyToCart = (targetElement) => {
    const cartIcon = document.getElementById("cart-icon");
    if (!cartIcon || !targetElement) return;
    const cartRect = cartIcon.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const flyingEl = document.createElement("img");
    flyingEl.src = targetElement.src;
    flyingEl.className = "fly-to-cart-animation";
    body.appendChild(flyingEl);

    flyingEl.style.left = `${targetRect.left + targetRect.width / 2}px`;
    flyingEl.style.top = `${targetRect.top + targetRect.height / 2}px`;
    flyingEl.style.width = `${targetRect.width}px`;
    flyingEl.style.height = `${targetRect.height}px`;

    requestAnimationFrame(() => {
      flyingEl.style.left = `${cartRect.left + cartRect.width / 2}px`;
      flyingEl.style.top = `${cartRect.top + cartRect.height / 2}px`;
      flyingEl.style.width = "20px";
      flyingEl.style.height = "20px";
      flyingEl.style.opacity = "0.5";
    });
    setTimeout(() => flyingEl.remove(), 800);
  };

  const updateCart = () => {
    const cartItemCount = document.getElementById("cart-item-count");
    const cartTotalPrice = document.getElementById("cart-total-price");
    const cartCheckoutButton = document.getElementById("cart-checkout-button");

    cartContent.innerHTML = "";
    let total = 0,
      itemCount = 0;

    if (cartItems.length === 0) {
      cartContent.innerHTML =
        '<p class="cart__empty-message">Keranjang Anda kosong.</p>';
      if (cartCheckoutButton) cartCheckoutButton.style.display = "none";
    } else {
      cartItems.forEach((item) => {
        if (!item || !item.options) {
          console.warn("Skipping malformed cart item:", item);
          return;
        }

        const cartItemElement = document.createElement("div");
        cartItemElement.classList.add("cart__item");
        cartItemElement.dataset.id = item.id;
        cartItemElement.innerHTML = `
          <img src="${item.imageUrl}" alt="${item.name}" class="cart__item-img">
          <div class="cart__item-details">
            <h3 class="cart__item-name">${item.name}</h3>
            <div class="cart__item-options"><small>${item.options.sugar}, ${
          item.options.ice
        }</small></div>
            <span class="cart__item-price">${formatRupiah(
              item.price * item.quantity
            )}</span>
            <div class="cart__item-actions">
              <div class="cart__item-quantity-controls">
                <button class="cart__quantity-btn decrease-qty">-</button>
                <span class="cart__item-quantity">${item.quantity}</span>
                <button class="cart__quantity-btn increase-qty">+</button>
              </div>
              <i class="ri-delete-bin-line cart__item-remove"></i>
            </div>
          </div>`;
        cartContent.appendChild(cartItemElement);
        total += item.price * item.quantity;
        itemCount += item.quantity;
      });
      if (cartCheckoutButton) cartCheckoutButton.style.display = "block";
    }
    if (cartTotalPrice) cartTotalPrice.innerText = formatRupiah(total);
    if (cartItemCount) cartItemCount.innerText = itemCount;
    saveCart();
  };

  const addToCart = (product, options) => {
    const cartItemId = `${product.id}-${options.sugar.replace(
      " ",
      "-"
    )}-${options.ice.replace(" ", "-")}`;
    const existingItem = cartItems.find((item) => item.id === cartItemId);
    if (existingItem) {
      existingItem.quantity++;
    } else {
      cartItems.push({
        id: cartItemId,
        productId: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        options,
        quantity: 1,
      });
    }
    updateCart();
    showNotification(`${product.name} ditambahkan!`);
  };

  const openCustomizationModal = (product) => {
    currentProductForModal = product;
    const modalProductDetails = document.getElementById(
      "modal-product-details"
    );
    const sugarOptions = document.getElementById("sugar-options");
    const iceOptions = document.getElementById("ice-options");
    modalProductDetails.innerHTML = `
      <img src="${product.imageUrl}" alt="${
      product.name
    }" id="modal-product-image">
      <h3>${product.name}</h3>
      <span>${formatRupiah(product.price)}</span>`;
    sugarOptions.querySelector(".active")?.classList.remove("active");
    sugarOptions
      .querySelector('[data-value="Normal Sugar"]')
      .classList.add("active");
    iceOptions.querySelector(".active")?.classList.remove("active");
    iceOptions
      .querySelector('[data-value="Normal Ice"]')
      .classList.add("active");
    customizationModal.classList.add("show-modal");
  };

  const closeCustomizationModal = () =>
    customizationModal.classList.remove("show-modal");

  /*=============== FUNGSI SPESIAL & REVIEW (DIPINDAHKAN KE DALAM) ===============*/
  const specialSection = document.getElementById("special");

  function showSkeleton(container, count = 2, type = "special") {
    container.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const skeletonCard = document.createElement("div");
      if (type === "special") {
        skeletonCard.className = "special__card skeleton-card";
        skeletonCard.innerHTML = `
              <div class="special__content">
                <div class="skeleton skeleton-h3"></div>
                <div class="skeleton skeleton-p"></div>
                <div class="skeleton skeleton-btn"></div>
              </div>
              <div class="skeleton skeleton-img"></div>`;
      } else {
        // type === 'review'
        skeletonCard.className = "review-card";
        skeletonCard.innerHTML = `
              <div class="review-card__header">
                <span class="skeleton" style="width: 100px; height: 20px;"></span>
                <div class="skeleton" style="width: 80px; height: 20px;"></div>
              </div>
              <p class="skeleton" style="width: 100%; height: 40px;"></p>
            `;
      }
      container.appendChild(skeletonCard);
    }
  }

  // --- FUNGSI BARU UNTUK "PANGGUNG SPESIAL" INTERAKTIF ---
  async function renderSpecials() {
    const specialContainer = document.getElementById("special-container");
    const specialSection = document.getElementById("special");
    if (!specialContainer || !specialSection) return;

    // Tampilkan skeleton loading
    specialContainer.innerHTML = `
            <div class="special-stage skeleton-card">
                <div class="special-stage__content"></div>
            </div>
            <div class="special-stage skeleton-card">
                <div class="special-stage__content"></div>
            </div>
        `;

    try {
      const specialsSnapshot = await db.collection("specials").get();

      if (specialsSnapshot.empty) {
        specialSection.style.display = "none";
        return;
      }

      specialContainer.innerHTML = ""; // Kosongkan skeleton

      specialsSnapshot.forEach((doc) => {
        const special = doc.data();
        const stage = document.createElement("div");
        stage.className = `special-stage ${special.category}-special`;

        stage.innerHTML = `
                    <div class="special-stage__bg"></div>
                    <div class="special-stage__particles"></div>
                    <div class="special-stage__spotlight"></div>
                    <div class="special-stage__badge">Edisi Terbatas</div>
                    <div class="special-stage__content">
                        <img src="${special.imageUrl}" alt="${special.name}" class="special-stage__img">
                        <h3 class="special-stage__name">${special.name}</h3>
                        <p class="special-stage__description">${special.description}</p>
                        <a href="#products" class="button">Pesan Sekarang</a>
                    </div>
                `;
        specialContainer.appendChild(stage);

        // LOGIKA INTERAKTIF 3D PARALLAX
        stage.addEventListener("mousemove", (e) => {
          const rect = stage.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;

          const rotateX = (y - centerY) / 20; // Intensitas rotasi X
          const rotateY = (centerX - x) / 20; // Intensitas rotasi Y

          stage.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

          const img = stage.querySelector(".special-stage__img");
          img.style.transform = `translateZ(80px) rotateX(${
            rotateX * 1.5
          }deg) rotateY(${rotateY * 1.5}deg)`;
        });

        stage.addEventListener("mouseleave", () => {
          stage.style.transform = "rotateX(0deg) rotateY(0deg)";
          const img = stage.querySelector(".special-stage__img");
          img.style.transform = "translateZ(50px)";
        });
      });
    } catch (error) {
      console.error("Gagal memuat spesial:", error);
      specialContainer.innerHTML = `<p class="info-text">Gagal memuat menu spesial.</p>`;
    }
  }

  // --- FUNGSI BARU UNTUK MENAMPILKAN "DINDING ULASAN" INTERAKTIF ---
  async function renderReviews() {
    const reviewsWall = document.getElementById("reviews-wall");
    const reviewsSection = document.getElementById("reviews");
    if (!reviewsWall || !reviewsSection) return;

    try {
      const reviewsSnapshot = await db
        .collection("reviews")
        .orderBy("createdAt", "desc")
        .limit(12)
        .get();

      if (reviewsSnapshot.empty) {
        reviewsSection.style.display = "none";
        return;
      }

      reviewsWall.innerHTML = "";

      reviewsSnapshot.forEach((doc) => {
        const review = doc.data();
        const initial = review.name.charAt(0).toUpperCase();

        let starsHTML = "";
        for (let i = 1; i <= 5; i++) {
          starsHTML += `<i class="${
            i <= review.rating ? "ri-star-fill" : "ri-star-line"
          }"></i>`;
        }

        // Tentukan ikon berdasarkan kategori
        const categoryIcon =
          review.category === "kopi"
            ? '<i class="ri-cup-line review-card__category-icon"></i>'
            : '<i class="ri-leaf-line review-card__category-icon"></i>';

        const card = document.createElement("div");
        card.className = `review-card ${review.category}`;
        card.innerHTML = `
                    <div class="review-card__header">
                        <div class="review-card__avatar">${initial}</div>
                        <div class="review-card__info">
                            <h3 class="review-card__name">${review.name} ${categoryIcon}</h3>
                            <div class="review-card__stars">${starsHTML}</div>
                        </div>
                    </div>
                    <p class="review-card__text">"${review.reviewText}"</p>
                `;
        reviewsWall.appendChild(card);
      });
    } catch (error) {
      console.error("Gagal memuat ulasan:", error);
      reviewsWall.innerHTML = `<p class="info-text container">Gagal memuat ulasan. Error: ${error.message}</p>`;
    }
  }

  /*=============== MASTER EVENT LISTENER (EVENT DELEGATION) ===============*/
  document.addEventListener("click", (e) => {
    const target = e.target;

    if (target.closest("#cart-icon")) showCart();
    if (target.closest("#cart-close")) hideCart();

    if (target.closest(".products__filter-btn")) {
      document
        .querySelector(".products__filter-btn.active")
        .classList.remove("active");
      const btn = target.closest(".products__filter-btn");
      btn.classList.add("active");
      renderProducts(btn.dataset.filter);
      body.classList.toggle("matcha-theme", btn.dataset.filter === "matcha");
    }

    if (target.closest(".choose-options-btn")) {
      const card = target.closest(".products__card");
      if (card) {
        openCustomizationModal({
          id: card.dataset.id,
          name: card.dataset.name,
          price: parseFloat(card.dataset.price),
          imageUrl: card.dataset.imageUrl,
        });
      }
    }

    if (target.closest(".modal-close") || target === customizationModal)
      closeCustomizationModal();
    if (target.classList.contains("option-btn")) {
      const parent = target.closest(".options-container");
      parent.querySelector(".active")?.classList.remove("active");
      target.classList.add("active");
    }

    if (target.id === "modal-add-to-cart") {
      const selectedSugar = document.querySelector("#sugar-options .active")
        .dataset.value;
      const selectedIce = document.querySelector("#ice-options .active").dataset
        .value;
      addToCart(currentProductForModal, {
        sugar: selectedSugar,
        ice: selectedIce,
      });
      flyToCart(document.getElementById("modal-product-image"));
      closeCustomizationModal();
    }

    const cartItem = target.closest(".cart__item");
    if (cartItem) {
      const cartItemId = cartItem.dataset.id;
      const itemIndex = cartItems.findIndex((i) => i.id === cartItemId);
      if (itemIndex === -1) return;
      if (target.classList.contains("increase-qty")) {
        cartItems[itemIndex].quantity++;
        updateCart();
      } else if (target.classList.contains("decrease-qty")) {
        cartItems[itemIndex].quantity--;
        if (cartItems[itemIndex].quantity <= 0) cartItems.splice(itemIndex, 1);
        updateCart();
      } else if (target.classList.contains("cart__item-remove")) {
        cartItem.classList.add("removing");
        setTimeout(() => {
          cartItems.splice(itemIndex, 1);
          updateCart();
          showNotification("Item dihapus.");
        }, 400);
      }
    }

    if (target.closest(".mobile-nav__link")) {
      if (window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }

    if (target.id === "cart-checkout-button" && cartItems.length > 0) {
      window.location.href = `checkout.html?items=${encodeURIComponent(
        JSON.stringify(cartItems)
      )}`;
    }
  });

  /*=============== UI SETUP & SCROLL-BASED LOGIC ===============*/
  const sections = document.querySelectorAll("section[id]");
  const allNavLinks = document.querySelectorAll(
    ".nav__link, .mobile-nav__link"
  );
  const mobileNav = document.getElementById("mobile-nav");
  const mobileNavIndicator = document.querySelector(".mobile-nav__indicator");
  let lastScrollY = window.scrollY;

  const scrollActive = () => {
    const scrollY = window.scrollY;

    if (mobileNav) {
      if (scrollY > lastScrollY && scrollY > 200)
        mobileNav.classList.add("hide");
      else mobileNav.classList.remove("hide");
      lastScrollY = scrollY <= 0 ? 0 : scrollY;
    }

    let currentSectionId = "";
    sections.forEach((current) => {
      const sectionHeight = current.offsetHeight;
      const sectionTop =
        current.offsetTop -
        (window.innerWidth >= 769 ? 70 : window.innerHeight / 2);
      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        currentSectionId = current.getAttribute("id");
      }
    });

    allNavLinks.forEach((link, index) => {
      const isActive = link.getAttribute("href") === `#${currentSectionId}`;
      link.classList.toggle("active-link", isActive);

      if (isActive && link.closest(".mobile-nav")) {
        const linkIndex = Array.from(mobileNav.children).indexOf(link) - 1;
        if (mobileNavIndicator) {
          mobileNavIndicator.style.transform = `translateX(${
            linkIndex * 100
          }%)`;
        }
      }
    });
  };

  window.addEventListener("scroll", scrollActive, { passive: true });
  window.addEventListener(
    "scroll",
    () => {
      document
        .getElementById("header")
        .classList.toggle("shadow-header", window.scrollY >= 50);
      document
        .getElementById("scroll-up")
        .classList.toggle("show-scroll", window.scrollY >= 350);
    },
    { passive: true }
  );

  const footer = document.getElementById("footer");
  const footerNamesContainer = document.querySelector(".footer__names");
  const glowLine = document.querySelector(".footer__glow-line");
  if (footer && footerNamesContainer && glowLine) {
    footerNamesContainer.addEventListener("mouseleave", () => {
      glowLine.style.width = "0px";
    });

    footerNamesContainer.querySelectorAll(".footer__name").forEach((name) => {
      name.addEventListener("mouseenter", () => {
        const rect = name.getBoundingClientRect();
        const containerRect = footerNamesContainer.getBoundingClientRect();
        glowLine.style.width = `${rect.width}px`;
        glowLine.style.transform = `translateX(${
          rect.left - containerRect.left
        }px)`;
      });
    });
  }

  /*=============== PROMO POPUP LOGIC ===============*/
  const promoPopupElement = document.getElementById("promo-popup");
  const promoPopupImage = document.getElementById("promo-popup-image");
  const promoPopupText = document.getElementById("promo-popup-text");
  const promoPopupCloseBtn = document.getElementById("promo-popup-close");
  const promoPopupLink = document.getElementById("promo-popup-link");
  const popupConfigRef = db.collection("settings").doc("popupConfig");
  let popupTimeout; // Untuk auto-close jika diinginkan

  const showPromoPopup = async () => {
    console.log("Attempting to show promo popup...");

    // Pengecekan elemen penting
    if (
      !promoPopupElement ||
      !promoPopupImage ||
      !promoPopupText ||
      !promoPopupCloseBtn ||
      !promoPopupLink
    ) {
      console.error("Popup elements not found in index.html!");
      return;
    }

    // Jangan tampilkan jika sudah ditutup di sesi ini
    if (sessionStorage.getItem("promoPopupClosed") === "true") {
      console.log("Popup already closed in this session.");
      return;
    }

    console.log("Fetching popup config from Firestore...");
    try {
      const doc = await popupConfigRef.get();
      if (doc.exists) {
        const config = doc.data();
        console.log("Popup config fetched:", config);
        // Validasi data penting & status aktif
        if (config.isEnabled && config.imageUrl && config.text) {
          console.log("Popup is enabled and data is valid. Showing popup...");
          promoPopupImage.src = config.imageUrl;
          promoPopupImage.style.display = "block"; // Tampilkan gambar
          promoPopupText.textContent = config.text;

          // Atur link jika ada
          if (config.linkUrl) {
            promoPopupLink.href = config.linkUrl;
            promoPopupLink.style.cursor = "pointer"; // Pastikan kursor pointer
            // Pastikan link terbuka di tab baru jika itu yang diinginkan
            promoPopupLink.target = "_blank";
            promoPopupLink.rel = "noopener noreferrer";
          } else {
            // Jika tidak ada link, hapus atribut href dan ubah kursor
            promoPopupLink.removeAttribute("href");
            promoPopupLink.style.cursor = "default";
            promoPopupLink.target = ""; // Hapus target
            promoPopupLink.rel = "";
          }

          promoPopupElement.classList.add("show");

          // Opsional: Set timer auto-close (misal: 10 detik)
          // clearTimeout(popupTimeout);
          // popupTimeout = setTimeout(() => {
          //     console.log("Auto-closing popup after timeout.");
          //     hidePromoPopup();
          // }, 10000); // 10 detik
        } else {
          console.log("Popup is disabled or image/text is missing in config.");
          promoPopupElement.classList.remove("show"); // Pastikan tidak tampil
        }
      } else {
        console.log("Popup config document does not exist in Firestore.");
        promoPopupElement.classList.remove("show"); // Pastikan tidak tampil
      }
    } catch (error) {
      console.error("!!! Firebase Read Error (Popup):", error);
      // Jangan tampilkan popup jika gagal fetch
      promoPopupElement.classList.remove("show");
    }
  };

  const hidePromoPopup = () => {
    if (promoPopupElement) {
      promoPopupElement.classList.remove("show");
      console.log("Hiding popup and setting sessionStorage flag.");
    }
    sessionStorage.setItem("promoPopupClosed", "true"); // Tandai sudah ditutup di sesi ini
    clearTimeout(popupTimeout); // Hapus timer auto-close jika ada
  };

  // Tambahkan event listener ke tombol close popup
  if (promoPopupCloseBtn) {
    promoPopupCloseBtn.addEventListener("click", (e) => {
      e.preventDefault(); // Mencegah link diaktifkan jika tombol close diklik
      e.stopPropagation(); // Mencegah klik menyebar ke link di bawahnya
      hidePromoPopup();
    });
  } else {
    console.error("Popup close button not found!");
  }

  // ... (variabel popup sebelumnya) ...
  const feedbackModal = document.getElementById("feedback-modal");
  const openFeedbackBtn = document.getElementById("open-feedback-modal-btn");
  const closeFeedbackBtn = document.getElementById("feedback-modal-close");
  const feedbackForm = document.getElementById("feedback-form");
  const submitFeedbackBtn = document.getElementById("submit-feedback-btn");
  const feedbackSuccessMessage = document.getElementById(
    "feedback-success-message"
  );
  const feedbackErrorMessage = document.getElementById(
    "feedback-error-message"
  );

  /*=============== FEEDBACK MODAL LOGIC ===============*/
  const openFeedbackModal = () => {
    if (feedbackModal) {
      feedbackModal.classList.add("show-modal");
      feedbackSuccessMessage.style.display = "none"; // Sembunyikan pesan sukses/error
      feedbackErrorMessage.style.display = "none";
      feedbackForm.reset(); // Kosongkan form saat dibuka
      submitFeedbackBtn.classList.remove("loading"); // Reset tombol
      submitFeedbackBtn.disabled = false;
    }
  };

  const closeFeedbackModal = () => {
    if (feedbackModal) feedbackModal.classList.remove("show-modal");
  };

  // Event listener untuk membuka modal
  if (openFeedbackBtn) {
    openFeedbackBtn.addEventListener("click", openFeedbackModal);
  }

  // Event listener untuk menutup modal (tombol X dan klik di luar)
  if (closeFeedbackBtn) {
    closeFeedbackBtn.addEventListener("click", closeFeedbackModal);
  }
  if (feedbackModal) {
    feedbackModal.addEventListener("click", (e) => {
      if (e.target === feedbackModal) {
        // Hanya jika klik area overlay
        closeFeedbackModal();
      }
    });
  }

  // Event listener untuk submit form feedback
  if (feedbackForm) {
    feedbackForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      submitFeedbackBtn.classList.add("loading");
      submitFeedbackBtn.disabled = true;
      feedbackSuccessMessage.style.display = "none";
      feedbackErrorMessage.style.display = "none";

      const name = document.getElementById("feedback-name").value || "Anonim"; // Default 'Anonim' jika kosong
      const message = document.getElementById("feedback-message").value;

      try {
        // Simpan ke Firestore koleksi 'feedback'
        await db.collection("feedback").add({
          name: name,
          message: message,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        feedbackSuccessMessage.style.display = "block"; // Tampilkan pesan sukses
        feedbackForm.reset(); // Kosongkan form
        // Opsional: Tutup modal setelah beberapa detik
        setTimeout(closeFeedbackModal, 2500);
      } catch (error) {
        console.error("Gagal mengirim feedback:", error);
        feedbackErrorMessage.style.display = "block"; // Tampilkan pesan error
      } finally {
        // Hentikan loading terlepas dari sukses atau gagal (kecuali jika modal langsung ditutup)
        // Jika tidak ada timeout close:
        submitFeedbackBtn.classList.remove("loading");
        submitFeedbackBtn.disabled = false;
      }
    });
  }

  /*=============== INITIAL LOAD ===============*/
  renderProducts();
  renderSpecials();
  renderReviews(); // Panggil fungsi ini juga
  updateCart();
  scrollActive();
  showPromoPopup(); // <--- PANGGIL FUNGSI POPUP DI SINI

  /*=============== SCROLL REVEAL ANIMATION ===============*/
  const sr = ScrollReveal({
    origin: "bottom",
    distance: "80px",
    duration: 2500,
    delay: 200,
    reset: false,
    easing: "cubic-bezier(0.5, 0, 0, 1)",
  });
  sr.reveal(".special__card", {
    delay: 400,
    origin: "left",
    distance: "100px",
    interval: 100,
  });
  sr.reveal(".products__filter-btn", { interval: 100, origin: "top" });
  sr.reveal(".products__card", { interval: 100, origin: "top" });
}); // AKHIR DARI BLOK "DOMContentLoaded"

/*=============== SERVICE WORKER REGISTRATION ===============*/
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) =>
        console.log("Service Worker registered:", registration)
      )
      .catch((error) =>
        console.log("Service Worker registration failed:", error)
      );
  });
}

// --- EVENT LISTENER UNTUK TAB REVIEW ---
const reviewFilterBtns = document.querySelectorAll(".reviews__filter-btn");
reviewFilterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    reviewFilterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const filter = btn.dataset.filter;
    document.querySelectorAll(".reviews__content").forEach((content) => {
      content.classList.remove("active");
    });
    document.getElementById(`${filter}-reviews`).classList.add("active");
  });
});
