// src/controllers/aiController.js
// Controller delgado para el agente NOVA.
// La lógica completa (contexto, Anthropic, herramientas) vive en aiService.js.
import aiService from "../services/aiService.js";

export const chat = async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;
    const result = await aiService.chat(req.user.id, message, history);
    res.json({
      success: true,
      data: { ...result, timestamp: new Date().toISOString() },
    });
  } catch (err) {
    next(err);
  }
};

export const getChatHistory = async (req, res, next) => {
  try {
    const history = await aiService.getHistory(req.user.id);
    res.json({ success: true, data: { history } });
  } catch (err) {
    next(err);
  }
};

export const clearChatHistory = async (req, res, next) => {
  try {
    await aiService.clearHistory(req.user.id);
    res.json({ success: true, message: "Historial borrado" });
  } catch (err) {
    next(err);
  }
};
