document.addEventListener("DOMContentLoaded", () => {
  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.error("Firebase tidak terinisialisasi.");
    return;
  }
  const db = firebase.firestore();

  // Fungsi format Rupiah
  const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  /*=============== DYNAMIC PRODUCTS & FILTER ===============*/
  const productsContainer = document.querySelector(".products__container");
  const filterBtns = document.querySelectorAll(".products__filter-btn");

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
      let productsDisplayed = 0;
      snapshot.forEach((doc) => {
        const product = { id: doc.id, ...doc.data() };
        if (filter === "all" || product.category === filter) {
          productsDisplayed++;
          const card = document.createElement("article");
          card.className = "products__card";
          card.dataset.id = doc.id;
          card.dataset.name = product.name;
          card.dataset.price = product.price;
          card.dataset.category = product.category;
          card.innerHTML = `
              <div class="products__images">
                <div class="products__shape"></div>
                <img src="assets/img/ice-img.png" alt="ice" class="products__ice-1" />
                <img src="assets/img/ice-img.png" alt="ice" class="products__ice-2" />
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
              </div>
          `;
          productsContainer.appendChild(card);
        }
      });
      if (productsDisplayed === 0) {
        productsContainer.innerHTML = `<p class="info-text">Tidak ada produk di kategori ini.</p>`;
      }
      attachProductActionListeners();
    } catch (error) {
      console.error("Error fetching products: ", error);
      productsContainer.innerHTML =
        '<p class="error-text">Gagal memuat produk.</p>';
    }
  };
  renderProducts();

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.dataset.filter;
      renderProducts(filter);
    });
  });

  /*=============== CUSTOMIZATION MODAL LOGIC ===============*/
  const customizationModal = document.getElementById("customization-modal");
  const modalCloseBtn = document.getElementById("modal-close");
  const modalProductDetails = document.getElementById("modal-product-details");
  const sugarOptions = document.getElementById("sugar-options");
  const iceOptions = document.getElementById("ice-options");
  const modalAddToCartBtn = document.getElementById("modal-add-to-cart");

  let currentProduct = {};

  const openCustomizationModal = (product) => {
    currentProduct = product;
    modalProductDetails.innerHTML = `
            <img src="${product.imageUrl}" alt="${product.name}">
            <h3>${product.name}</h3>
            <span>${formatRupiah(product.price)}</span>
        `;
    // Reset options to default
    sugarOptions.querySelector(".active").classList.remove("active");
    sugarOptions
      .querySelector('[data-value="Normal Sugar"]')
      .classList.add("active");
    iceOptions.querySelector(".active").classList.remove("active");
    iceOptions
      .querySelector('[data-value="Normal Ice"]')
      .classList.add("active");

    customizationModal.classList.add("show-modal");
  };

  const closeCustomizationModal = () => {
    customizationModal.classList.remove("show-modal");
  };

  modalCloseBtn.addEventListener("click", closeCustomizationModal);

  sugarOptions.addEventListener("click", (e) => {
    if (e.target.classList.contains("option-btn")) {
      sugarOptions.querySelector(".active").classList.remove("active");
      e.target.classList.add("active");
    }
  });

  iceOptions.addEventListener("click", (e) => {
    if (e.target.classList.contains("option-btn")) {
      iceOptions.querySelector(".active").classList.remove("active");
      e.target.classList.add("active");
    }
  });

  modalAddToCartBtn.addEventListener("click", () => {
    const selectedSugar = sugarOptions.querySelector(".active").dataset.value;
    const selectedIce = iceOptions.querySelector(".active").dataset.value;

    // Create a unique ID for the cart item based on product and options
    const cartItemId = `${currentProduct.id}-${selectedSugar}-${selectedIce}`;

    addToCart(
      cartItemId,
      currentProduct.id,
      currentProduct.name,
      currentProduct.price,
      currentProduct.imageUrl,
      { sugar: selectedSugar, ice: selectedIce }
    );
    closeCustomizationModal();
  });

  /*=============== KODE LAINNYA (TIDAK BERUBAH) ===============*/
  const navMenu = document.getElementById("nav-menu"),
    navToggle = document.getElementById("nav-toggle"),
    navClose = document.getElementById("nav-close");
  if (navToggle) {
    navToggle.addEventListener("click", () =>
      navMenu.classList.add("show-menu")
    );
  }
  if (navClose) {
    navClose.addEventListener("click", () =>
      navMenu.classList.remove("show-menu")
    );
  }
  const navLink = document.querySelectorAll(".nav__link");
  const linkAction = () => navMenu.classList.remove("show-menu");
  navLink.forEach((n) => n.addEventListener("click", linkAction));
  const shadowHeader = () => {
    const header = document.getElementById("header");
    window.scrollY >= 50
      ? header.classList.add("shadow-header")
      : header.classList.remove("shadow-header");
  };
  window.addEventListener("scroll", shadowHeader);
  const scrollUp = () => {
    const scrollUp = document.getElementById("scroll-up");
    window.scrollY >= 350
      ? scrollUp.classList.add("show-scroll")
      : scrollUp.classList.remove("show-scroll");
  };
  window.addEventListener("scroll", scrollUp);
  const sections = document.querySelectorAll("section[id]");
  const scrollActive = () => {
    const scrollDown = window.scrollY;
    sections.forEach((current) => {
      const sectionHeight = current.offsetHeight,
        sectionTop = current.offsetTop - 58,
        sectionId = current.getAttribute("id"),
        sectionsClass = document.querySelector(
          ".nav__menu a[href*=" + sectionId + "]"
        );
      if (scrollDown > sectionTop && scrollDown <= sectionTop + sectionHeight) {
        sectionsClass.classList.add("active-link");
      } else {
        sectionsClass.classList.remove("active-link");
      }
    });
  };
  window.addEventListener("scroll", scrollActive);
  var specialSwiper = new Swiper(".special-swiper", {
    loop: true,
    effect: "fade",
    autoplay: {
      delay: 3500,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
    },
    pagination: { el: ".swiper-pagination", clickable: true },
  });

  const cartIcon = document.getElementById("cart-icon"),
    cart = document.getElementById("cart"),
    cartClose = document.getElementById("cart-close"),
    cartContent = document.getElementById("cart-content"),
    cartItemCount = document.getElementById("cart-item-count"),
    cartTotalPrice = document.getElementById("cart-total-price"),
    cartCheckoutButton = document.getElementById("cart-checkout-button"),
    body = document.body;
  let cartItems = JSON.parse(localStorage.getItem("kopiMatchaCart")) || [];
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
  cartIcon.addEventListener("click", showCart);
  cartClose.addEventListener("click", hideCart);
  const showNotification = (message) => {
    const notification = document.createElement("div");
    notification.classList.add("notification");
    notification.innerText = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add("show"), 10);
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => document.body.removeChild(notification), 500);
    }, 2000);
  };
  const updateCart = () => {
    cartContent.innerHTML = "";
    let total = 0,
      itemCount = 0;
    if (cartItems.length === 0) {
      cartContent.innerHTML =
        '<p class="cart__empty-message">Keranjang Anda kosong.</p>';
      cartCheckoutButton.style.display = "none";
    } else {
      cartItems.forEach((item) => {
        const cartItemElement = document.createElement("div");
        cartItemElement.classList.add("cart__item");
        cartItemElement.innerHTML = `
          <img src="${item.imageUrl}" alt="${item.name}" class="cart__item-img">
          <div class="cart__item-details">
            <h3 class="cart__item-name">${item.name}</h3>
            <div class="cart__item-options">
                <small>${item.options.sugar}, ${item.options.ice}</small>
            </div>
            <span class="cart__item-price">${formatRupiah(
              item.price * item.quantity
            )}</span>
            <div class="cart__item-actions">
              <div class="cart__item-quantity-controls">
                <button class="cart__quantity-btn decrease-qty" data-id="${
                  item.id
                }">-</button>
                <span class="cart__item-quantity">${item.quantity}</span>
                <button class="cart__quantity-btn increase-qty" data-id="${
                  item.id
                }">+</button>
              </div>
              <i class="ri-delete-bin-line cart__item-remove" data-id="${
                item.id
              }"></i>
            </div>
          </div>
        `;
        cartContent.appendChild(cartItemElement);
        total += item.price * item.quantity;
        itemCount += item.quantity;
      });
      cartCheckoutButton.style.display = "block";
    }
    cartTotalPrice.innerText = formatRupiah(total);
    cartItemCount.innerText = itemCount;
    saveCart();
  };

  const addToCart = (cartItemId, productId, name, price, imageUrl, options) => {
    const existingItem = cartItems.find((item) => item.id === cartItemId);
    if (existingItem) {
      existingItem.quantity++;
    } else {
      cartItems.push({
        id: cartItemId,
        productId,
        name,
        price,
        imageUrl,
        options,
        quantity: 1,
      });
    }
    updateCart();
    showNotification(`${name} ditambahkan!`);
  };

  cartContent.addEventListener("click", (e) => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    if (e.target.classList.contains("increase-qty")) {
      const item = cartItems.find((i) => i.id === id);
      if (item) item.quantity++;
    }
    if (e.target.classList.contains("decrease-qty")) {
      let item = cartItems.find((i) => i.id === id);
      if (item && item.quantity > 1) item.quantity--;
      else cartItems = cartItems.filter((i) => i.id !== id);
    }
    if (e.target.classList.contains("cart__item-remove")) {
      cartItems = cartItems.filter((i) => i.id !== id);
      showNotification("Item dihapus.");
    }
    updateCart();
  });

  const attachProductActionListeners = () => {
    document.querySelectorAll(".choose-options-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const card = e.target.closest(".products__card");
        const product = {
          id: card.dataset.id,
          name: card.dataset.name,
          price: parseFloat(card.dataset.price),
          imageUrl: card.querySelector(".products__coffee").src,
        };
        openCustomizationModal(product);
      });
    });
  };

  const redirectToCheckout = (items) => {
    const itemsJson = JSON.stringify(items);
    window.location.href = `checkout.html?items=${encodeURIComponent(
      itemsJson
    )}`;
  };
  cartCheckoutButton.addEventListener("click", () => {
    if (cartItems.length > 0) redirectToCheckout(cartItems);
  });
  updateCart();
  const sr = ScrollReveal({
    origin: "bottom",
    distance: "80px",
    duration: 2500,
    delay: 200,
    reset: false,
    easing: "cubic-bezier(0.5, 0, 0, 1)",
  });
  sr.reveal(".home__title, .home__description, .home__sticker");
  sr.reveal(".home__shape", { origin: "bottom", delay: 400 });
  sr.reveal(".home__coffee", { delay: 800, distance: "200px" });
  sr.reveal(".home__splash", { delay: 1200, scale: 0, duration: 2000 });
  sr.reveal(
    ".home__bean-1, .home__bean-2, .home__ice-1, .home__ice-2, .home__leaf",
    { interval: 100, delay: 1500, scale: 0, rotate: { z: 180 } }
  );
  sr.reveal(".section__title", { delay: 200 });
  sr.reveal(".special__card", {
    delay: 400,
    origin: "left",
    distance: "100px",
  });
  sr.reveal(".products__filter-btn", { interval: 100, origin: "top" });
  sr.reveal(".products__card", { interval: 100, origin: "top" });
  sr.reveal(".contact__info", { origin: "left", interval: 150, delay: 300 });
  sr.reveal(".contact__images", { origin: "right", delay: 500 });
  sr.reveal(".footer__container > div", { interval: 150, origin: "bottom" });
  sr.reveal(".footer__copy", { delay: 800 });
});
document.addEventListener("DOMContentLoaded", () => {
  /*=============== SHOW MENU ===============*/
  const navMenu = document.getElementById("nav-menu"),
    navToggle = document.getElementById("nav-toggle"),
    navClose = document.getElementById("nav-close");

  /* Show menu */
  if (navToggle) {
    navToggle.addEventListener("click", () => {
      navMenu.classList.add("show-menu");
    });
  }

  /* Menu hidden */
  if (navClose) {
    navClose.addEventListener("click", () => {
      navMenu.classList.remove("show-menu");
    });
  }

  /*=============== REMOVE MENU MOBILE ===============*/
  const navLink = document.querySelectorAll(".nav__link");

  const linkAction = () => {
    const navMenu = document.getElementById("nav-menu");
    // When we click on each nav__link, we remove the show-menu class
    navMenu.classList.remove("show-menu");
  };
  navLink.forEach((n) => n.addEventListener("click", linkAction));

  /*=============== SHADOW HEADER ===============*/
  const shadowHeader = () => {
    const header = document.getElementById("header");
    // When the scroll is greater than 50 viewport height, add the shadow-header class to the header tag
    window.scrollY >= 50
      ? header.classList.add("shadow-header")
      : header.classList.remove("shadow-header");
  };
  window.addEventListener("scroll", shadowHeader);

  /*=============== SHOW SCROLL UP ===============*/
  const scrollUp = () => {
    const scrollUp = document.getElementById("scroll-up");
    // When the scroll is higher than 350 viewport height, add the show-scroll class to the a tag with the scrollup class
    window.scrollY >= 350
      ? scrollUp.classList.add("show-scroll")
      : scrollUp.classList.remove("show-scroll");
  };
  window.addEventListener("scroll", scrollUp);

  /*=============== SCROLL SECTIONS ACTIVE LINK ===============*/
  const sections = document.querySelectorAll("section[id]");

  const scrollActive = () => {
    const scrollDown = window.scrollY;

    sections.forEach((current) => {
      const sectionHeight = current.offsetHeight,
        sectionTop = current.offsetTop - 58,
        sectionId = current.getAttribute("id"),
        sectionsClass = document.querySelector(
          ".nav__menu a[href*=" + sectionId + "]"
        );

      if (scrollDown > sectionTop && scrollDown <= sectionTop + sectionHeight) {
        sectionsClass.classList.add("active-link");
      } else {
        sectionsClass.classList.remove("active-link");
      }
    });
  };
  window.addEventListener("scroll", scrollActive);

  /*=============== SWIPER ===============*/
  var specialSwiper = new Swiper(".special-swiper", {
    loop: true,
    effect: "fade",
    autoplay: {
      delay: 3500,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
    },
    pagination: { el: ".swiper-pagination", clickable: true },
  });

  /*=============== CART ===============*/
  const cartIcon = document.getElementById("cart-icon"),
    cart = document.getElementById("cart"),
    cartClose = document.getElementById("cart-close"),
    cartContent = document.getElementById("cart-content"),
    cartItemCount = document.getElementById("cart-item-count"),
    cartTotalPrice = document.getElementById("cart-total-price"),
    cartCheckoutButton = document.getElementById("cart-checkout-button"),
    body = document.body;
  let cartItems = JSON.parse(localStorage.getItem("kopiMatchaCart")) || [];
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
  cartIcon.addEventListener("click", showCart);
  cartClose.addEventListener("click", hideCart);
  const showNotification = (message) => {
    const notification = document.createElement("div");
    notification.classList.add("notification");
    notification.innerText = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add("show"), 10);
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => document.body.removeChild(notification), 500);
    }, 2000);
  };
  const updateCart = () => {
    cartContent.innerHTML = "";
    let total = 0,
      itemCount = 0;
    if (cartItems.length === 0) {
      cartContent.innerHTML =
        '<p class="cart__empty-message">Keranjang Anda kosong.</p>';
      cartCheckoutButton.style.display = "none";
    } else {
      cartItems.forEach((item) => {
        const cartItemElement = document.createElement("div");
        cartItemElement.classList.add("cart__item");
        cartItemElement.innerHTML = `
          <img src="${item.imageUrl}" alt="${item.name}" class="cart__item-img">
          <div class="cart__item-details">
            <h3 class="cart__item-name">${item.name}</h3>
            <span class="cart__item-price">${formatRupiah(
              item.price * item.quantity
            )}</span>
            <div class="cart__item-actions">
              <div class="cart__item-quantity-controls">
                <button class="cart__quantity-btn decrease-qty" data-id="${
                  item.id
                }">-</button>
                <span class="cart__item-quantity">${item.quantity}</span>
                <button class="cart__quantity-btn increase-qty" data-id="${
                  item.id
                }">+</button>
              </div>
              <i class="ri-delete-bin-line cart__item-remove" data-id="${
                item.id
              }"></i>
            </div>
          </div>
        `;
        cartContent.appendChild(cartItemElement);
        total += item.price * item.quantity;
        itemCount += item.quantity;
      });
      cartCheckoutButton.style.display = "block";
    }
    cartTotalPrice.innerText = formatRupiah(total);
    cartItemCount.innerText = itemCount;
    saveCart();
  };
  const addToCart = (id, name, price, imageUrl, button) => {
    const existingItem = cartItems.find((item) => item.id === id);
    if (existingItem) {
      existingItem.quantity++;
    } else {
      cartItems.push({ id, name, price, imageUrl, quantity: 1 });
    }
    updateCart();
    showNotification(`${name} ditambahkan!`);
    button.innerHTML = 'Ditambahkan <i class="ri-check-line"></i>';
    button.classList.add("added");
    setTimeout(() => {
      button.innerHTML = "Ke Keranjang";
      button.classList.remove("added");
    }, 1500);
  };
  cartContent.addEventListener("click", (e) => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    if (e.target.classList.contains("increase-qty")) {
      const item = cartItems.find((i) => i.id === id);
      if (item) item.quantity++;
    }
    if (e.target.classList.contains("decrease-qty")) {
      let item = cartItems.find((i) => i.id === id);
      if (item && item.quantity > 1) item.quantity--;
      else cartItems = cartItems.filter((i) => i.id !== id);
    }
    if (e.target.classList.contains("cart__item-remove")) {
      cartItems = cartItems.filter((i) => i.id !== id);
      showNotification("Item dihapus.");
    }
    updateCart();
  });
  const attachProductActionListeners = () => {
    document.querySelectorAll(".add-to-cart-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const card = e.target.closest(".products__card");
        const { id, name, price } = card.dataset;
        const imageUrl = card.querySelector(".products__coffee").src;
        addToCart(id, name, parseFloat(price), imageUrl, e.target);
      });
    });
    document.querySelectorAll(".buy-now-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const card = e.target.closest(".products__card");
        const { id, name, price } = card.dataset;
        const imageUrl = card.querySelector(".products__coffee").src;
        const item = [
          { id, name, price: parseFloat(price), imageUrl, quantity: 1 },
        ];
        redirectToCheckout(item);
      });
    });
  };
  const redirectToCheckout = (items) => {
    const itemsJson = JSON.stringify(items);
    window.location.href = `checkout.html?items=${encodeURIComponent(
      itemsJson
    )}`;
  };
  cartCheckoutButton.addEventListener("click", () => {
    if (cartItems.length > 0) redirectToCheckout(cartItems);
  });
  updateCart();

  /*=============== SCROLL REVEAL ANIMATION ===============*/
  const sr = ScrollReveal({
    origin: "bottom",
    distance: "80px",
    duration: 2500,
    delay: 200,
    reset: false,
    easing: "cubic-bezier(0.5, 0, 0, 1)",
  });
  sr.reveal(".home__title, .home__description, .home__sticker");
  sr.reveal(".home__shape", { origin: "bottom", delay: 400 });
  sr.reveal(".home__coffee", { delay: 800, distance: "200px" });
  sr.reveal(".home__splash", { delay: 1200, scale: 0, duration: 2000 });
  sr.reveal(
    ".home__bean-1, .home__bean-2, .home__ice-1, .home__ice-2, .home__leaf",
    { interval: 100, delay: 1500, scale: 0, rotate: { z: 180 } }
  );
  sr.reveal(".section__title", { delay: 200 });
  sr.reveal(".special__card", {
    delay: 400,
    origin: "left",
    distance: "100px",
  });
  sr.reveal(".products__filter-btn", { interval: 100, origin: "top" });
  sr.reveal(".products__card", { interval: 100, origin: "top" });
  sr.reveal(".contact__info", { origin: "left", interval: 150, delay: 300 });
  sr.reveal(".contact__images", { origin: "right", delay: 500 });
  sr.reveal(".footer__container > div", { interval: 150, origin: "bottom" });
  sr.reveal(".footer__copy", { delay: 800 });
});

/*=============== PENDAFTARAN SERVICE WORKER UNTUK PWA ===============*/
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js") // Pastikan ada './'
      .then((registration) => {
        console.log("Service Worker berhasil didaftarkan: ", registration);
      })
      .catch((error) => {
        console.log("Pendaftaran Service Worker gagal: ", error);
      });
  });
}
