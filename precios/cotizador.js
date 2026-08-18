(function () {
  "use strict";

  var WHATSAPP_NUMBER = "50683291379"; // +506 8329 1379 — mismo número que el resto del sitio
  var DATA_URL = "/data/examenes.json";
  var MAX_RESULTADOS = 40; // tope de filas renderizadas por búsqueda, para no saturar el DOM en móvil
  var LARGO_MINIMO_PARA_SINONIMO = 3; // evita que 1-2 letras disparen sinónimos de más

  // Exámenes sueltos (no paquetes) que aparecen como "más buscados" en la
  // página principal — se muestran como sugerencia cuando el buscador está vacío.
  var CODIGOS_SUGERIDOS = ["1122", "2739", "30", "1136", "905", "1160"];

  // Términos coloquiales → palabra(s) que sí aparecen en las descripciones
  // técnicas del catálogo. La búsqueda ya hace coincidencia de substring
  // directa; esto solo cubre los casos donde el término común no aparece
  // literalmente en ninguna descripción.
  var SINONIMOS = {
    "azucar": ["glucosa"],
    "diabetes": ["glucosa", "glicosilada"],
    "globulos rojos": ["hemograma"],
    "globulos blancos": ["hemograma"],
    "plaquetas": ["hemograma"],
    "anemia": ["hemograma", "hierro serico"],
    "tiroides": ["tiroideo"],
    "higado": ["hepatico"],
    "rinon": ["renal"],
    "rinones": ["renal"],
    "excremento": ["heces"],
    "sida": ["hiv"],
    "vih": ["hiv"],
    "clamidia": ["chlamydia"],
    "mononucleosis": ["monotest"],
    "gota": ["urico"],
    "prostata": ["prostatico"],
    "hormonas femeninas": ["hormonal femenino"],
    "antidoping": ["drogas", "cocaina", "marihuana"],
    "droga": ["drogas", "cocaina", "marihuana"],
    "vph": ["papiloma"],
    "gonorrea": ["neisseria gonorrhoeae"],
    "tricomonas": ["trichomonas"],
    "tipo de sangre": ["grupo sanguineo"],
    "chequeo infantil": ["nino sano"],
    "control del nino": ["nino sano"],
    "corazon": ["troponina", "ck-mb", "bnp"],
    "infarto": ["troponina"],
    "tuberculosis": ["quantiferon"],
    "intolerancia al gluten": ["celiaco", "gliadina"],
    "chequeo general": ["completo"],
    "chequeo de salud": ["completo"],
    "infeccion urinaria": ["urocultivo"],
    "cultivo de orina": ["urocultivo"],
    "coagulacion": ["protrombina", "tromboplastina"],
    "alergias": ["alergeno", "alergo"]
  };

  var state = {
    examenes: [],
    query: "",
    seleccionados: []
  };

  var inputBuscador = document.getElementById("buscador-examen");
  var resultadosLista = document.getElementById("resultados-lista");
  var resultadoCountEl = document.getElementById("buscador-resultado-count");
  var seleccionLista = document.getElementById("seleccion-lista");
  var seleccionVacioEl = document.getElementById("seleccion-vacio");
  var resumenCantidadEl = document.getElementById("resumen-cantidad");
  var resumenSubtotalEl = document.getElementById("resumen-subtotal");
  var btnWhatsapp = document.getElementById("btn-whatsapp");
  var btnCopiar = document.getElementById("btn-copiar");
  var copiarFeedbackEl = document.getElementById("copiar-feedback");

  function normalizar(texto) {
    return texto
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  function formatColones(n) {
    // A mano (punto como separador de miles), mismo patrón que el resto del
    // sitio — toLocaleString("es-CR") varía según navegador.
    var withDots = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return "₡" + withDots;
  }

  function terminosPorSinonimo(queryNorm) {
    if (queryNorm.length < LARGO_MINIMO_PARA_SINONIMO) return [];
    var extra = [];
    Object.keys(SINONIMOS).forEach(function (clave) {
      if (queryNorm.indexOf(clave) !== -1 || clave.indexOf(queryNorm) !== -1) {
        extra = extra.concat(SINONIMOS[clave]);
      }
    });
    return extra;
  }

  // null = buscador vacío (mostrar sugeridos en vez de resultados)
  function filtrarExamenes(queryNorm) {
    if (!queryNorm) return null;
    var extras = terminosPorSinonimo(queryNorm);
    return state.examenes.filter(function (ex) {
      if (ex.descripcionNormalizada.indexOf(queryNorm) !== -1) return true;
      if (ex.codigo.toLowerCase().indexOf(queryNorm) !== -1) return true;
      for (var i = 0; i < extras.length; i++) {
        if (ex.descripcionNormalizada.indexOf(extras[i]) !== -1) return true;
      }
      return false;
    });
  }

  function estaSeleccionado(codigo) {
    return state.seleccionados.some(function (ex) { return ex.codigo === codigo; });
  }

  function toggleExamen(codigo) {
    if (estaSeleccionado(codigo)) {
      state.seleccionados = state.seleccionados.filter(function (ex) { return ex.codigo !== codigo; });
    } else {
      var examen = state.examenes.filter(function (ex) { return ex.codigo === codigo; })[0];
      if (!examen) return;
      var esPrimerAgregado = state.seleccionados.length === 0;
      state.seleccionados.push(examen);
      if (esPrimerAgregado && typeof gtag === "function") {
        gtag("event", "add_to_cart", {
          currency: "CRC",
          value: examen.precio,
          items: [{ item_id: examen.codigo, item_name: examen.descripcion, price: examen.precio }]
        });
      }
    }
    render();
  }

  function crearItemResultado(ex) {
    var li = document.createElement("li");
    li.className = "resultado-item";

    var info = document.createElement("div");
    info.className = "resultado-info";
    var nombre = document.createElement("span");
    nombre.className = "resultado-nombre";
    nombre.textContent = ex.descripcion;
    var precio = document.createElement("span");
    precio.className = "resultado-precio";
    precio.textContent = formatColones(ex.precio);
    info.appendChild(nombre);
    info.appendChild(precio);

    var yaEsta = estaSeleccionado(ex.codigo);
    var boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn-toggle" + (yaEsta ? " is-agregado" : "");
    boton.textContent = yaEsta ? "Agregado ✓" : "Agregar";
    boton.setAttribute("aria-label", (yaEsta ? "Quitar " : "Agregar ") + ex.descripcion + " de tu lista");
    boton.addEventListener("click", function () { toggleExamen(ex.codigo); });

    li.appendChild(info);
    li.appendChild(boton);
    return li;
  }

  function renderResultados() {
    var queryNorm = normalizar(state.query);
    var lista = filtrarExamenes(queryNorm);
    var scrollPrevio = resultadosLista.scrollTop;
    resultadosLista.innerHTML = "";

    if (lista === null) {
      var sugeridos = CODIGOS_SUGERIDOS
        .map(function (cod) { return state.examenes.filter(function (ex) { return ex.codigo === cod; })[0]; })
        .filter(function (ex) { return !!ex; });

      if (sugeridos.length) {
        var etiqueta = document.createElement("li");
        etiqueta.className = "resultados-sugerencia-label";
        etiqueta.textContent = "Exámenes más buscados:";
        resultadosLista.appendChild(etiqueta);
        sugeridos.forEach(function (ex) { resultadosLista.appendChild(crearItemResultado(ex)); });
      }
      resultadoCountEl.textContent = "";
      return;
    }

    if (lista.length === 0) {
      var vacio = document.createElement("li");
      vacio.className = "resultados-vacio";
      vacio.textContent = "No encontramos exámenes con ese nombre. Probá con otro término o escribinos por WhatsApp.";
      resultadosLista.appendChild(vacio);
      resultadoCountEl.textContent = "0 resultados";
      return;
    }

    lista.slice(0, MAX_RESULTADOS).forEach(function (ex) {
      resultadosLista.appendChild(crearItemResultado(ex));
    });
    resultadosLista.scrollTop = scrollPrevio;

    var texto = lista.length === 1 ? "1 resultado" : lista.length + " resultados";
    if (lista.length > MAX_RESULTADOS) {
      texto += " — mostrando los primeros " + MAX_RESULTADOS + ", seguí escribiendo para afinar";
    }
    resultadoCountEl.textContent = texto;
  }

  function crearItemSeleccion(ex) {
    var li = document.createElement("li");
    li.className = "seleccion-item";

    var info = document.createElement("div");
    info.className = "seleccion-info";
    var nombre = document.createElement("span");
    nombre.className = "seleccion-nombre";
    nombre.textContent = ex.descripcion;
    var precio = document.createElement("span");
    precio.className = "seleccion-precio";
    precio.textContent = formatColones(ex.precio);
    info.appendChild(nombre);
    info.appendChild(precio);

    var quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "btn-quitar";
    quitar.setAttribute("aria-label", "Quitar " + ex.descripcion + " de tu lista");
    quitar.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    quitar.addEventListener("click", function () { toggleExamen(ex.codigo); });

    li.appendChild(info);
    li.appendChild(quitar);
    return li;
  }

  function renderSeleccion() {
    seleccionLista.innerHTML = "";
    var hay = state.seleccionados.length > 0;
    seleccionVacioEl.style.display = hay ? "none" : "";

    state.seleccionados.forEach(function (ex) {
      seleccionLista.appendChild(crearItemSeleccion(ex));
    });

    var subtotal = state.seleccionados.reduce(function (suma, ex) { return suma + ex.precio; }, 0);
    resumenCantidadEl.textContent = state.seleccionados.length === 1
      ? "1 examen"
      : state.seleccionados.length + " exámenes";
    resumenSubtotalEl.textContent = formatColones(subtotal);

    btnWhatsapp.disabled = !hay;
    btnCopiar.disabled = !hay;
    if (!hay) copiarFeedbackEl.textContent = "";
  }

  function render() {
    renderResultados();
    renderSeleccion();
  }

  function construirTexto() {
    var lineas = state.seleccionados.map(function (ex) {
      return "• " + ex.descripcion + " — " + formatColones(ex.precio);
    });
    var subtotal = state.seleccionados.reduce(function (suma, ex) { return suma + ex.precio; }, 0);
    var cantidad = state.seleccionados.length;
    return "Hola, quiero cotizar estos exámenes:\n\n" +
      lineas.join("\n") +
      "\n\nTotal: " + formatColones(subtotal) + " (" + cantidad + (cantidad === 1 ? " examen" : " exámenes") + ")\n\n" +
      "¿Me ayudan a coordinar la toma de muestra?";
  }

  function copiarConExecCommand(texto) {
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");
      textarea.value = texto;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        var ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (ok) resolve(); else reject(new Error("execCommand copy falló"));
      } catch (err) {
        document.body.removeChild(textarea);
        reject(err);
      }
    });
  }

  function copiarAlPortapapeles(texto) {
    // El Clipboard API puede existir pero rechazar (permisos, navegadores
    // in-app de Instagram/Facebook muy comunes en el público móvil del
    // sitio) — en ese caso caemos al método execCommand en vez de fallar.
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto).catch(function () {
        return copiarConExecCommand(texto);
      });
    }
    return copiarConExecCommand(texto);
  }

  inputBuscador.addEventListener("input", function () {
    state.query = inputBuscador.value;
    renderResultados();
  });

  btnWhatsapp.addEventListener("click", function () {
    if (!state.seleccionados.length) return;
    var subtotal = state.seleccionados.reduce(function (suma, ex) { return suma + ex.precio; }, 0);
    if (typeof gtag === "function") {
      gtag("event", "generate_lead", {
        currency: "CRC",
        value: subtotal,
        items: state.seleccionados.map(function (ex) {
          return { item_id: ex.codigo, item_name: ex.descripcion, price: ex.precio };
        })
      });
    }
    var url = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(construirTexto());
    window.open(url, "_blank", "noopener");
  });

  btnCopiar.addEventListener("click", function () {
    if (!state.seleccionados.length) return;
    copiarAlPortapapeles(construirTexto())
      .then(function () {
        copiarFeedbackEl.textContent = "¡Lista copiada!";
        setTimeout(function () { copiarFeedbackEl.textContent = ""; }, 3000);
      })
      .catch(function () {
        copiarFeedbackEl.textContent = "No pudimos copiar. Seleccioná el texto manualmente.";
      });
  });

  fetch(DATA_URL)
    .then(function (res) { return res.json(); })
    .then(function (data) {
      state.examenes = data;
      render();
    })
    .catch(function () {
      var error = document.createElement("li");
      error.className = "resultados-vacio";
      error.textContent = "No pudimos cargar el listado de precios. Escribinos por WhatsApp para cotizar.";
      resultadosLista.appendChild(error);
    });
})();
