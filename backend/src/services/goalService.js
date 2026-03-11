// src/services/goalService.js
import { pool } from "../config/db.js";
import { NotFoundError, ConflictError } from "../errors/AppError.js";

const MYSQL = `
  CASE WHEN target_amount > 0
    THEN ROUND((current_amount / target_amount * 100), 2)
    ELSE 0
  END AS progress_percent`;

export const goalService = {
  async list(userId) {
    const [rows] = await pool.execute(
      `SELECT id, title, target_amount, current_amount, is_completed,
              completed_at, created_at, updated_at, ${MYSQL}
       FROM goals WHERE user_id = ?
       ORDER BY is_completed ASC, created_at DESC`,
      [userId],
    );
    return rows;
  },

  async getById(id, userId) {
    const [[goalRows], [allocRows]] = await Promise.all([
      pool.execute(
        `SELECT id, title, target_amount, current_amount, is_completed,
                completed_at, created_at, updated_at, ${MYSQL}
         FROM goals WHERE id = ? AND user_id = ?`,
        [id, userId],
      ),
      pool.execute(
        "SELECT id, amount, created_at FROM goal_allocations WHERE goal_id = ? AND user_id = ? ORDER BY created_at DESC",
        [id, userId],
      ),
    ]);

    if (goalRows.length === 0)
      throw new NotFoundError("Meta", "GOAL_NOT_FOUND");
    return { goal: goalRows[0], allocations: allocRows };
  },

  async create(userId, { title, target_amount }) {
    const [result] = await pool.execute(
      "INSERT INTO goals (user_id, title, target_amount) VALUES (?, ?, ?)",
      [userId, title.trim(), parseFloat(target_amount)],
    );
    const [[row]] = await pool.execute("SELECT * FROM goals WHERE id = ?", [
      result.insertId,
    ]);
    return row;
  },

  async update(id, userId, { title, target_amount }) {
    const [existing] = await pool.execute(
      "SELECT id FROM goals WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    if (existing.length === 0)
      throw new NotFoundError("Meta", "GOAL_NOT_FOUND");

    await pool.execute(
      "UPDATE goals SET title = ?, target_amount = ?, updated_at = NOW() WHERE id = ? AND user_id = ?",
      [title.trim(), parseFloat(target_amount), id, userId],
    );
    const [[row]] = await pool.execute(
      "SELECT id, title, target_amount, current_amount, is_completed, updated_at FROM goals WHERE id = ?",
      [id],
    );
    return row;
  },

  async delete(id, userId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [existing] = await conn.execute(
        "SELECT id FROM goals WHERE id = ? AND user_id = ?",
        [id, userId],
      );
      if (existing.length === 0) {
        await conn.rollback();
        throw new NotFoundError("Meta", "GOAL_NOT_FOUND");
      }

      await conn.execute(
        "DELETE FROM goal_allocations WHERE goal_id = ? AND user_id = ?",
        [id, userId],
      );
      await conn.execute("DELETE FROM goals WHERE id = ? AND user_id = ?", [
        id,
        userId,
      ]);

      await conn.commit();
      return { id: parseInt(id) };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async allocate(id, userId, amount) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [goalRows] = await conn.execute(
        "SELECT id, title, target_amount, current_amount, is_completed FROM goals WHERE id = ? AND user_id = ? FOR UPDATE",
        [id, userId],
      );

      if (goalRows.length === 0) {
        await conn.rollback();
        throw new NotFoundError("Meta", "GOAL_NOT_FOUND");
      }

      const goal = goalRows[0];
      if (goal.is_completed) {
        await conn.rollback();
        throw new ConflictError(
          "Esta meta ya está completada",
          "GOAL_ALREADY_COMPLETED",
        );
      }

      const newAmount = parseFloat(goal.current_amount) + parseFloat(amount);
      const isCompleted = newAmount >= parseFloat(goal.target_amount);

      await conn.execute(
        `UPDATE goals SET current_amount = ?, is_completed = ?, completed_at = ?, updated_at = NOW()
         WHERE id = ? AND user_id = ?`,
        [newAmount, isCompleted ? 1 : 0, isCompleted ? new Date() : null, id, userId],
      );

      // Buscar categoría global Ahorro
      const [[savingCat]] = await conn.execute(
        "SELECT id FROM categories WHERE name = 'Ahorro' AND user_id IS NULL LIMIT 1"
      );

      // Registrar como saving — descuenta del balance disponible
      await conn.execute(
        "INSERT INTO transactions (user_id, amount, type, category_id, description, date) VALUES (?, ?, 'saving', ?, ?, CURDATE())",
        [userId, parseFloat(amount), savingCat.id, `Aporte a meta: ${goal.title ?? ''}`],
      );

      const [allocResult] = await conn.execute(
        "INSERT INTO goal_allocations (user_id, goal_id, amount) VALUES (?, ?, ?)",
        [userId, id, parseFloat(amount)],
      );

      await conn.commit();

      const [[updatedGoal]] = await pool.execute(
        "SELECT id, title, target_amount, current_amount, is_completed, completed_at FROM goals WHERE id = ?",
        [id],
      );
      const [[allocation]] = await pool.execute(
        "SELECT id, amount, created_at FROM goal_allocations WHERE id = ?",
        [allocResult.insertId],
      );

      return { goal: updatedGoal, allocation, justCompleted: isCompleted };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async completeGoal(id, userId, completionType) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [goalRows] = await conn.execute(
        "SELECT * FROM goals WHERE id = ? AND user_id = ? AND is_completed = 1 FOR UPDATE",
        [id, userId],
      );

      if (goalRows.length === 0) {
        await conn.rollback();
        throw new NotFoundError("Meta", "GOAL_NOT_FOUND");
      }

      // Solo guardar la decisión — el dinero ya salió del balance con los aportes
      await conn.execute(
        "UPDATE goals SET completion_type = ? WHERE id = ?",
        [completionType, id],
      );

      await conn.commit();
      return { completionType, title: goalRows[0].title };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
};

export default goalService;