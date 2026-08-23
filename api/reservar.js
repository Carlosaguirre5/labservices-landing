// POST /api/reservar
// Body JSON: { nombre, identificacion, telefono, email, sucursal, direccion, fecha, hora }
// Revalida que el horario siga libre (por si dos personas reservan a la vez),
// crea el evento en Google Calendar, y manda el correo de confirmación.

const { listarEventosDelDia, crearEvento } = require("./_lib/google");
const { horarioDelDia, generarGrillaDelDia, filtrarPasados, slotOcupado, DURACION_CITA_MINUTOS } = require("./_lib/horarios");
const { enviarCorreo } = require("./_lib/emailjs");

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^\d{2}:\d{2}$/;

function leerBody(req) {
  // Vercel ya parsea JSON automáticamente si Content-Type es application/json,
  // pero por si acaso llega como string lo parseamos también.
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch (e) {
    return {};
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "metodo_no_permitido" });
    return;
  }

  const body = leerBody(req);
  const nombre = (body.nombre || "").trim();
  const identificacion = (body.identificacion || "").trim();
  const telefono = (body.telefono || "").trim();
  const email = (body.email || "").trim();
  const sucursal = body.sucursal === "domicilio" ? "domicilio" : "naranjo";
  const direccion = (body.direccion || "").trim();
  const fecha = body.fecha;
  const hora = body.hora;

  if (!nombre || !identificacion || !telefono || !email || !fecha || !hora) {
    res.status(400).json({ error: "datos_incompletos" });
    return;
  }
  if (!FECHA_RE.test(fecha) || !HORA_RE.test(hora)) {
    res.status(400).json({ error: "fecha_u_hora_invalida" });
    return;
  }
  if (sucursal === "domicilio" && !direccion) {
    res.status(400).json({ error: "falta_direccion" });
    return;
  }
  if (!horarioDelDia(fecha)) {
    res.status(400).json({ error: "dia_cerrado" });
    return;
  }
  if (filtrarPasados(fecha, generarGrillaDelDia(fecha)).indexOf(hora) === -1) {
    res.status(400).json({ error: "hora_fuera_de_horario" });
    return;
  }

  let eventos;
  try {
    eventos = await listarEventosDelDia(fecha);
  } catch (err) {
    console.error("reservar/listar:", err.message);
    res.status(502).json({ error: "error_calendario" });
    return;
  }

  if (slotOcupado(fecha, hora, eventos)) {
    res.status(409).json({ error: "horario_ocupado" });
    return;
  }

  const [h, m] = hora.split(":").map(Number);
  let finM = h * 60 + m + DURACION_CITA_MINUTOS;
  const horaFin = String(Math.floor(finM / 60)).padStart(2, "0") + ":" + String(finM % 60).padStart(2, "0");

  const lugarTexto = sucursal === "domicilio" ? "Servicio a domicilio — " + direccion : "Sucursal Naranjo";

  const eventoBody = {
    summary: "Cita LabServices — " + nombre,
    description: [
      "Identificación: " + identificacion,
      "Teléfono: " + telefono,
      "Correo: " + email,
      "Lugar: " + lugarTexto
    ].join("\n"),
    start: { dateTime: fecha + "T" + hora + ":00", timeZone: "America/Costa_Rica" },
    end: { dateTime: fecha + "T" + horaFin + ":00", timeZone: "America/Costa_Rica" },
    extendedProperties: {
      private: {
        origen: "citas-web",
        nombre: nombre,
        identificacion: identificacion,
        telefono: telefono,
        email: email,
        sucursal: sucursal,
        direccion: direccion,
        recordatorioEnviado: "false"
      }
    }
  };

  let eventoCreado;
  try {
    eventoCreado = await crearEvento(eventoBody);
  } catch (err) {
    console.error("reservar/crear:", err.message);
    res.status(502).json({ error: "error_calendario" });
    return;
  }

  try {
    await enviarCorreo(process.env.EMAILJS_TEMPLATE_CONFIRMACION, {
      to_email: email,
      to_name: nombre,
      fecha: fecha,
      hora: hora,
      lugar: lugarTexto
    });
  } catch (err) {
    // El evento ya quedó agendado en el calendario — no le devolvemos error
    // al paciente por un fallo de correo, pero sí lo dejamos en el log.
    console.error("reservar/correo:", err.message);
  }

  res.status(200).json({ ok: true, eventId: eventoCreado.id });
};
