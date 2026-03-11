import { syncTransactions } from "../services/gmailService.js";

// Sincronización manual — llamada desde el dashboard
export const syncManual = async (req, res, next) => {
  try {
    const result = await syncTransactions(req.user.id);
    res.json({
      success: true,
      message: "Sincronización completada",
      data: result,
    });
  } catch (err) {
    if (err.message === "NO_TOKEN")
      return res.status(400).json({
        success: false,
        message: "Vuelve a iniciar sesión con Google",
      });
    next(err);
  }
};

// Sincronización automática — llamada por el cron (no es un endpoint HTTP)
export const syncAutomatic = async (userId) => {
  try {
    const result = await syncTransactions(userId);
    console.log(`✅ Sync automático user ${userId}:`, result);
  } catch (err) {
    console.error(`❌ Sync automático user ${userId} falló:`, err.message);
  }
};