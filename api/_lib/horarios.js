// Reglas de horario compartidas entre /api/disponibilidad y /api/reservar,
// para que ambos calculen exactamente la misma grilla de citas.
//
// Costa Rica es UTC-6 todo el año (sin horario de verano), así que en vez
// de depender de datos de zona horaria del runtime, restamos 6 horas a mano
// para obtener la hora "de pared" de Costa Rica de forma confiable.

const SLOT_MINUTOS = 15;
const DURACION_CITA_MINUTOS = 15;

function ahoraEnCR() {
  return new Date(Date.now() - 6 * 60 * 60 * 1000);
}

function horarioDelDia(fechaISO) {
  // fechaISO: "YYYY-MM-DD". Se arma como fecha "UTC" a mediodía solo para
  // sacar el día de la semana sin líos de zona horaria.
  const dia = new Date(fechaISO + "T12:00:00Z").getUTCDay(); // 0=domingo … 6=sábado
  if (dia === 0) return null; // domingo cerrado
  if (dia === 6) return { inicio: "07:00", fin: "12:00" }; // sábado
  return { inicio: "07:00", fin: "16:00" }; // lunes a viernes
}

function aMinutos(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function aHHMM(minutos) {
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  return h + ":" + m;
}

// Todos los horarios de inicio posibles ese día (sin filtrar ocupados).
function generarGrillaDelDia(fechaISO) {
  const horario = horarioDelDia(fechaISO);
  if (!horario) return [];

  const inicio = aMinutos(horario.inicio);
  const fin = aMinutos(horario.fin);
  const slots = [];
  for (let m = inicio; m + DURACION_CITA_MINUTOS <= fin; m += SLOT_MINUTOS) {
    slots.push(aHHMM(m));
  }
  return slots;
}

// Filtra los que ya pasaron, si fechaISO es hoy (hora de Costa Rica).
function filtrarPasados(fechaISO, slots) {
  const ahora = ahoraEnCR();
  const hoyISO = ahora.getUTCFullYear() + "-" +
    String(ahora.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(ahora.getUTCDate()).padStart(2, "0");

  if (fechaISO !== hoyISO) return slots;

  const minutosAhora = ahora.getUTCHours() * 60 + ahora.getUTCMinutes();
  return slots.filter(function (s) { return aMinutos(s) > minutosAhora; });
}

// ¿Un slot (fechaISO + horaHHMM, con la duración de una cita) se solapa con
// algún evento existente en el calendario ese día? Todo se compara como
// instante absoluto (ms desde época) para no arrastrar errores de zona
// horaria: el offset "-06:00" fija el slot en hora de Costa Rica, y
// Date() interpreta el offset que venga en cada evento correctamente sin
// necesidad de asumir nada más.
function slotOcupado(fechaISO, horaHHMM, eventosDelDia) {
  const inicioSlotMs = new Date(fechaISO + "T" + horaHHMM + ":00-06:00").getTime();
  const finSlotMs = inicioSlotMs + DURACION_CITA_MINUTOS * 60000;

  return eventosDelDia.some(function (evento) {
    if (!evento.start || !evento.start.dateTime) return false; // ignora eventos "todo el día"
    const inicioEventoMs = new Date(evento.start.dateTime).getTime();
    const finEventoMs = new Date(evento.end.dateTime).getTime();
    return inicioSlotMs < finEventoMs && finSlotMs > inicioEventoMs;
  });
}

module.exports = {
  SLOT_MINUTOS,
  DURACION_CITA_MINUTOS,
  horarioDelDia,
  generarGrillaDelDia,
  filtrarPasados,
  slotOcupado
};
