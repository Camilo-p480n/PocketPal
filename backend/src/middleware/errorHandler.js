// Middleware de manejo de errores centralizado.
// Express lo reconoce como error handler porque tiene exactamente 4 parámetros.
// Se registra AL FINAL de app.js, después de todas las rutas.
//
// Flujo: controller lanza AppError → Express lo captura → llega aquí → respuesta JSON uniforme.

import { AppError, ValidationError } from "../errors/AppError.js";

// Transforma errores de MySQL en AppError legibles.

export const handleDbError = (err) => {
  // ER_DUP_ENTRY: entrada duplicada
  if (err.code === 'ER_DUP_ENTRY') {
    // err.message incluye el valor duplicado, ej: "Duplicate entry 'email@x.com' for key 'uq_users_email'"
    const field = err.message.match(/for key '(.+?)'/)?.[1] || 'campo';
    return new AppError(`Ya existe un registro con ese valor (${field})`, 409, 'DUPLICATE_ENTRY');
  }
  // ER_NO_REFERENCED_ROW_2: foreign key violation
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return new AppError('Referencia a un recurso que no existe', 400, 'INVALID_REFERENCE');
  }
  // ER_ROW_IS_REFERENCED_2: no se puede borrar por FK
  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return new AppError('No se puede eliminar porque otros registros dependen de este', 409, 'REFERENCED_ROW');
  }
  // ER_CHECK_CONSTRAINT_VIOLATED: CHECK constraint (MySQL 8.0.16+)
  if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return new AppError('Valor fuera del rango permitido', 400, 'CHECK_VIOLATION');
  }
  return null;
};

/**
 * Middleware de error centralizado.
 * Recibe cualquier error lanzado con `next(err)` o `throw` dentro de async handlers.
 */
export const errorHandler = (err, req, res, next) => {
  
  // ── Intentar transformar errores de MySQL ──────────────────────────────────
  const dbError = err.code && handleDbError(err);
  if (dbError) {
    return res.status(dbError.statusCode).json({ success: false, code: dbError.code, message: dbError.message });
  }
  
  // ── Error de validación (con lista de errores) ────────────────────────
  if (err instanceof ValidationError && err.errors) {
    return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: err.message, errors: err.errors });
  }
  
  // ── Error operacional conocido (AppError) ─────────────────────────────
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
  }

  // ── Error de JWT (jsonwebtoken lanza sus propios tipos) ───────────────
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Token inválido o expirado. Inicia sesión de nuevo.' });
  }
  
  // ── Error de sintaxis JSON en el body ────────────────────────────────
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({ success: false, code: 'INVALID_JSON', message: 'El cuerpo de la petición no es JSON válido' });
  }
  
  // ── Error inesperado (bug real) ───────────────────────────────────────
  const isDev = process.env.NODE_ENV === 'development';
  console.error('💥 Error inesperado:', { message: err.message, stack: err.stack, url: req.originalUrl, method: req.method, userId: req.user?.id });

  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Error interno del servidor',
    ...(isDev && { detail: err.message, stack: err.stack }),
  });
};
