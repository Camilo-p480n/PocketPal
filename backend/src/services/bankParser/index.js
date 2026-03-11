import { parseBancolombia } from "./bancolombiaParser.js";

// Remitentes conocidos de cada banco
const BANK_SENDERS = {
  // ✅ Usa solo la parte del dominio, no el email completo
  bancolombia: ["an.notificacionesbancolombia.com"],
  davivienda: ["davivienda.com"],
  bogota: ["bancodebogota.com.co"],
};

const detectBank = (fromHeader) => {
  const from = fromHeader?.toLowerCase() || "";
  // ✅ includes busca si el dominio aparece en cualquier parte del header
  if (BANK_SENDERS.bancolombia.some((s) => from.includes(s)))
    return "bancolombia";
  if (BANK_SENDERS.davivienda.some((s) => from.includes(s)))
    return "davivienda";
  if (BANK_SENDERS.bogota.some((s) => from.includes(s))) return "bogota";
  return null;
};

export const parseTransaction = (emailData) => {
  // Decodificar body del email desde base64
  const parts = emailData.payload.parts || [emailData.payload];
  let body = "";
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      body = Buffer.from(part.body.data, "base64").toString("utf-8");
      break;
    }
  }

  // Si no hay texto plano, intentar con HTML
  if (!body) {
    for (const part of parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        body = Buffer.from(part.body.data, "base64")
          .toString("utf-8")
          .replace(/<[^>]+>/g, " ") // strip HTML tags
          .replace(/\s+/g, " ")
          .trim();
        break;
      }
    }
  }

  // Detectar banco por remitente
  const fromHeader = emailData.payload.headers.find(
    (h) => h.name === "From",
  )?.value;
  const bank = detectBank(fromHeader);

  //console.log(`📧 Email de: ${fromHeader} → Banco: ${bank ?? "no reconocido"}`);

  if (!bank) return null;

  // Parsear según banco
  let transaction = null;
  if (bank === "bancolombia") transaction = parseBancolombia(body);
  // Davivienda y Bogotá se agregan cuando tengas correos reales

  if (!transaction) return null;

  // Agregar gmail_message_id para evitar duplicados
  transaction.gmailMessageId = emailData.id;

  return transaction;
};