import cron from "node-cron";
import { pool } from "../config/db.js";
import { syncAutomatic } from "../controllers/gmailController.js";

export const startSyncCron = () => {
  // Corre cada hora
  cron.schedule("0 * * * *", async () => {
    console.log("🔄 Iniciando sync automático de todos los usuarios...");

    // Obtener todos los usuarios con token de Google
    const [users] = await pool.execute(
      "SELECT id FROM users WHERE google_access_token IS NOT NULL"
    );

    for (const user of users) {
      await syncAutomatic(user.id);
    }
  });

  console.log("⏰ Cron de sincronización iniciado - cada hora");
};