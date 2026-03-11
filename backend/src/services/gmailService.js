import { google } from "googleapis";
import { pool } from "../config/db.js";
import { parseTransaction } from "./bankParser/index.js";
import { setCategorie } from "./chatgpt-integration.service.js";

const getGmailClient = (accessToken) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
};

// Obtener emails de bancos de los últimos 30 días
export const getBankEmails = async (accessToken) => {
  const gmail = getGmailClient(accessToken);

  const query = [
    "from:an.notificacionesbancolombia.com",
    "from:davivienda.com",
    "from:bancodebogota.com.co",
  ].join(" OR ");

  const response = await gmail.users.messages.list({
    userId: "me",
    q: `(${query}) newer_than:365d`,
    maxResults: 100,
  });

  const messages = response.data.messages || [];
  if (messages.length === 0) return [];

  // Obtener detalle de cada email
  return Promise.all(
    messages.map((msg) =>
      gmail.users.messages
        .get({ userId: "me", id: msg.id, format: "full" })
        .then((r) => r.data),
    ),
  );
};

// ─── Parsear emails a objetos de transacción ──────────────────────────────────
export const parseBankEmails = (emails) => {
  return emails.reduce((acc, email) => {
    const transaction = parseTransaction(email);
    if (transaction) acc.push(transaction);
    return acc;
  }, []);
};

// ─── Sincronización principal ─────────────────────────────────────────────────

/**
 * Obtiene, parsea e inserta transacciones desde Gmail para un usuario.
 * Lanza Error('NO_TOKEN') si el usuario no tiene access token de Google.
 */
export const syncTransactions = async (userId) => {
  const [[user]] = await pool.execute(
    "SELECT google_access_token, google_refresh_token FROM users WHERE id = ?",
    [userId],
  );

  if (!user?.google_access_token) throw new Error("NO_TOKEN");

  const emails = await getBankEmails(user.google_access_token);
  const transactions = parseBankEmails(emails);

  let inserted = 0;
  let skipped = 0;

  for (const t of transactions) {
    // Evitar duplicados por gmail_message_id
    const [exists] = await pool.execute(
      "SELECT id FROM transactions WHERE gmail_message_id = ?",
      [t.gmailMessageId],
    );
    if (exists.length > 0) {
      skipped++;
      continue;
    }

    // Clasificar categoría con IA
    const category = await setCategorie(t.description, userId);

    await pool.execute(
      `INSERT INTO transactions
        (user_id, amount, type, description, merchant, date, bank, gmail_message_id, category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        t.amount,
        t.type,
        t.description,
        t.merchant,
        t.date,
        t.bank,
        t.gmailMessageId,
        category.categoryId,
      ],
    );

    inserted++;
  }

  return { inserted, skipped, total: emails.length };
};
