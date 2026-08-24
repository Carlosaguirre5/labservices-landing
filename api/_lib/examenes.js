// Resuelve códigos de examen contra data/examenes.json, para no confiar en
// el nombre/precio que mande el navegador al armar la descripción del
// evento de calendario.

const fs = require("fs");
const path = require("path");

let cache = null;

function cargarCatalogo() {
  if (!cache) {
    const raw = fs.readFileSync(path.join(__dirname, "..", "..", "data", "examenes.json"), "utf8");
    cache = JSON.parse(raw);
  }
  return cache;
}

function resolverExamenes(codigos) {
  if (!Array.isArray(codigos) || codigos.length === 0) return [];
  const catalogo = cargarCatalogo();
  const porCodigo = {};
  catalogo.forEach(function (ex) { porCodigo[ex.codigo] = ex; });

  const resueltos = [];
  codigos.forEach(function (codigo) {
    const ex = porCodigo[String(codigo)];
    if (ex) resueltos.push({ codigo: ex.codigo, descripcion: ex.descripcion, precio: ex.precio });
  });
  return resueltos;
}

module.exports = { resolverExamenes };
