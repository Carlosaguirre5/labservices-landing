(function () {
  "use strict";

  var WHATSAPP_NUMBER = "50683291379"; // +506 8329 1379

  // Build wa.me links for every WhatsApp CTA using its data-wa-msg text.
  document.querySelectorAll(".js-wa").forEach(function (el) {
    var msg = el.getAttribute("data-wa-msg") || "Hola, quisiera más información sobre un examen de laboratorio";
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
        gtag('event', 'conversion', {
          'send_to': 'G-GEQRF93HDH/whatsapp_click',
          'event_callback': function () {}
        });
      });
    });

    document.querySelectorAll(".calendar-cta").forEach(function (el) {
      el.addEventListener("click", function () {
        gtag('event', 'conversion', {
          'send_to': 'G-GEQRF93HDH/calendar_click',
          'event_callback': function () {}
        });
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
