// Envío de correos desde el servidor (Vercel) vía la API REST de EmailJS.
// A diferencia del SDK de navegador que ya usa /omega, las llamadas
// servidor-a-servidor de EmailJS necesitan la "Private Key" de la cuenta
// (Account → API Keys en el dashboard de EmailJS) porque no llegan con un
// Origin de navegador que EmailJS pueda verificar.

const EMAILJS_API = "https://api.emailjs.com/api/v1.0/email/send";
const EMAILJS_PUBLIC_KEY = "rVrDyiGVherZWFCdj";
const EMAILJS_SERVICE_ID = "service_mrpdgir";

async function enviarCorreo(templateId, params) {
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Falta la variable de entorno EMAILJS_PRIVATE_KEY en Vercel.");
  }
  if (!templateId) {
    throw new Error("Falta el ID de plantilla de EmailJS (revisá las variables EMAILJS_TEMPLATE_*).");
  }

  const res = await fetch(EMAILJS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: privateKey,
      template_params: params
    })
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error("EmailJS respondió " + res.status + ": " + texto);
  }
}

module.exports = { enviarCorreo };
