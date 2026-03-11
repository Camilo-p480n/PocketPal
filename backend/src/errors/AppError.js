// src/errors/AppError.js
// Clase base para errores operacionales de la aplicación.
// La diferencia clave con un Error normal:
//   - Tiene un `statusCode` HTTP para saber qué responder al cliente
//   - `isOperational = true` distingue errores esperados (validación, not found)
//     de bugs reales (isOperational = false), para no exponer stack traces en prod.

export class AppError extends Error {
  /**
   * @param {string} message  - Mensaje legible para el cliente
   * @param {number} statusCode - Código HTTP (400, 401, 403, 404, 409, 500…)
   * @param {string} [code]   - Código interno opcional para el frontend (ej: 'CATEGORY_NOT_FOUND')
   */
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // error esperado, no un bug

    // Preserva el stack trace limpiamente sin incluir el constructor
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Subclases semánticas ────────────────────────────────────────────────────
// Usar estas en los servicios para mayor claridad en el código.

export class BadRequestError extends AppError {
  constructor(message, code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso', code = 'NOT_FOUND') {
    super(`${resource} no encontrado`, 404, code);
  }
}

export class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT') {
    super(message, 409, code);
  }
}

export class ValidationError extends AppError {
  /**
   * @param {string|string[]} errors - Uno o varios mensajes de validación
   */
  constructor(errors) {
    const message = Array.isArray(errors) ? errors[0] : errors;
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = Array.isArray(errors) ? errors : [errors];
  }
}

// module.exports = {
//   AppError,
//   BadRequestError,
//   UnauthorizedError,
//   ForbiddenError,
//   NotFoundError,
//   ConflictError,
//   ValidationError,
// };
