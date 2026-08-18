(function () {
  "use strict";

  var WHATSAPP_NUMBER = "50683291379"; // +506 8329 1379

  // Build wa.me links for every WhatsApp CTA using its data-wa-msg text.
  document.querySelectorAll(".js-wa").forEach(function (el) {
    var msg = el.getAttribute("data-wa-msg") || "👋 Hola, quisiera más información sobre un examen de laboratorio";
    el.setAttribute("href", "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(msg));
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener");
  });

  // Google Ads conversion tracking on WhatsApp / Calendar CTAs.
  // These links open in a new tab (target="_blank"), so the click is never
  // blocked or delayed waiting on the tag — no preventDefault, no timeout.
  if (typeof gtag === "function") {
    document.querySelectorAll(".whatsapp-cta").forEach(function (el) {
      el.addEventListener("click", function () {
        gtag('event', 'conversion', {'send_to': 'AW-18269468785/ZSN7COiAuN4cEPHwx4dE'});
      });
    });

    document.querySelectorAll(".calendar-cta").forEach(function (el) {
      el.addEventListener("click", function () {
        gtag('event', 'conversion', {'send_to': 'AW-18269468785/K6vjCOuAuN4cEPHwx4dE'});
      });
    });
  }

  // Contact form — submits to Web3Forms via fetch so we stay on-page.
  var contactForm = document.getElementById("contact-form");
  if (contactForm) {
    var statusEl = document.getElementById("contact-status");
    var submitBtn = document.getElementById("contact-submit");
    var submitLabel = document.getElementById("contact-submit-label");

    contactForm.addEventListener("submit", function (event) {
      event.preventDefault();

      // Honeypot: if this hidden field got filled, it's a bot — silently drop.
      if (contactForm.botcheck && contactForm.botcheck.value) {
        return;
      }

      submitBtn.disabled = true;
      submitLabel.textContent = "Enviando...";
      statusEl.textContent = "";
      statusEl.className = "form-status";

      var formData = new FormData(contactForm);

      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData
      })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data.success) {
            contactForm.reset();
            statusEl.textContent = "¡Gracias! Recibimos tu mensaje y te contactaremos pronto.";
            statusEl.classList.add("is-success");
          } else {
            statusEl.textContent = "No pudimos enviar tu mensaje. Intenta de nuevo o escríbenos por WhatsApp.";
            statusEl.classList.add("is-error");
          }
        })
        .catch(function () {
          statusEl.textContent = "No pudimos enviar tu mensaje. Intenta de nuevo o escríbenos por WhatsApp.";
          statusEl.classList.add("is-error");
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitLabel.textContent = "Enviar mensaje";
        });
    });
  }

  // Reveal-on-scroll for elements marked .reveal
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }
})();
