(function () {
  "use strict";

  /* ========================================================================
     Constantes editables
     ======================================================================== */

  var WHATSAPP_NUMBER = "50683291379"; // +506 8329 1379

  // Notificación a LabServices cuando alguien se inscribe (mismo servicio que
  // usa el formulario de contacto del sitio principal).
  var WEB3FORMS_ACCESS_KEY = "b64c5ee9-4a10-4525-84c1-1d5200dfe057";

  // Confirmación automática por correo a quien se inscribe, con enlaces para
  // agregar la cita a su calendario. Cuenta gratuita de EmailJS.
  var EMAILJS_PUBLIC_KEY = "rVrDyiGVherZWFCdj";
  var EMAILJS_SERVICE_ID = "service_mrpdgir";
  var EMAILJS_TEMPLATE_ID = "template_ctkpofo";

  var EVENT_DATE_ISO = "2026-08-28"; // ajustar si cambia el año/fecha del evento; el texto "viernes 28" en el HTML también debe actualizarse a mano
  var EVENT_START = "07:00";
  var EVENT_END = "11:00";
  var EVENT_LOCATION = "Planta Omega, Santa Ana";
  var EVENT_UTC_OFFSET = "-06:00"; // Costa Rica, sin horario de verano

  var SLOT_START_MIN = 7 * 60; // 7:00 a.m.
  var SLOT_END_MIN = 10 * 60 + 50; // último inicio de franja: 10:50 a.m. (dura 10 min, termina 11:00)
  var SLOT_STEP_MIN = 10;
  var FASTING_HOURS = 12;

  var DESCUENTO_ADDONS = 0.20; // solo informativo, para el rótulo — los precios reales van fijos abajo

  var ADDONS = {
    hba1c: {
      nombre: "Hemoglobina glicosilada (HbA1c)",
      desc: "Muestra cómo estuvo tu azúcar en los últimos 3 meses, no solo hoy.",
      precio_lista: 17000,
      precio: 13600
    },
    acido_urico: {
      nombre: "Ácido úrico",
      desc: "Se relaciona con dolor e inflamación en pies, rodillas y dedos.",
      precio_lista: 7000,
      precio: 5600
    },
    b12: {
      nombre: "Vitamina B12",
      desc: "Se relaciona con cansancio, hormigueo y falta de concentración.",
      precio_lista: 21000,
      precio: 16800
    },
    vitamina_d: {
      nombre: "Vitamina D",
      desc: "Se relaciona con la salud de los huesos y las defensas.",
      precio_lista: 35000,
      precio: 28000
    }
  };

  // TODO: confirmar con RR.HH. de Omega.
  // null = sin tope, no se muestra ningún aviso.
  var TOPE_DEDUCCION_QUINCENAL = null; // ej. 60000

  if (typeof emailjs !== "undefined") {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }

  /* ========================================================================
     Utilidades
     ======================================================================== */

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function minutesTo24h(mins) {
    var h = Math.floor(mins / 60) % 24;
    var m = mins % 60;
    return pad2(h) + ":" + pad2(m);
  }

  // Convierte minutos-del-día en hora local de Costa Rica (evento) a un
  // timestamp UTC "YYYYMMDDTHHMMSSZ", como lo requiere Google Calendar.
  function buildUtcStamp(dateIso, localMinutes) {
    var offsetHours = 6; // CR es UTC-6
    var utcMinutes = localMinutes + offsetHours * 60;
    var dayOffset = 0;
    if (utcMinutes >= 24 * 60) {
      utcMinutes -= 24 * 60;
      dayOffset = 1;
    }
    var d = new Date(dateIso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + dayOffset);
    var stamp =
      d.getUTCFullYear() +
      pad2(d.getUTCMonth() + 1) +
      pad2(d.getUTCDate()) +
      "T" +
      pad2(Math.floor(utcMinutes / 60)) +
      pad2(utcMinutes % 60) +
      "00Z";
    return stamp;
  }

  function buildGoogleCalLink(startMin, endMin, title, details, location) {
    var params = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: buildUtcStamp(EVENT_DATE_ISO, startMin) + "/" + buildUtcStamp(EVENT_DATE_ISO, endMin),
      details: details,
      location: location
    });
    return "https://calendar.google.com/calendar/render?" + params.toString();
  }

  function buildOutlookCalLink(startMin, endMin, title, details, location) {
    var params = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      startdt: EVENT_DATE_ISO + "T" + minutesTo24h(startMin) + ":00" + EVENT_UTC_OFFSET,
      enddt: EVENT_DATE_ISO + "T" + minutesTo24h(endMin) + ":00" + EVENT_UTC_OFFSET,
      subject: title,
      body: details,
      location: location
    });
    return "https://outlook.live.com/calendar/0/deeplink/compose?" + params.toString();
  }

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
    Object.keys(ADDONS).forEach(function (id) {
      var addon = ADDONS[id];
      var isPending = !addon.precio;
      var row = document.createElement("div");
      row.className = "addon-row" + (isPending ? " is-disabled" : "");

      var priceHtml = isPending
        ? '<span class="addon-price-pending">Próximamente</span>'
        : '<span class="addon-price-list">' + formatColones(addon.precio_lista) + '</span>' +
          '<span class="addon-price-omega">' + formatColones(addon.precio) + '</span>';

      row.innerHTML =
        '<input type="checkbox" id="addon-' + id + '" name="addons" value="' + id + '"' + (isPending ? ' disabled' : '') + '>' +
        '<label for="addon-' + id + '">' +
          '<span class="addon-name">' + addon.nombre + '</span>' +
          '<span class="addon-desc">' + addon.desc + '</span>' +
        '</label>' +
        '<span class="addon-price-block">' + priceHtml + '</span>';
      addonsList.appendChild(row);
    });
  }

  var totalAmountEl = document.getElementById("total-amount");
  var totalTractsEl = document.getElementById("total-tracts");
  var addonsSavingsEl = document.getElementById("addons-savings");
  var topeAvisoEl = document.getElementById("tope-aviso");
  var topeAvisoTextEl = document.getElementById("tope-aviso-text");

  // Suma de precio_lista - precio de los add-ons marcados.
  function calcAddonsTotals() {
    var total = 0;
    var savings = 0;
    document.querySelectorAll('input[name="addons"]:checked').forEach(function (el) {
      var addon = ADDONS[el.value];
      if (!addon) return;
      total += addon.precio;
      savings += addon.precio_lista - addon.precio;
    });
    return { total: total, savings: savings };
  }

  // El primer tracto se lleva el colón extra cuando el total es impar.
  function calcTractos(total) {
    return { tracto1: Math.ceil(total / 2), tracto2: Math.floor(total / 2) };
  }

  function updateTopeAviso(tracto1) {
    var isPlanilla = document.getElementById("pago-planilla").checked;
    if (TOPE_DEDUCCION_QUINCENAL === null || !isPlanilla || tracto1 <= TOPE_DEDUCCION_QUINCENAL) {
      topeAvisoEl.classList.remove("is-visible");
      return;
    }
    var diferencia = tracto1 - TOPE_DEDUCCION_QUINCENAL;
    topeAvisoTextEl.innerHTML =
      "<strong>Tu tracto quincenal es de " + formatColones(tracto1) + " y el máximo que Omega deduce es " + formatColones(TOPE_DEDUCCION_QUINCENAL) + ".</strong> " +
      "Podés dejar " + formatColones(TOPE_DEDUCCION_QUINCENAL) + " por planilla y cubrir la diferencia de " + formatColones(diferencia) + " por SINPE o efectivo el día de la jornada. Al confirmar tu inscripción te escribimos para coordinarlo.";
    topeAvisoEl.classList.add("is-visible");
  }

  function updateTotal() {
    var selectedPkg = document.querySelector('input[name="paquete"]:checked');
    var base = selectedPkg ? parseInt(selectedPkg.getAttribute("data-price"), 10) : 0;

    var addonsTotals = calcAddonsTotals();
    var total = base + addonsTotals.total;
    var tractos = calcTractos(total);

    totalAmountEl.textContent = formatColones(total);
    totalTractsEl.textContent = tractos.tracto1 === tractos.tracto2
      ? "2 tractos de " + formatColones(tractos.tracto1)
      : "Tracto 1: " + formatColones(tractos.tracto1) + " · Tracto 2: " + formatColones(tractos.tracto2);

    if (addonsTotals.savings > 0) {
      addonsSavingsEl.textContent = "✓ Estás ahorrando " + formatColones(addonsTotals.savings) + " con el precio Omega";
      addonsSavingsEl.classList.add("is-visible");
    } else {
      addonsSavingsEl.classList.remove("is-visible");
    }

    updateTopeAviso(tractos.tracto1);
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
      updateTotal();
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

  ["nombre", "identificacion", "fecha-nacimiento", "whatsapp", "email", "horario"].forEach(function (id) {
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
    ["nombre", "identificacion", "fecha-nacimiento", "whatsapp", "email", "horario"].forEach(function (id) {
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
    var horarioMin = horarioSelect.value ? parseInt(horarioSelect.value, 10) : null;

    var base = selectedPkg ? parseInt(selectedPkg.getAttribute("data-price"), 10) : 0;
    var addonsTotals = calcAddonsTotals();
    var total = base + addonsTotals.total;
    var tractos = calcTractos(total);
    var isPlanilla = document.getElementById("pago-planilla").checked;
    var excedeTope = TOPE_DEDUCCION_QUINCENAL !== null && isPlanilla && tractos.tracto1 > TOPE_DEDUCCION_QUINCENAL;
    var diferencia = excedeTope ? tractos.tracto1 - TOPE_DEDUCCION_QUINCENAL : 0;

    return {
      timestamp: new Date().toISOString(),
      origen: "landing-omega",
      nombre: document.getElementById("nombre").value.trim(),
      identificacion: document.getElementById("identificacion").value.trim(),
      fecha_nacimiento: document.getElementById("fecha-nacimiento").value,
      sexo: (document.querySelector('input[name="sexo"]:checked') || {}).value || "",
      whatsapp: document.getElementById("whatsapp").value.trim(),
      email: document.getElementById("email").value.trim(),
      paquete: selectedPkg ? selectedPkg.value : "",
      addons: addons,
      addons_ahorro_colones: addonsTotals.savings,
      total_colones: total,
      tracto_1: tractos.tracto1,
      tracto_2: tractos.tracto2,
      horario_min: horarioMin,
      horario: horarioMin !== null ? minutesToLabel(horarioMin) : "",
      hora_limite_ayuno: horarioMin !== null ? calcAyunoLimite(horarioMin) : "",
      pago: (document.querySelector('input[name="pago"]:checked') || {}).value || "",
      autorizacion_planilla: !!planillaCheck.checked,
      excede_tope_deduccion: excedeTope,
      diferencia_colones: diferencia,
      notas: document.getElementById("notas").value.trim()
    };
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("is-loading", isLoading);
    submitLabel.textContent = isLoading ? "Enviando…" : "Confirmar mi inscripción";
  }

  function eventTitleAndDetails(payload) {
    var title = "Jornada de Salud Preventiva — LabServices";
    var details =
      "Chequeo de salud preventiva LabServices en Refrigeración Omega. Paquete: " +
      payload.paquete + ". Recordá llegar en ayuno de 12 horas.";
    return { title: title, details: details };
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
      downloadIcs(payload);
    });
  }

  function downloadIcs(payload) {
    var startMin = payload.horario_min !== null ? payload.horario_min : SLOT_START_MIN;
    var endMin = startMin + SLOT_STEP_MIN;
    var start = buildUtcStamp(EVENT_DATE_ISO, startMin);
    var end = buildUtcStamp(EVENT_DATE_ISO, endMin);
    var meta = eventTitleAndDetails(payload);
    var ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "SUMMARY:" + meta.title,
      "DTSTART:" + start,
      "DTEND:" + end,
      "LOCATION:" + EVENT_LOCATION,
      "DESCRIPTION:" + meta.details,
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

  // Notifica a LabServices por correo (vía Web3Forms) que alguien se inscribió.
  function sendStaffNotification(payload) {
    var fd = new FormData();
    fd.append("access_key", WEB3FORMS_ACCESS_KEY);
    fd.append("subject", "Nueva inscripción — Jornada Omega");
    fd.append("from_name", "Formulario Jornada Omega");
    fd.append("nombre", payload.nombre);
    fd.append("identificacion", payload.identificacion);
    fd.append("fecha_nacimiento", payload.fecha_nacimiento);
    fd.append("sexo", payload.sexo);
    fd.append("whatsapp", payload.whatsapp);
    fd.append("email", payload.email);
    fd.append("paquete", payload.paquete);
    fd.append("addons", payload.addons.join(", ") || "ninguno");
    fd.append("addons_ahorro_colones", String(payload.addons_ahorro_colones));
    fd.append("total_colones", String(payload.total_colones));
    fd.append("tracto_1", String(payload.tracto_1));
    fd.append("tracto_2", String(payload.tracto_2));
    fd.append("horario", payload.horario);
    fd.append("hora_limite_ayuno", payload.hora_limite_ayuno);
    fd.append("pago", payload.pago);
    fd.append("autorizacion_planilla", payload.autorizacion_planilla ? "sí" : "no");
    fd.append("excede_tope_deduccion", payload.excede_tope_deduccion ? "sí (diferencia: " + formatColones(payload.diferencia_colones) + ")" : "no");
    fd.append("notas", payload.notas || "(sin notas)");
    return fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: fd
    });
  }

  // Envía la confirmación con enlaces de calendario a quien se inscribió.
  function sendAttendeeConfirmation(payload) {
    var startMin = payload.horario_min;
    var endMin = startMin + SLOT_STEP_MIN;
    var meta = eventTitleAndDetails(payload);
    var googleLink = buildGoogleCalLink(startMin, endMin, meta.title, meta.details, EVENT_LOCATION);
    var outlookLink = buildOutlookCalLink(startMin, endMin, meta.title, meta.details, EVENT_LOCATION);

    return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: payload.email,
      to_name: payload.nombre,
      paquete: payload.paquete.charAt(0).toUpperCase() + payload.paquete.slice(1),
      total: formatColones(payload.total_colones),
      horario: payload.horario,
      hora_limite: payload.hora_limite_ayuno,
      google_cal_link: googleLink,
      outlook_cal_link: outlookLink
    });
  }

  function submitInscripcion() {
    var payload = buildPayload();
    setLoading(true);
    submitError.classList.remove("is-visible");

    Promise.allSettled([sendStaffNotification(payload), sendAttendeeConfirmation(payload)])
      .then(function (results) {
        setLoading(false);
        var attendeeOk = results[1].status === "fulfilled";
        if (attendeeOk) {
          showConfirmScreen(payload);
        } else {
          var waMsg = "Hola, quiero inscribirme a la Jornada Omega. Mi nombre es " + (payload.nombre || "") + " y elegí el paquete " + (payload.paquete || "") + ".";
          waFallback.href = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(waMsg);
          submitError.classList.add("is-visible");
          submitError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
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
