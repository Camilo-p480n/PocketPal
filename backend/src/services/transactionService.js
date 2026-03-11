import { pool } from "../config/db.js";
import { NotFoundError } from "../errors/AppError.js";

/**
 * Construye un filtro WHERE dinámico para queries de transacciones.
 * Centralizado aquí para no repetirlo en list() y count().
 */
const buildWhereClause = (userId, filters = {}) => {
  const { type, category_id, start_date, end_date } = filters;
  const conditions = ["t.user_id = ?"];
  const params = [userId];

  if (type) {
    conditions.push("t.type = ?");
    params.push(type);
  }
  if (category_id) {
    conditions.push("t.category_id = ?");
    params.push(category_id);
  }
  if (start_date) {
    conditions.push("t.date >= ?");
    params.push(start_date);
  }
  if (end_date) {
    conditions.push("t.date <= ?");
    params.push(end_date);
  }

  return { where: conditions.join(" AND "), params };
};

export const transactionService = {
  async list(userId, filters = {}) {
    const page = Math.max(1, parseInt(filters.page || 1));
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit || 20)));
    const offset = (page - 1) * limit;

    const { where, params } = buildWhereClause(userId, filters);

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM transactions t WHERE ${where}`,
      params,
    );
    const [dataRows] = await pool.execute(
      `SELECT
         t.id, t.type, t.amount, t.description, t.date,
         t.created_at, t.updated_at, t.category_id,
         c.name AS category_name, c.type AS category_type
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE ${where}
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    const total = countRows[0].total;
    return {
      transactions: dataRows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Obtiene una transacción por ID. Lanza NotFoundError si no existe.
   */
  async getById(id, userId) {
    const [rows] = await pool.execute(
      `SELECT t.id, t.type, t.amount, t.description, t.date,
              t.created_at, t.updated_at, t.category_id, c.name AS category_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.id = ? AND t.user_id = ?`,
      [id, userId],
    );
    if (rows.length === 0)
      throw new NotFoundError("Transacción", "TRANSACTION_NOT_FOUND");
    return rows[0];
  },
  /**
   * Crea una nueva transacción.
   * Verifica que la categoría sea accesible para el usuario.
   */
  async create(userId, { type, amount, category_id, description, date }) {
    const [catRows] = await pool.execute(
      "SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)",
      [category_id, userId],
    );
    if (catRows.length === 0)
      throw new NotFoundError("Categoría", "CATEGORY_NOT_FOUND");

    const txDate = date || new Date().toISOString().split("T")[0];

    const [result] = await pool.execute(
      `INSERT INTO transactions (user_id, type, amount, category_id, description, date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        type,
        parseFloat(amount),
        category_id,
        description || null,
        txDate,
      ],
    );

    const [rows] = await pool.execute(
      "SELECT * FROM transactions WHERE id = ?",
      [result.insertId],
    );
    return rows[0];
  },
  /**
   * Actualiza una transacción existente.
   */
  async update(id, userId, { type, amount, category_id, description, date }) {
    // Verificar propiedad
    const [existing] = await pool.execute(
      "SELECT id FROM transactions WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    if (existing.length === 0)
      throw new NotFoundError("Transacción", "TRANSACTION_NOT_FOUND");
    // Verificar categoría
    const [catRows] = await pool.execute(
      "SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)",
      [category_id, userId],
    );
    if (catRows.length === 0)
      throw new NotFoundError("Categoría", "CATEGORY_NOT_FOUND");

    await pool.execute(
      `UPDATE transactions
       SET type = ?, amount = ?, category_id = ?, description = ?, date = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [
        type,
        parseFloat(amount),
        category_id,
        description || null,
        date,
        id,
        userId,
      ],
    );

    const [rows] = await pool.execute(
      "SELECT id, type, amount, category_id, description, date, updated_at FROM transactions WHERE id = ?",
      [id],
    );
    return rows[0];
  },
  /**
   * Elimina una transacción. Lanza NotFoundError si no existe o no pertenece al usuario.
   */
  async delete(id, userId) {
    const [result] = await pool.execute(
      "DELETE FROM transactions WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    if (result.affectedRows === 0)
      throw new NotFoundError("Transacción", "TRANSACTION_NOT_FOUND");
    return { id: parseInt(id) };
  },
};