// src/services/categoryService.js — MySQL
import { pool } from "../config/db.js";
import { NotFoundError, ConflictError } from "../errors/AppError.js";

export const categoryService = {
  async list(userId) {
    const [rows] = await pool.execute(
      `SELECT id, name, type, user_id,
              CASE WHEN user_id IS NULL THEN 'global' ELSE 'custom' END AS scope
       FROM categories
       WHERE user_id IS NULL OR user_id = ?
       ORDER BY user_id IS NOT NULL, name ASC` /* NULLs primero = globales al tope */,
      [userId],
    );
    return rows;
  },

  async getById(id, userId) {
    const [rows] = await pool.execute(
      "SELECT id, name, type, user_id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)",
      [id, userId],
    );
    if (rows.length === 0)
      throw new NotFoundError("Categoría", "CATEGORY_NOT_FOUND");
    return rows[0];
  },

  async create(userId, { name, type }) {
    // Verificar que no exista ya una categoría igual para este usuario
    const [existing] = await pool.execute(
      "SELECT id FROM categories WHERE name = ? AND type = ? AND user_id = ?",
      [name.trim(), type, userId],
    );
    if (existing.length > 0)
      throw new ConflictError(
        "Ya tienes una categoría con ese nombre y tipo",
        "CATEGORY_DUPLICATE",
      );

    const [result] = await pool.execute(
      "INSERT INTO categories (name, type, user_id) VALUES (?, ?, ?)",
      [name.trim(), type, userId],
    );

    const [rows] = await pool.execute("SELECT * FROM categories WHERE id = ?", [
      result.insertId,
    ]);
    return rows[0];
  },

  async update(id, userId, { name, type }) {
    // Solo se pueden editar categorías propias (no globales)
    const [existing] = await pool.execute(
      "SELECT id FROM categories WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    if (existing.length === 0)
      throw new NotFoundError("Categoría propia", "CATEGORY_NOT_FOUND");

    await pool.execute(
      "UPDATE categories SET name = ?, type = ?, updated_at = NOW() WHERE id = ? AND user_id = ?",
      [name.trim(), type, id, userId],
    );

    const [rows] = await pool.execute("SELECT * FROM categories WHERE id = ?", [
      id,
    ]);
    return rows[0];
  },

  async delete(id, userId) {
    const [existing] = await pool.execute(
      "SELECT id FROM categories WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    if (existing.length === 0)
      throw new NotFoundError("Categoría propia", "CATEGORY_NOT_FOUND");

    // No borrar si tiene transacciones asociadas
    const [[{ total }]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM transactions WHERE category_id = ? AND user_id = ?",
      [id, userId],
    );
    if (total > 0)
      throw new ConflictError(
        "No se puede eliminar una categoría con transacciones asociadas",
        "CATEGORY_IN_USE",
      );

    await pool.execute("DELETE FROM categories WHERE id = ? AND user_id = ?", [
      id,
      userId,
    ]);
    return { id: parseInt(id) };
  },
};
