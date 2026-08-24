(function () {
  "use strict";

  // Buscador de exámenes embebido en /citas/ — misma lógica de búsqueda que
  // /precios/cotizador.js, recortada a lo que este formulario necesita
  // (sin WhatsApp/copiar: acá el destino final es el payload de /api/reservar).

  var DATA_URL = "/data/examenes.json";
  var MAX_RESULTADOS = 40;
  var LARGO_MINIMO_PARA_SINONIMO = 3;

  var CODIGOS_SUGERIDOS = ["1122", "2739", "30", "1136", "905", "1160"];

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

  if (!inputBuscador) return; // esta página no tiene el bloque de exámenes

  function normalizar(texto) {
    return texto
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  function formatColones(n) {
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
      state.seleccionados.push(examen);
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
      vacio.textContent = "No encontramos exámenes con ese nombre. No hay problema, lo coordinamos el día de tu cita.";
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
  }

  function render() {
    renderResultados();
    renderSeleccion();
  }

  inputBuscador.addEventListener("input", function () {
    state.query = inputBuscador.value;
    renderResultados();
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
      error.textContent = "No pudimos cargar el listado de exámenes. No hay problema, lo coordinamos el día de tu cita.";
      resultadosLista.appendChild(error);
    });

  window.CitasExamenes = {
    getSeleccionados: function () { return state.seleccionados.slice(); },
    getSubtotal: function () {
      return state.seleccionados.reduce(function (suma, ex) { return suma + ex.precio; }, 0);
    },
    formatColones: formatColones
  };
})();
