(function () {
  "use strict";

  /* ========================================================================
     Constantes editables
     ======================================================================== */

  var WEBHOOK_URL = "https://TU-N8N/webhook/omega-inscripcion"; // TODO: reemplazar cuando el flujo de n8n esté listo
  var WHATSAPP_NUMBER = "50683291379"; // +506 8329 1379

  var EVENT_DATE_ISO = "2026-08-28"; // ajustar si cambia el año/fecha del evento; el texto "viernes 28" en el HTML también debe actualizarse a mano
  var EVENT_START = "07:00";
  var EVENT_END = "11:00";
  var EVENT_LOCATION = "Planta Omega, Santa Ana";

  var SLOT_START_MIN = 7 * 60; // 7:00 a.m.
  var SLOT_END_MIN = 10 * 60 + 50; // último inicio de franja: 10:50 a.m. (dura 10 min, termina 11:00)
  var SLOT_STEP_MIN = 10;
  var FASTING_HOURS = 12;

  var ADDONS = [
    { id: "addon1", label: "Examen adicional 1", price: 0 }, // TODO: precios reales
    { id: "addon2", label: "Examen adicional 2", price: 0 }, // TODO: precios reales
    { id: "addon3", label: "Examen adicional 3", price: 0 }, // TODO: precios reales
    { id: "addon4", label: "Examen adicional 4", price: 0 }  // TODO: precios reales
  ];

  /* ========================================================================
     Utilidades
     ======================================================================== */

  function formatColones(n) {
    // Se formatea a mano (punto como separador de miles) en vez de usar
    // toLocaleString, ya que su salida para "es-CR" varía según el navegador.
    var withDots = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return "₡" + withDots;
  }

  function minutesToLabel(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    var suffix = h >= 12 ? "p.m." : "a.m.";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    var mm = m < 10 ? "0" + m : String(m);
    return h12 + ":" + mm + " " + suffix;
  }

  function calcAyunoLimite(slotMinutes) {
    // 12 horas antes de cualquier franja entre 7:00 y 10:50 a.m. cae siempre
    // la noche anterior (19:00-22:50), por eso el día no cambia, solo la hora.
    var cutoff = slotMinutes - FASTING_HOURS * 60;
    if (cutoff < 0) cutoff += 24 * 60;
    return minutesToLabel(cutoff);
  }

  var WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  function getDayBeforeLabel() {
    var eventDate = new Date(EVENT_DATE_ISO + "T00:00:00");
    var dayBefore = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
    return WEEKDAYS[dayBefore.getDay()] + " " + dayBefore.getDate();
  }

  function calcAge(isoDate) {
    var dob = new Date(isoDate + "T00:00:00");
    if (isNaN(dob.getTime())) return null;
    var today = new Date();
    var age = today.getFullYear() - dob.getFullYear();
    var m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }

  /* ========================================================================
     Horario: franjas cada 10 minutos
     ======================================================================== */

  var horarioSelect = document.getElementById("horario");
  if (horarioSelect) {
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Seleccioná...";
    horarioSelect.appendChild(placeholder);

    for (var t = SLOT_START_MIN; t <= SLOT_END_MIN; t += SLOT_STEP_MIN) {
      var opt = document.createElement("option");
      opt.value = String(t);
      opt.textContent = minutesToLabel(t);
      horarioSelect.appendChild(opt);
    }
  }

  var fastingDynamic = document.getElementById("fasting-dynamic");
  var ayunoCheckLabel = document.getElementById("ayuno-check-label");

  function updateFastingMessage() {
    var val = horarioSelect.value;
    if (!val) {
      fastingDynamic.classList.remove("is-visible");
      return;
    }
    var limite = calcAyunoLimite(parseInt(val, 10));
    var dayBefore = getDayBeforeLabel();
    fastingDynamic.textContent = "El " + dayBefore + ": tu última comida debe ser antes de las " + limite + " Después, solo agua.";
    fastingDynamic.classList.add("is-visible");
    if (ayunoCheckLabel) {
      ayunoCheckLabel.textContent = "Entiendo que debo llegar en ayuno de 12 horas: el " + dayBefore + ", mi última comida debe ser antes de las " + limite + " Después, solo agua: sin café, sin jugo, sin gaseosa, sin fumar. Si tomo medicamentos diarios, los sigo tomando normalmente con agua.";
    }
  }

  if (horarioSelect) {
    horarioSelect.addEventListener("change", updateFastingMessage);
  }

  /* ========================================================================
     Add-ons + total en vivo
     ======================================================================== */

  var addonsList = document.getElementById("addons-list");
  if (addonsList) {
    ADDONS.forEach(function (addon) {
      var row = document.createElement("div");
      row.className = "addon-row";
      row.innerHTML =
        '<input type="checkbox" id="' + addon.id + '" name="addons" value="' + addon.id + '" data-price="' + addon.price + '">' +
        '<label for="' + addon.id + '">' + addon.label + "</label>" +
        '<span class="addon-price">' + formatColones(addon.price) + "</span>";
      addonsList.appendChild(row);
    });
  }

  var totalAmountEl = document.getElementById("total-amount");
  var totalTractsEl = document.getElementById("total-tracts");

  function updateTotal() {
    var selectedPkg = document.querySelector('input[name="paquete"]:checked');
    var base = selectedPkg ? parseInt(selectedPkg.getAttribute("data-price"), 10) : 0;
    var tract = selectedPkg ? parseInt(selectedPkg.getAttribute("data-tract"), 10) : 0;

    var addonsTotal = 0;
    document.querySelectorAll('input[name="addons"]:checked').forEach(function (el) {
      addonsTotal += parseInt(el.getAttribute("data-price"), 10) || 0;
    });

    var total = base + addonsTotal;
    var tractTotal = tract + Math.round(addonsTotal / 2);

    totalAmountEl.textContent = formatColones(total);
    totalTractsEl.textContent = "2 tractos de " + formatColones(tractTotal);
  }

  document.querySelectorAll('input[name="paquete"]').forEach(function (el) {
    el.addEventListener("change", updateTotal);
  });
  document.addEventListener("change", function (e) {
    if (e.target.name === "addons") updateTotal();
  });
  updateTotal();

  /* ========================================================================
     Aviso PSA / TSH según sexo + edad
     ======================================================================== */

  var psaNotice = document.getElementById("psa-notice");
  var fechaNacimientoInput = document.getElementById("fecha-nacimiento");

  function updatePsaNotice() {
    var sexoHombre = document.getElementById("sexo-hombre");
    var isHombre = sexoHombre && sexoHombre.checked;
    var age = fechaNacimientoInput.value ? calcAge(fechaNacimientoInput.value) : null;
    var show = isHombre && age !== null && age >= 40;
    psaNotice.classList.toggle("is-visible", !!show);
  }

  document.querySelectorAll('input[name="sexo"]').forEach(function (el) {
    el.addEventListener("change", updatePsaNotice);
  });
  if (fechaNacimientoInput) {
    fechaNacimientoInput.addEventListener("change", updatePsaNotice);
  }

  /* ========================================================================
     Deducción de planilla → autorización condicional
     ======================================================================== */

  var planillaAuth = document.getElementById("planilla-auth");
  var planillaCheck = document.getElementById("planilla-check");

  document.querySelectorAll('input[name="pago"]').forEach(function (el) {
    el.addEventListener("change", function () {
      var isPlanilla = document.getElementById("pago-planilla").checked;
      planillaAuth.classList.toggle("is-visible", isPlanilla);
      planillaCheck.required = isPlanilla;
      if (!isPlanilla) {
        planillaCheck.checked = false;
        clearError("planilla-check");
      }
    });
  });

  /* ========================================================================
     Barra de progreso (según bloque visible)
     ======================================================================== */

  var blocks = document.querySelectorAll(".form-block");
  var progressFill = document.getElementById("progress-fill");
  var progressLabel = document.getElementById("progress-label");
  var totalBlocks = blocks.length;

  if ("IntersectionObserver" in window && blocks.length) {
    var blockObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var step = parseInt(entry.target.getAttribute("data-block"), 10);
            progressFill.style.width = (step / totalBlocks * 100) + "%";
            progressLabel.textContent = "Paso " + step + " de " + totalBlocks;
          }
        });
      },
      { threshold: 0.4, rootMargin: "-80px 0px -40% 0px" }
    );
    blocks.forEach(function (b) { blockObserver.observe(b); });
  }

  /* ========================================================================
     Botón fijo en móvil: aparece solo después de pasar el botón del hero,
     y desaparece de nuevo cuando el formulario ya está en pantalla (para
     que nunca compita por espacio con ninguno de los dos).
     ======================================================================== */

  var stickyCta = document.getElementById("sticky-cta");
  var heroCta = document.querySelector(".hero-cta-wrap .btn");
  var formSection = document.getElementById("inscripcion");

  if ("IntersectionObserver" in window && stickyCta && heroCta && formSection) {
    var heroCtaVisible = true;
    var formVisible = false;

    function refreshStickyVisibility() {
      var shouldShow = !heroCtaVisible && !formVisible;
      stickyCta.classList.toggle("is-hidden", !shouldShow);
    }

    var heroCtaObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          heroCtaVisible = entry.isIntersecting;
          refreshStickyVisibility();
        });
      },
      { threshold: 0 }
    );
    heroCtaObserver.observe(heroCta);

    var formObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          formVisible = entry.isIntersecting;
          refreshStickyVisibility();
        });
      },
      { threshold: 0.05 }
    );
    formObserver.observe(formSection);
  }

  document.querySelectorAll(".js-scroll-cta").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      formSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  /* ========================================================================
     Validación
     ======================================================================== */

  var form = document.getElementById("omega-form");

  function showError(fieldId, message) {
    var input = document.getElementById(fieldId);
    var errorEl = document.getElementById(fieldId + "-error");
    if (input) input.setAttribute("aria-invalid", "true");
    if (errorEl) {
      if (message) errorEl.textContent = message;
      errorEl.classList.add("is-visible");
    }
  }

  function clearError(fieldId) {
    var input = document.getElementById(fieldId);
    var errorEl = document.getElementById(fieldId + "-error");
    if (input) input.removeAttribute("aria-invalid");
    if (errorEl) errorEl.classList.remove("is-visible");
  }

  function isValidCedula(value) {
    var digits = value.replace(/[\s-]/g, "");
    if (/^\d{9}$/.test(digits)) return true; // cédula CR
    if (/^\d{11,12}$/.test(digits)) return true; // DIMEX
    if (/^[A-Za-z0-9]{5,20}$/.test(digits)) return true; // pasaporte
    return false;
  }

  function isValidPhone(value) {
    var digits = value.replace(/[\s-]/g, "");
    return /^[678]\d{7}$/.test(digits);
  }

  function validateField(fieldId) {
    var input = document.getElementById(fieldId);
    if (!input) return true;
    var value = input.value.trim();

    if (input.hasAttribute("required") && !value) {
      showError(fieldId);
      return false;
    }

    if (fieldId === "identificacion" && value && !isValidCedula(value)) {
      showError(fieldId);
      return false;
    }

    if (fieldId === "whatsapp" && value && !isValidPhone(value)) {
      showError(fieldId);
      return false;
    }

    if (fieldId === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      showError(fieldId);
      return false;
    }

    clearError(fieldId);
    return true;
  }

  ["nombre", "identificacion", "fecha-nacimiento", "whatsapp", "email", "departamento", "horario"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("blur", function () { validateField(id); });
  });

  function validateRadioGroup(name, errorId) {
    var checked = document.querySelector('input[name="' + name + '"]:checked');
    var errorEl = document.getElementById(errorId);
    if (!checked) {
      if (errorEl) errorEl.classList.add("is-visible");
      return false;
    }
    if (errorEl) errorEl.classList.remove("is-visible");
    return true;
  }

  function validateCheckbox(fieldId) {
    var input = document.getElementById(fieldId);
    var errorEl = document.getElementById(fieldId + "-error");
    if (!input) return true;
    if (input.required && !input.checked) {
      if (errorEl) errorEl.classList.add("is-visible");
      return false;
    }
    if (errorEl) errorEl.classList.remove("is-visible");
    return true;
  }

  function firstInvalidField() {
    return document.querySelector('[aria-invalid="true"]') ||
      form.querySelector(".field-error.is-visible");
  }

  function validateAll() {
    var ok = true;
    ["nombre", "identificacion", "fecha-nacimiento", "whatsapp", "email", "departamento", "horario"].forEach(function (id) {
      if (!validateField(id)) ok = false;
    });
    if (!validateRadioGroup("sexo", "sexo-error")) ok = false;
    if (!validateRadioGroup("pago", "pago-error")) ok = false;
    if (!validateCheckbox("planilla-check")) ok = false;
    if (!validateCheckbox("ayuno-check")) ok = false;
    if (!validateCheckbox("autorizacion-check")) ok = false;
    return ok;
  }

  /* ========================================================================
     Envío
     ======================================================================== */

  var submitBtn = document.getElementById("submit-btn");
  var submitLabel = document.getElementById("submit-label");
  var submitError = document.getElementById("submit-error");
  var retryBtn = document.getElementById("retry-btn");
  var waFallback = document.getElementById("wa-fallback");
  var confirmScreen = document.getElementById("confirm-screen");

  function buildPayload() {
    var selectedPkg = document.querySelector('input[name="paquete"]:checked');
    var addons = [];
    document.querySelectorAll('input[name="addons"]:checked').forEach(function (el) {
      addons.push(el.value);
    });
    var horarioVal = horarioSelect.value;

    return {
      timestamp: new Date().toISOString(),
      origen: "landing-omega",
      nombre: document.getElementById("nombre").value.trim(),
      identificacion: document.getElementById("identificacion").value.trim(),
      fecha_nacimiento: document.getElementById("fecha-nacimiento").value,
      sexo: (document.querySelector('input[name="sexo"]:checked') || {}).value || "",
      whatsapp: document.getElementById("whatsapp").value.trim(),
      email: document.getElementById("email").value.trim(),
      departamento: document.getElementById("departamento").value,
      paquete: selectedPkg ? selectedPkg.value : "",
      total_colones: parseInt(totalAmountEl.textContent.replace(/[^\d]/g, ""), 10) || 0,
      addons: addons,
      horario: horarioVal ? minutesToLabel(parseInt(horarioVal, 10)) : "",
      hora_limite_ayuno: horarioVal ? calcAyunoLimite(parseInt(horarioVal, 10)) : "",
      pago: (document.querySelector('input[name="pago"]:checked') || {}).value || "",
      autorizacion_planilla: !!planillaCheck.checked,
      notas: document.getElementById("notas").value.trim()
    };
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("is-loading", isLoading);
    submitLabel.textContent = isLoading ? "Enviando…" : "Confirmar mi inscripción";
  }

  function showConfirmScreen(payload) {
    document.getElementById("confirm-paquete").textContent =
      payload.paquete.charAt(0).toUpperCase() + payload.paquete.slice(1);
    document.getElementById("confirm-total").textContent = formatColones(payload.total_colones);
    document.getElementById("confirm-horario").textContent = payload.horario;
    document.getElementById("confirm-fasting").textContent =
      "No se te olvide: el " + getDayBeforeLabel() + ", tu última comida debe ser antes de las " + payload.hora_limite_ayuno + " Después, solo agua.";

    var waMsg = "Hola, ya llené el formulario de la Jornada Omega. Mi nombre es " + payload.nombre + " y elegí el paquete " + payload.paquete + ".";
    document.getElementById("confirm-wa").href = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(waMsg);

    form.style.display = "none";
    confirmScreen.classList.add("is-visible");
    document.getElementById("form-header").style.display = "none";
    confirmScreen.scrollIntoView({ behavior: "smooth", block: "start" });

    var addCalendarBtn = document.getElementById("add-calendar-btn");
    addCalendarBtn.addEventListener("click", function () {
      downloadIcs();
    });
  }

  function downloadIcs() {
    var start = EVENT_DATE_ISO.replace(/-/g, "") + "T" + EVENT_START.replace(":", "") + "00";
    var end = EVENT_DATE_ISO.replace(/-/g, "") + "T" + EVENT_END.replace(":", "") + "00";
    var ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "SUMMARY:Jornada de Salud Preventiva — LabServices",
      "DTSTART:" + start,
      "DTEND:" + end,
      "LOCATION:" + EVENT_LOCATION,
      "DESCRIPTION:Chequeo de salud preventiva LabServices en Refrigeración Omega.",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "jornada-omega.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function submitInscripcion() {
    var payload = buildPayload();
    setLoading(true);
    submitError.classList.remove("is-visible");

    fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("bad status");
        setLoading(false);
        showConfirmScreen(payload);
      })
      .catch(function () {
        setLoading(false);
        var waMsg = "Hola, quiero inscribirme a la Jornada Omega. Mi nombre es " + (payload.nombre || "") + " y elegí el paquete " + (payload.paquete || "") + ".";
        waFallback.href = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(waMsg);
        submitError.classList.add("is-visible");
        submitError.scrollIntoView({ behavior: "smooth", block: "center" });
      });
  }

  if (retryBtn) {
    retryBtn.addEventListener("click", function () {
      submitInscripcion();
    });
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validateAll()) {
        var invalid = firstInvalidField();
        if (invalid) {
          invalid.scrollIntoView({ behavior: "smooth", block: "center" });
          if (typeof invalid.focus === "function") invalid.focus();
        }
        return;
      }
      submitInscripcion();
    });
  }
})();
