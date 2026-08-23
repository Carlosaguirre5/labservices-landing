// GET /api/disponibilidad?fecha=YYYY-MM-DD
// Devuelve los horarios libres ese día, consultando el calendario real.

const { listarEventosDelDia } = require("./_lib/google");
const { horarioDelDia, generarGrillaDelDia, filtrarPasados, slotOcupado } = require("./_lib/horarios");

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "metodo_no_permitido" });
    return;
  }

  const fecha = req.query.fecha;
  if (!fecha || !FECHA_RE.test(fecha)) {
    res.status(400).json({ error: "fecha_invalida" });
    return;
  }

  if (!horarioDelDia(fecha)) {
    res.status(200).json({ fecha: fecha, error: "cerrado", slots: [] });
    return;
  }

  try {
    const grilla = filtrarPasados(fecha, generarGrillaDelDia(fecha));
    const eventos = await listarEventosDelDia(fecha);
    const libres = grilla.filter(function (hora) { return !slotOcupado(fecha, hora, eventos); });
    res.status(200).json({ fecha: fecha, slots: libres });
  } catch (err) {
    console.error("disponibilidad:", err.message);
    res.status(502).json({ error: "error_calendario" });
  }
};
