// Helper compartido para hablar con la API de Google Calendar usando una
// cuenta de servicio (flujo JWT Bearer), sin dependencias externas — Node
// trae todo lo necesario (crypto para firmar RS256, fetch nativo).
//
// Requiere la variable de entorno GOOGLE_SERVICE_ACCOUNT_KEY con el
// contenido completo del JSON descargado de Google Cloud (cuenta de
// servicio), y GOOGLE_CALENDAR_ID con el ID del calendario a usar.

const crypto = require("crypto");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error("Falta la variable de entorno GOOGLE_SERVICE_ACCOUNT_KEY en Vercel.");
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY no es un JSON válido.");
  }
}

function getCalendarId() {
  const id = process.env.GOOGLE_CALENDAR_ID;
  if (!id) {
    throw new Error("Falta la variable de entorno GOOGLE_CALENDAR_ID en Vercel.");
  }
  return id;
}

async function getAccessToken() {
  const cuenta = getServiceAccount();
  const ahora = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: cuenta.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: ahora,
    exp: ahora + 3600
  }));

  const firmaInput = header + "." + claim;
  const firma = crypto.createSign("RSA-SHA256").update(firmaInput).sign(cuenta.private_key, "base64");
  const firmaUrl = firma.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const jwt = firmaInput + "." + firmaUrl;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + jwt
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error("No se pudo autenticar con Google (" + res.status + "): " + texto);
  }

  const data = await res.json();
  return data.access_token;
}

async function listarEventosDelDia(fechaISO) {
  const token = await getAccessToken();
  const calendarId = getCalendarId();

  const timeMin = fechaISO + "T00:00:00-06:00";
  const timeMax = fechaISO + "T23:59:59-06:00";

  const url = CALENDAR_API + "/calendars/" + encodeURIComponent(calendarId) + "/events" +
    "?timeMin=" + encodeURIComponent(timeMin) +
    "&timeMax=" + encodeURIComponent(timeMax) +
    "&singleEvents=true&orderBy=startTime&maxResults=250";

  const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) {
    const texto = await res.text();
    throw new Error("No se pudo leer el calendario (" + res.status + "): " + texto);
  }
  const data = await res.json();
  return data.items || [];
}

async function crearEvento(evento) {
  const token = await getAccessToken();
  const calendarId = getCalendarId();

  const res = await fetch(
    CALENDAR_API + "/calendars/" + encodeURIComponent(calendarId) + "/events",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(evento)
    }
  );

  if (!res.ok) {
    const texto = await res.text();
    throw new Error("No se pudo crear el evento (" + res.status + "): " + texto);
  }
  return res.json();
}

async function actualizarEvento(eventId, cambios) {
  const token = await getAccessToken();
  const calendarId = getCalendarId();

  const res = await fetch(
    CALENDAR_API + "/calendars/" + encodeURIComponent(calendarId) + "/events/" + encodeURIComponent(eventId),
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(cambios)
    }
  );

  if (!res.ok) {
    const texto = await res.text();
    throw new Error("No se pudo actualizar el evento (" + res.status + "): " + texto);
  }
  return res.json();
}

module.exports = { listarEventosDelDia, crearEvento, actualizarEvento };
