import OpenAI from "openai";
import { pool } from "../config/db.js";
import { AppError } from "../errors/AppError.js";

// Inicializar cliente OpenAI — lee OPENAI_API_KEY del entorno automáticamente
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const MAX_TOKENS = 1024;
const HISTORY_LIMIT = 10; // turnos previos que se incluyen como contexto

// ─── Contexto financiero ──────────────────────────────────────────────────────
// Se carga fresco en cada mensaje y se inyecta en el system prompt.

const loadFinancialContext = async (userId) => {
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [cats, summary, recent, goals] = await Promise.all([
    pool.execute(
      "SELECT id, name, type FROM categories WHERE user_id IS NULL OR user_id = ? ORDER BY type, name",
      [userId],
    ),
    pool.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS expenses,
         COUNT(*) AS tx_count
       FROM transactions WHERE user_id = ? AND date >= ?`,
      [userId, firstDay],
    ),
    pool.execute(
      `SELECT t.type, t.amount, t.description, t.date, c.name AS category
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ?
       ORDER BY t.date DESC, t.created_at DESC LIMIT 5`,
      [userId],
    ),
    pool.execute(
      `SELECT title, target_amount, current_amount,
              ROUND((current_amount / NULLIF(target_amount, 0) * 100), 1) AS pct
       FROM goals WHERE user_id = ? AND is_completed = 0 LIMIT 5`,
      [userId],
    ),
  ]);

  return {
    categories: cats[0],
    monthSummary: summary[0][0],
    recent: recent[0],
    goals: goals[0],
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    date: now.toLocaleDateString("es-CO"),
  };
};

// ─── System prompt ────────────────────────────────────────────────────────────

const buildSystemPrompt = (ctx) => {
  const categoryList = ctx.categories.length
    ? ctx.categories.map((c) => `  - "${c.name}" (${c.type})`).join("\n")
    : "  (sin categorías)";

  const recentList = ctx.recent.length
    ? ctx.recent
        .map(
          (t) =>
            `  - ${t.date} | ${t.type} | $${t.amount} | ${t.category}` +
            (t.description ? ` | ${t.description}` : ""),
        )
        .join("\n")
    : "  (sin transacciones recientes)";

  const goalsList = ctx.goals.length
    ? ctx.goals
        .map(
          (g) =>
            `  - "${g.title}": $${g.current_amount}/$${g.target_amount} (${g.pct}%)`,
        )
        .join("\n")
    : "  (sin metas activas)";

  return `Eres NOVA, asistente financiero personal integrado en una app de gestión de finanzas. Eres preciso, amigable y útil.

FECHA ACTUAL: ${ctx.date} | MES: ${ctx.month}
RESUMEN DEL MES: Ingresos $${ctx.monthSummary.income} | Gastos $${ctx.monthSummary.expenses} | Transacciones: ${ctx.monthSummary.tx_count}

CATEGORÍAS DISPONIBLES:
${categoryList}

ÚLTIMAS TRANSACCIONES:
${recentList}

METAS ACTIVAS:
${goalsList}

REGLAS:
- Responde siempre en español
- Usa los nombres de categoría EXACTOS del listado de arriba
- "gasté/pagué/compré" → expense | "recibí/cobré/ingresé" → income
- Si faltan datos para registrar (monto o categoría), pídelos antes de usar una función
- Para estadísticas usa las funciones disponibles — nunca inventes números
- Si gastos > ingresos del mes, menciónalo con tacto al dar consejos
- Usa emojis con moderación`;
};

// ─── Herramientas (formato OpenAI) ───────────────────────────────────────────
// OpenAI usa tools[].type = "function" con parámetros en .function.parameters
// La estructura interna es JSON Schema.

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_transaction",
      description:
        "Registra una nueva transacción (ingreso o gasto) en la base de datos del usuario",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "Monto positivo de la transacción",
          },
          transaction_type: { type: "string", enum: ["income", "expense"] },
          category_name: {
            type: "string",
            description: "Nombre exacto de la categoría según el listado",
          },
          description: { type: "string", description: "Descripción opcional" },
          date: {
            type: "string",
            description: "Fecha YYYY-MM-DD. Si no se especifica, usar hoy",
          },
        },
        required: ["amount", "transaction_type", "category_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_stats",
      description:
        "Consulta estadísticas financieras del usuario para un período determinado",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["week", "month", "year", "all"] },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_transactions",
      description:
        "Lista las últimas transacciones del usuario, con filtro opcional por tipo",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Cantidad a mostrar (máximo 20, default 10)",
          },
          type: { type: "string", enum: ["income", "expense"] },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "goals_status",
      description:
        "Consulta el estado actual de todas las metas de ahorro del usuario",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// ─── Ejecutores de herramientas ───────────────────────────────────────────────

const toolExecutors = {
  async create_transaction(
    userId,
    { amount, transaction_type, category_name, description, date },
  ) {
    // Buscar categoría por nombre
    const [cats] = await pool.execute(
      "SELECT id, name, type FROM categories WHERE (user_id IS NULL OR user_id = ?) AND name LIKE ? LIMIT 1",
      [userId, `%${category_name}%`],
    );

    if (cats.length === 0) {
      return {
        success: false,
        message: `No encontré la categoría "${category_name}". Por favor usa un nombre exacto del listado.`,
      };
    }

    const cat = cats[0];
    const txDate = date || new Date().toISOString().split("T")[0];

    const [result] = await pool.execute(
      "INSERT INTO transactions (user_id, type, amount, category_id, description, date) VALUES (?, ?, ?, ?, ?, ?)",
      [
        userId,
        transaction_type,
        parseFloat(amount),
        cat.id,
        description || null,
        txDate,
      ],
    );

    const [[tx]] = await pool.execute(
      "SELECT id, type, amount, description, date FROM transactions WHERE id = ?",
      [result.insertId],
    );

    return {
      success: true,
      actionType: "TRANSACTION_CREATED",
      transaction: { ...tx, category: cat.name },
    };
  },

  async query_stats(userId, { period }) {
    let dateFilter = "";
    const params = [userId];

    if (period === "month") {
      const now = new Date();
      params.push(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
      );
      dateFilter = "AND date >= ?";
    } else if (period === "week") {
      dateFilter = "AND date >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    } else if (period === "year") {
      dateFilter = "AND date >= DATE_FORMAT(NOW(), '%Y-01-01')";
    }

    const [[stats]] = await pool.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS total_expenses,
         COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS net,
         COUNT(*) AS total_transactions
       FROM transactions WHERE user_id = ? ${dateFilter}`,
      params,
    );

    const [breakdown] = await pool.execute(
      `SELECT c.name, t.type, SUM(t.amount) AS total
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? ${dateFilter}
       GROUP BY c.name, t.type
       ORDER BY total DESC LIMIT 8`,
      params,
    );

    return {
      success: true,
      actionType: "STATS_RESULT",
      stats,
      breakdown,
      period,
    };
  },

  async list_transactions(userId, { limit = 10, type } = {}) {
    const safeLimit = Math.min(20, Math.max(1, parseInt(limit) || 10));
    const params = [userId];
    let typeFilter = "";

    if (type) {
      typeFilter = "AND t.type = ?";
      params.push(type);
    }

    const [rows] = await pool.execute(
      `SELECT t.id, t.type, t.amount, t.description, t.date, c.name AS category
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? ${typeFilter}
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT ${safeLimit}`,
      params,
    );

    return {
      success: true,
      actionType: "TRANSACTIONS_LIST",
      transactions: rows,
    };
  },

  async goals_status(userId) {
    const [rows] = await pool.execute(
      `SELECT title, target_amount, current_amount, is_completed,
              ROUND((current_amount / NULLIF(target_amount, 0) * 100), 1) AS pct
       FROM goals WHERE user_id = ?
       ORDER BY is_completed ASC, created_at DESC`,
      [userId],
    );
    return { success: true, actionType: "GOALS_STATUS", goals: rows };
  },
};

// ─── Servicio público ─────────────────────────────────────────────────────────

const aiService = {
  async chat(userId, message, history = []) {
    // 1. Guardar mensaje del usuario
    await pool.execute(
      "INSERT INTO ai_chat_history (user_id, role, content) VALUES (?, 'user', ?)",
      [userId, message],
    );

    // 2. Contexto financiero fresco
    const ctx = await loadFinancialContext(userId);
    const systemPrompt = buildSystemPrompt(ctx);

    // 3. Construir mensajes
    //    OpenAI: system prompt va como role:"system" dentro del array
    const messages = [
      { role: "system", content: systemPrompt },
      ...history
        .slice(-HISTORY_LIMIT)
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    let finalText = "";
    let actionResult = null;

    try {
      // 4. Primera llamada
      const firstResponse = await openai.chat.completions.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        tools: TOOLS,
        tool_choice: "auto",
        messages,
      });

      const assistantMessage = firstResponse.choices[0].message;

      // 5. ¿El modelo quiere ejecutar una función?
      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        const toolCall = assistantMessage.tool_calls[0];
        const funcName = toolCall.function.name;

        let funcArgs = {};
        try {
          funcArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          funcArgs = {};
        }

        // Ejecutar la función en la base de datos
        const executor = toolExecutors[funcName];
        actionResult = executor
          ? await executor(userId, funcArgs)
          : { success: false, message: `Función "${funcName}" no disponible` };

        // 6. Segunda llamada: enviar el resultado de la función al modelo
        //    OpenAI requiere:
        //      a) El mensaje del asistente (con tool_calls) tal cual vino
        //      b) Un mensaje role:"tool" por cada tool_call ejecutado
        const secondResponse = await openai.chat.completions.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          tools: TOOLS,
          messages: [
            ...messages,
            // El mensaje del asistente que pidió la función (obligatorio incluirlo)
            assistantMessage,
            // Resultado de la función
            {
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(actionResult),
            },
          ],
        });
        // El modelo respondió directo sin usar ninguna función
        finalText = secondResponse.choices[0].message.content || "";
      } else {
        finalText = assistantMessage.content || "";
      }
    } catch (err) {
      // Capturar errores de la API de OpenAI (cuota, red, modelo inválido, etc.)
      if (err instanceof OpenAI.APIError) {
        console.error("OpenAI API error:", err.status, err.message);
        throw new AppError(
          `Error del agente IA: ${err.message}`,
          502,
          "AI_UNAVAILABLE",
        );
      }
      throw err;
    }

    // 7. Guardar respuesta del asistente
    await pool.execute(
      "INSERT INTO ai_chat_history (user_id, role, content) VALUES (?, 'assistant', ?)",
      [userId, finalText],
    );

    return { message: finalText, actionResult };
  },

  async getHistory(userId) {
    const [rows] = await pool.execute(
      "SELECT role, content, created_at FROM ai_chat_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      [userId],
    );
    return rows.reverse();
  },

  async clearHistory(userId) {
    await pool.execute("DELETE FROM ai_chat_history WHERE user_id = ?", [
      userId,
    ]);
  },
};

export default aiService;
