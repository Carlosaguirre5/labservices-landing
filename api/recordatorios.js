// Se ejecuta sola todos los días (ver vercel.json → crons) a las 8:00 am
// hora de Costa Rica. Busca las citas agendadas por esta página para el
// día siguiente y les manda un correo recordatorio.

const { listarEventosDelDia, actualizarEvento } = require("./_lib/google");
const { enviarCorreo } = require("./_lib/emailjs");

function fechaManana() {
  const ahoraCR = new Date(Date.now() - 6 * 60 * 60 * 1000);
  ahoraCR.setUTCDate(ahoraCR.getUTCDate() + 1);
  return ahoraCR.getUTCFullYear() + "-" +
    String(ahoraCR.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(ahoraCR.getUTCDate()).padStart(2, "0");
}

module.exports = async (req, res) => {
  // Si configurás la variable de entorno CRON_SECRET en Vercel, Vercel la
  // manda automáticamente como "Authorization: Bearer <CRON_SECRET>" en
  // cada invocación programada — así nadie más puede disparar el
  // recordatorio pegándole a esta URL directamente.
  const secretoEsperado = process.env.CRON_SECRET;
  if (secretoEsperado && req.headers["authorization"] !== "Bearer " + secretoEsperado) {
    res.status(401).json({ error: "no_autorizado" });
    return;
  }

  const fecha = fechaManana();
  let eventos;
  try {
    eventos = await listarEventosDelDia(fecha);
  } catch (err) {
    console.error("recordatorios/listar:", err.message);
    res.status(502).json({ error: "error_calendario" });
    return;
  }

  const propias = eventos.filter(function (ev) {
    const props = ev.extendedProperties && ev.extendedProperties.private;
    return props && props.origen === "citas-web" && props.recordatorioEnviado !== "true";
  });

  let enviados = 0;
  const errores = [];

  for (const ev of propias) {
    const props = ev.extendedProperties.private;
    const hora = new Date(ev.start.dateTime).toLocaleTimeString("es-CR", {
      hour: "2-digit", minute: "2-digit", timeZone: "America/Costa_Rica"
    });
    try {
      await enviarCorreo(process.env.EMAILJS_TEMPLATE_RECORDATORIO, {
        to_email: props.email,
        to_name: props.nombre,
        fecha: fecha,
        hora: hora,
        lugar: props.sucursal === "domicilio" ? "Servicio a domicilio — " + props.direccion : "Sucursal Naranjo"
      });
      await actualizarEvento(ev.id, {
        extendedProperties: { private: Object.assign({}, props, { recordatorioEnviado: "true" }) }
      });
      enviados++;
    } catch (err) {
      console.error("recordatorios/envio:", ev.id, err.message);
      errores.push(ev.id);
    }
  }

  res.status(200).json({ fecha: fecha, total: propias.length, enviados: enviados, errores: errores });
};
