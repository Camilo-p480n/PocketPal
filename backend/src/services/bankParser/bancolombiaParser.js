// Patrones extraídos de correos reales de Bancolombia

export const parseBancolombia = (body) => {
  // ✅ Limpiar saltos de línea y espacios extra antes de parsear
  const cleanBody = body
    .replace(/\r?\n/g, " ") // saltos de línea → espacio
    .replace(/\s+/g, " ") // espacios múltiples → uno solo
    .trim();
  // console.log("📄 Body recibido:", cleanBody.substring(0, 400)); // 👈 ver primeros 400 caracteres

  const transaction = {
    amount: null,
    type: null,
    description: null,
    merchant: null,
    date: null,
    bank: "Bancolombia",
  };

  // ─── 1. INGRESO - Nómina o pago recibido ──────────────────────────────────
  // "Recibiste un pago de Nomina de RETABLOS MED SA por $167,200.00"
  const ingresoMatch = cleanBody.match(
    /Recibiste un pago de (.+?) por \$([\d,.]+)/i,
  );
  if (ingresoMatch) {
    transaction.type = "income";
    transaction.description = `Pago recibido: ${ingresoMatch[1].trim()}`;
    transaction.merchant = ingresoMatch[1].trim();
    transaction.amount = parseAmount(ingresoMatch[2]);
    transaction.date = extractDate(cleanBody);
    return transaction;
  }

  // ─── 2. COMPRA - Tarjeta débito o crédito ─────────────────────────────────
  // "Compraste $11.900,00 en DLO*GOOGLE Google On con tu T.Deb *2998"
  const compraMatch = cleanBody.match(/Compraste \$([\d,.]+) en (.+?) con tu/i);
  if (compraMatch) {
    transaction.type = "expense";
    transaction.description = `Compra en: ${compraMatch[2].trim()}`;
    transaction.merchant = compraMatch[2].trim();
    transaction.amount = parseAmount(compraMatch[1]);
    transaction.date = extractDate(cleanBody);
    return transaction;
  }

  // ─── 3. TRANSFERENCIA enviada ─────────────────────────────────────────────
  // "Transferiste $2,300.00 desde tu cuenta 4155 a la cuenta *3122994475"
  const transferenciaMatch = cleanBody.match(
    /Transferiste \$([\d,.]+) desde tu cuenta (\d+) a la cuenta \*?(\d+)/i,
  );
  if (transferenciaMatch) {
    transaction.type = "expense";
    transaction.description = `Transferencia a cuenta *${transferenciaMatch[3].slice(-4)}`;
    transaction.merchant = `Cuenta *${transferenciaMatch[3].slice(-4)}`;
    transaction.amount = parseAmount(transferenciaMatch[1]);
    transaction.date = extractDate(cleanBody);
    return transaction;
  }

  // ─── 4. PAGO DE SERVICIO ──────────────────────────────────────────────────
  // Por si acaso hay correos de pagos de servicios públicos
  const pagoMatch = cleanBody.match(/Pagaste \$([\d,.]+) a (.+?) el/i);
  if (pagoMatch) {
    transaction.type = "expense";
    transaction.description = `Pago a: ${pagoMatch[2].trim()}`;
    transaction.merchant = pagoMatch[2].trim();
    transaction.amount = parseAmount(pagoMatch[1]);
    transaction.date = extractDate(cleanBody);
    return transaction;
  }

  return null; // no reconocido
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Normaliza montos: "11.900,00" o "167,200.00" → 167200.00
const parseAmount = (raw) => {
  if (!raw) return null;
  // Detectar formato colombiano: 11.900,00 (punto=miles, coma=decimal)
  if (raw.includes(",") && raw.indexOf(",") > raw.indexOf(".")) {
    return parseFloat(raw.replace(/\./g, "").replace(",", "."));
  }
  // Formato americano: 167,200.00 (coma=miles, punto=decimal)
  return parseFloat(raw.replace(/,/g, ""));
};

// Extrae fecha del cuerpo: "el 06/09/2025 a las 00:49"
const extractDate = (cleanBody) => {
  const dateMatch = cleanBody.match(/el (\d{2}\/\d{2}\/\d{4}) a las (\d{2}:\d{2})/i);
  if (dateMatch) {
    const [day, month, year] = dateMatch[1].split("/");
    return new Date(`${year}-${month}-${day}T${dateMatch[2]}:00`);
  }
  return new Date();
};
