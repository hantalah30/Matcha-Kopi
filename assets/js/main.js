/*=============== SHOW MENU ===============*/
const navMenu = document.getElementById("nav-menu"),
  navToggle = document.getElementById("nav-toggle"),
  navClose = document.getElementById("nav-close");
if (navToggle) {
  navToggle.addEventListener("click", () => {
    navMenu.classList.add("show-menu");
  });
}
if (navClose) {
  navClose.addEventListener("click", () => {
    navMenu.classList.remove("show-menu");
  });
}

/*=============== REMOVE MENU MOBILE ===============*/
const navLink = document.querySelectorAll(".nav__link");
const linkAction = () => {
  navMenu.classList.remove("show-menu");
};
navLink.forEach((n) => n.addEventListener("click", linkAction));

/*=============== ADD SHADOW HEADER ===============*/
const shadowHeader = () => {
  const header = document.getElementById("header");
  window.scrollY >= 50
    ? header.classList.add("shadow-header")
    : header.classList.remove("shadow-header");
};
window.addEventListener("scroll", shadowHeader);

/*=============== SHOW SCROLL UP ===============*/
const scrollUp = () => {
  const scrollUp = document.getElementById("scroll-up");
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

/*=============== PREMIUM CART LOGIC & INTERACTIONS ===============*/
document.addEventListener("DOMContentLoaded", () => {
  const cartIcon = document.getElementById("cart-icon");
  const cart = document.getElementById("cart");
  const cartClose = document.getElementById("cart-close");
  const cartContent = document.getElementById("cart-content");
  const cartItemCount = document.getElementById("cart-item-count");
  const cartTotalPrice = document.getElementById("cart-total-price");
  const cartCheckoutButton = document.getElementById("cart-checkout-button");
  const body = document.body;

  // Load cart from localStorage
  let cartItems = JSON.parse(localStorage.getItem("kopiMatchaCart")) || [];

  const saveCart = () => {
    localStorage.setItem("kopiMatchaCart", JSON.stringify(cartItems));
  };

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
    let total = 0;
    let itemCount = 0;

    if (cartItems.length === 0) {
      cartContent.innerHTML =
        '<p class="cart__empty-message">Keranjang Anda kosong.</p>';
      cartCheckoutButton.style.display = "none";
    } else {
      cartItems.forEach((item) => {
        const cartItemElement = document.createElement("div");
        cartItemElement.classList.add("cart__item");
        cartItemElement.innerHTML = `
                    <img src="assets/img/products-coffee-${item.id}.png" alt="${
          item.name
        }" class="cart__item-img">
                    <div class="cart__item-details">
                        <h3 class="cart__item-name">${item.name}</h3>
                        <span class="cart__item-price">$${(
                          item.price * item.quantity
                        ).toFixed(2)}</span>
                        <div class="cart__item-actions">
                             <div class="cart__item-quantity-controls">
                                <button class="cart__quantity-btn decrease-qty" data-id="${
                                  item.id
                                }">-</button>
                                <span class="cart__item-quantity">${
                                  item.quantity
                                }</span>
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

    cartTotalPrice.innerText = `$${total.toFixed(2)}`;
    cartItemCount.innerText = itemCount;
    saveCart();
  };

  const addToCart = (id, name, price, button) => {
    const existingItem = cartItems.find((item) => item.id === id);
    if (existingItem) {
      existingItem.quantity++;
    } else {
      cartItems.push({ id, name, price, quantity: 1 });
    }
    updateCart();
    showNotification(`${name} ditambahkan!`);

    // Button feedback
    button.innerHTML = 'Ditambahkan <i class="ri-check-line"></i>';
    button.classList.add("added");
    setTimeout(() => {
      button.innerHTML = "Ke Keranjang";
      button.classList.remove("added");
    }, 1500);
  };

  cartContent.addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-id");
    if (e.target.classList.contains("increase-qty")) {
      const item = cartItems.find((i) => i.id === id);
      if (item) item.quantity++;
    }
    if (e.target.classList.contains("decrease-qty")) {
      const item = cartItems.find((i) => i.id === id);
      if (item && item.quantity > 1) {
        item.quantity--;
      } else {
        cartItems = cartItems.filter((i) => i.id !== id);
      }
    }
    if (e.target.classList.contains("cart__item-remove")) {
      cartItems = cartItems.filter((i) => i.id !== id);
      showNotification("Item dihapus.");
    }
    updateCart();
  });

  document.querySelectorAll(".add-to-cart-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const card = e.target.closest(".products__card");
      const id = card.getAttribute("data-id");
      const name = card.getAttribute("data-name");
      const price = parseFloat(card.getAttribute("data-price"));
      addToCart(id, name, price, e.target);
    });
  });

  const sendWhatsAppMessage = (message) => {
    const phoneNumber = "51123456789"; // GANTI DENGAN NOMOR ANDA
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodeURIComponent(
      message
    )}`;
    window.open(whatsappUrl, "_blank");
  };

  document.querySelectorAll(".buy-now-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const card = e.target.closest(".products__card");
      const name = card.getAttribute("data-name");
      const price = parseFloat(card.getAttribute("data-price"));
      const message = `Halo, saya mau pesan langsung:\n- ${name} (1 pcs) - $${price.toFixed(
        2
      )}\n\nOke pesanan anda sudah di buat, berikut menu yang di pesan dan harganya.`;
      sendWhatsAppMessage(message);
    });
  });

  cartCheckoutButton.addEventListener("click", () => {
    if (cartItems.length > 0) {
      let message = "Halo, saya mau pesan dari keranjang:\n";
      let total = 0;
      cartItems.forEach((item) => {
        message += `- ${item.name} (${item.quantity} pcs) - $${(
          item.price * item.quantity
        ).toFixed(2)}\n`;
        total += item.price * item.quantity;
      });
      message += `\n*Total: $${total.toFixed(
        2
      )}*\n\nOke pesanan anda sudah di buat, berikut menu yang di pesan dan harganya.`;
      sendWhatsAppMessage(message);
    }
  });

  updateCart(); // Initial cart render
});

/*=============== SCROLL REVEAL ANIMATION (ULTRA-SMOOTH) ===============*/
const sr = ScrollReveal({
  origin: "bottom",
  distance: "80px",
  duration: 2500,
  delay: 200,
  reset: false, // Animation runs once
  easing: "cubic-bezier(0.5, 0, 0, 1)",
});

// Staggered Animations for a more dynamic feel
sr.reveal(`.home__title, .home__description, .home__sticker`);
sr.reveal(`.home__shape`, { origin: "bottom", delay: 400 });
sr.reveal(`.home__coffee`, { delay: 800, distance: "200px" });
sr.reveal(`.home__splash`, { delay: 1200, scale: 0, duration: 2000 });
sr.reveal(
  `.home__bean-1, .home__bean-2, .home__ice-1, .home__ice-2, .home__leaf`,
  {
    interval: 100,
    delay: 1500,
    scale: 0,
    rotate: { z: 180 },
  }
);

sr.reveal(`.section__title`, { delay: 200 });
sr.reveal(`.products__card`, { interval: 100, origin: "top" });
sr.reveal(`.contact__info`, { origin: "left", interval: 150, delay: 300 });
sr.reveal(`.contact__images`, { origin: "right", delay: 500 });

sr.reveal(`.footer__container > div`, { interval: 150, origin: "bottom" });
sr.reveal(`.footer__copy`, { delay: 800 });
