(function () {
  "use strict";

  var WHATSAPP_NUMBER = "50683291379"; // +506 8329 1379

  var form = document.getElementById("citas-form");
  var confirmScreen = document.getElementById("citas-confirm");

  var nombreInput = document.getElementById("nombre");
  var identificacionInput = document.getElementById("identificacion");
  var telefonoInput = document.getElementById("telefono");
  var emailInput = document.getElementById("email");
  var fechaInput = document.getElementById("fecha");
  var horaSelect = document.getElementById("hora");
  var horaHint = document.getElementById("hora-hint");
  var direccionInput = document.getElementById("direccion");
  var direccionField = document.getElementById("direccion-field");
  var domicilioAviso = document.getElementById("domicilio-aviso");
  var submitBtn = document.getElementById("citas-submit-btn");
  var submitLabel = document.getElementById("citas-submit-label");
  var submitError = document.getElementById("citas-submit-error");

  // Día mínimo seleccionable: hoy, en hora de Costa Rica.
  (function setMinFecha() {
    var ahoraCR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Costa_Rica" }));
    var y = ahoraCR.getFullYear();
    var m = String(ahoraCR.getMonth() + 1).padStart(2, "0");
    var d = String(ahoraCR.getDate()).padStart(2, "0");
    fechaInput.min = y + "-" + m + "-" + d;
  })();

  function mostrarError(idCampo, visible) {
    var el = document.getElementById(idCampo + "-error");
    var input = document.getElementById(idCampo);
    if (el) el.classList.toggle("is-visible", !!visible);
    if (input) {
      if (visible) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  function esDomicilio() {
    return document.getElementById("sucursal-domicilio").checked;
  }

  document.querySelectorAll('input[name="sucursal"]').forEach(function (el) {
    el.addEventListener("change", function () {
      var domicilio = esDomicilio();
      domicilioAviso.classList.toggle("is-visible", domicilio);
      direccionField.classList.toggle("is-visible", domicilio);
      direccionInput.required = domicilio;
      if (!domicilio) mostrarError("direccion", false);
    });
  });

  function formatearHora(hhmm) {
    var partes = hhmm.split(":");
    var h = parseInt(partes[0], 10);
    var m = partes[1];
    var sufijo = h < 12 ? "a.m." : "p.m.";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + m + " " + sufijo;
  }

  function cargarHorarios() {
    var fecha = fechaInput.value;
    horaSelect.innerHTML = '<option value="">Cargando horarios...</option>';
    horaSelect.disabled = true;
    horaHint.textContent = "";
    mostrarError("fecha", false);

    if (!fecha) return;

    fetch("/api/disponibilidad?fecha=" + encodeURIComponent(fecha))
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok) {
          horaSelect.innerHTML = '<option value="">No disponible</option>';
          horaHint.textContent = result.data.error === "cerrado"
            ? "Ese día no atendemos (domingos cerrado). Elegí otro día."
            : "No pudimos cargar los horarios de ese día. Probá de nuevo.";
          return;
        }

        var slots = result.data.slots || [];
        if (slots.length === 0) {
          horaSelect.innerHTML = '<option value="">Sin horarios disponibles</option>';
          horaHint.textContent = "No quedan horarios libres ese día — probá con otra fecha.";
          return;
        }

        horaSelect.innerHTML = '<option value="">Elegí una hora</option>' +
          slots.map(function (s) { return '<option value="' + s + '">' + formatearHora(s) + "</option>"; }).join("");
        horaSelect.disabled = false;
      })
      .catch(function () {
        horaSelect.innerHTML = '<option value="">Error</option>';
        horaHint.textContent = "No pudimos cargar los horarios. Revisá tu conexión e intentá de nuevo.";
      });
  }

  fechaInput.addEventListener("change", cargarHorarios);

  function validarTodo() {
    var ok = true;

    if (!nombreInput.value.trim()) { mostrarError("nombre", true); ok = false; } else { mostrarError("nombre", false); }
    if (!identificacionInput.value.trim()) { mostrarError("identificacion", true); ok = false; } else { mostrarError("identificacion", false); }

    var telLimpio = telefonoInput.value.replace(/\D/g, "");
    if (telLimpio.length < 8) { mostrarError("telefono", true); ok = false; } else { mostrarError("telefono", false); }

    if (!emailInput.value.trim() || !emailInput.checkValidity()) { mostrarError("email", true); ok = false; } else { mostrarError("email", false); }

    if (!fechaInput.value) { mostrarError("fecha", true); ok = false; } else { mostrarError("fecha", false); }
    if (!horaSelect.value) { mostrarError("hora", true); ok = false; } else { mostrarError("hora", false); }

    if (esDomicilio() && !direccionInput.value.trim()) { mostrarError("direccion", true); ok = false; } else { mostrarError("direccion", false); }

    return ok;
  }

  function setEnviando(enviando) {
    submitBtn.disabled = enviando;
    submitLabel.textContent = enviando ? "Confirmando..." : "Confirmar mi cita";
  }

  function mostrarConfirmacion(payload) {
    var fechaObj = new Date(payload.fecha + "T00:00:00");
    var fechaTexto = fechaObj.toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long" });
    document.getElementById("confirm-fecha").textContent = fechaTexto;
    document.getElementById("confirm-hora").textContent = formatearHora(payload.hora);
    document.getElementById("confirm-lugar").textContent = payload.sucursal === "domicilio"
      ? "Servicio a domicilio"
      : "Sucursal Naranjo";

    var examenesRow = document.getElementById("confirm-examenes-row");
    if (payload.examenesDetalle && payload.examenesDetalle.length) {
      var subtotalTexto = window.CitasExamenes ? window.CitasExamenes.formatColones(payload.examenesTotal) : payload.examenesTotal;
      document.getElementById("confirm-examenes").textContent =
        payload.examenesDetalle.map(function (ex) { return ex.descripcion; }).join(", ") +
        " — " + subtotalTexto;
      examenesRow.style.display = "";
    } else {
      examenesRow.style.display = "none";
    }

    var waMsg = "📅 Hola, soy " + payload.nombre + ". Agendé una cita para el " + fechaTexto + " a las " + formatearHora(payload.hora) +
      (payload.sucursal === "domicilio" ? " (servicio a domicilio)" : " (sucursal Naranjo)") + ".";
    document.getElementById("confirm-wa-btn").setAttribute("href", "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(waMsg));
    document.getElementById("confirm-wa-btn").setAttribute("target", "_blank");
    document.getElementById("confirm-wa-btn").setAttribute("rel", "noopener");

    form.style.display = "none";
    confirmScreen.classList.add("is-visible");
    confirmScreen.scrollIntoView({ behavior: "smooth", block: "start" });

    if (typeof gtag === "function") {
      gtag("event", "generate_lead", { method: "citas_online" });
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    submitError.classList.remove("is-visible");

    if (!validarTodo()) {
      var primerError = form.querySelector('[aria-invalid="true"]');
      if (primerError) primerError.focus();
      return;
    }

    var examenesSeleccionados = window.CitasExamenes ? window.CitasExamenes.getSeleccionados() : [];

    var payload = {
      nombre: nombreInput.value.trim(),
      identificacion: identificacionInput.value.trim(),
      telefono: telefonoInput.value.trim(),
      email: emailInput.value.trim(),
      sucursal: esDomicilio() ? "domicilio" : "naranjo",
      direccion: esDomicilio() ? direccionInput.value.trim() : "",
      fecha: fechaInput.value,
      hora: horaSelect.value,
      examenes: examenesSeleccionados.map(function (ex) { return ex.codigo; })
    };

    // El servidor resuelve nombre/precio de cada examen por su cuenta a
    // partir del código — acá guardamos el detalle solo para mostrarlo en
    // la pantalla de confirmación, no se manda en el body de la petición.
    payload.examenesDetalle = examenesSeleccionados;
    payload.examenesTotal = window.CitasExamenes ? window.CitasExamenes.getSubtotal() : 0;

    setEnviando(true);

    fetch("/api/reservar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: payload.nombre,
        identificacion: payload.identificacion,
        telefono: payload.telefono,
        email: payload.email,
        sucursal: payload.sucursal,
        direccion: payload.direccion,
        fecha: payload.fecha,
        hora: payload.hora,
        examenes: payload.examenes
      })
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        setEnviando(false);
        if (!result.ok) {
          if (result.data.error === "horario_ocupado") {
            submitError.textContent = "Justo se ocupó ese horario. Elegí otra hora de la lista actualizada.";
            cargarHorarios();
          } else {
            submitError.textContent = "No pudimos confirmar tu cita. Intentá de nuevo o escribinos por WhatsApp.";
          }
          submitError.classList.add("is-visible");
          return;
        }
        mostrarConfirmacion(payload);
      })
      .catch(function () {
        setEnviando(false);
        submitError.textContent = "No pudimos confirmar tu cita. Intentá de nuevo o escribinos por WhatsApp.";
        submitError.classList.add("is-visible");
      });
  });
})();
