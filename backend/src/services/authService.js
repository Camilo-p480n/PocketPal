import { pool } from "../config/db.js";
import { hashPassword, comparePassword } from "../utils/hash.js";
import { generateToken } from "../utils/jwt.js";
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from "../errors/AppError.js";

export const authService = {
  /**
   * Registra un nuevo usuario con email y contraseña.
   * Lanza ConflictError si el email ya existe.
   */
  async register({ name, email, password }) {
    const [existing] = await pool.execute(
      "SELECT id FROM users WHERE email = ?",
      [email.toLowerCase().trim()],
    );
    if (existing.length > 0)
      throw new ConflictError(
        "Ya existe una cuenta con ese correo",
        "EMAIL_TAKEN",
      );

    const passwordHash = await hashPassword(password);
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name.trim(), email.toLowerCase().trim(), passwordHash],
    );

    const [[user]] = await pool.execute(
      "SELECT id, name, email, created_at FROM users WHERE id = ?",
      [result.insertId],
    );

    const token = generateToken({ id: user.id, email: user.email });
    return { user, token };
  },

  /**
   * Autentica un usuario con email y contraseña.
   * Lanza UnauthorizedError si las credenciales son incorrectas.
   */
  async login({ email, password }) {
    const [rows] = await pool.execute(
      "SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?",
      [email.toLowerCase().trim()],
    );

    const user = rows[0];
    if (!user || !(await comparePassword(password, user.password_hash)))
      throw new UnauthorizedError(
        "Correo o contraseña incorrectos",
        "INVALID_CREDENTIALS",
      );

    const { password_hash, ...safeUser } = user;
    const token = generateToken({ id: user.id, email: user.email });
    return { user: safeUser, token };
  },

  /**
   * Retorna el perfil del usuario autenticado.
   * Lanza NotFoundError si el usuario no existe.
   */
  async getMe(userId) {
    const [[user]] = await pool.execute(
      "SELECT id, name, email, created_at FROM users WHERE id = ?",
      [userId],
    );
    if (!user) throw new NotFoundError("Usuario", "USER_NOT_FOUND");
    return user;
  },

  /**
   * Verifica si un usuario con ese email ya tiene google_refresh_token.
   * Usado para decidir el prompt de OAuth (consent vs select_account).
   */
  async hasGoogleToken(email) {
    const [rows] = await pool.execute(
      "SELECT google_refresh_token FROM users WHERE email = ?",
      [email.toLowerCase().trim()],
    );
    return rows.length > 0 && !!rows[0].google_refresh_token;
  },
};
