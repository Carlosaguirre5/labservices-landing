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
