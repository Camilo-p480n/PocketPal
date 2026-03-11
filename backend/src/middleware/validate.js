// src/middleware/validate.js
// Middleware de validación declarativa.
// Cada ruta declara qué reglas aplicar. Si algo falla, lanza ValidationError
// antes de que el controller siquiera se ejecute.
//
// Uso en rutas:
//   router.post('/', validate(rules.transaction.create), createTransaction);

import { ValidationError } from "../errors/AppError.js";

// ─── Motor de reglas ──────────────────────────────────────────────────────────

/**
 * Cada regla es una función (value, body) => string|null
 * Devuelve string con el error, o null si es válido.
 */
const r = {
  required: (field) => (val) =>
    (val === undefined || val === null || String(val).trim() === '')
      ? `El campo '${field}' es requerido`
      : null,

  minLength: (field, min) => (val) =>
    val && String(val).trim().length < min
      ? `'${field}' debe tener al menos ${min} caracteres`
      : null,

  isEmail: (field) => (val) =>
    val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
      ? `'${field}' debe ser un correo válido`
      : null,

  isPositiveNumber: (field) => (val) =>
    (val !== undefined && val !== null && val !== '') && (isNaN(val) || parseFloat(val) <= 0)
      ? `'${field}' debe ser un número positivo`
      : null,

  isOneOf: (field, options) => (val) =>
    val && !options.includes(val)
      ? `'${field}' debe ser uno de: ${options.join(', ')}`
      : null,

  isDate: (field) => (val) =>
    val && isNaN(Date.parse(val))
      ? `'${field}' debe ser una fecha válida (YYYY-MM-DD)`
      : null,

  isInteger: (field) => (val) =>
    val !== undefined && val !== null && val !== '' && !Number.isInteger(Number(val))
      ? `'${field}' debe ser un número entero`
      : null,

  maxLength: (field, max) => (val) =>
    val && String(val).trim().length > max
      ? `'${field}' no puede exceder ${max} caracteres`
      : null,
};

// ─── Definición de reglas por recurso ────────────────────────────────────────

export const rules = {
  auth: {
    register: {
      name: [r.required('nombre'), r.minLength('nombre', 2), r.maxLength('nombre', 100)],
      email: [r.required('email'), r.isEmail('email')],
      password: [r.required('contraseña'), r.minLength('contraseña', 6)],
    },
    login: {
      email: [r.required('email'), r.isEmail('email')],
      password: [r.required('contraseña')],
    },
  },

  transaction: {
    create: {
      type: [r.required('type'), r.isOneOf('type', ['income', 'expense'])],
      amount: [r.required('amount'), r.isPositiveNumber('amount')],
      category_id: [r.required('category_id'), r.isInteger('category_id')],
      date: [r.isDate('date')],            // opcional
      description: [r.maxLength('description', 500)], // opcional
    },
    update: {
      type: [r.required('type'), r.isOneOf('type', ['income', 'expense'])],
      amount: [r.required('amount'), r.isPositiveNumber('amount')],
      category_id: [r.required('category_id'), r.isInteger('category_id')],
      date: [r.required('date'), r.isDate('date')],
      description: [r.maxLength('description', 500)],
    },
  },

  category: {
    create: {
      name: [r.required('name'), r.minLength('name', 1), r.maxLength('name', 100)],
      type: [r.required('type'), r.isOneOf('type', ['income', 'expense'])],
    },
    update: {
      name: [r.required('name'), r.minLength('name', 1), r.maxLength('name', 100)],
      type: [r.required('type'), r.isOneOf('type', ['income', 'expense'])],
    },
  },

  goal: {
    create: {
      title: [r.required('title'), r.minLength('title', 1), r.maxLength('title', 200)],
      target_amount: [r.required('target_amount'), r.isPositiveNumber('target_amount')],
    },
    update: {
      title: [r.required('title'), r.minLength('title', 1), r.maxLength('title', 200)],
      target_amount: [r.required('target_amount'), r.isPositiveNumber('target_amount')],
    },
    allocate: {
      amount: [r.required('amount'), r.isPositiveNumber('amount')],
    },
  },

  ai: {
    chat: {
      message: [r.required('message'), r.minLength('message', 1), r.maxLength('message', 2000)],
    },
  },
};

// ─── Middleware factory ───────────────────────────────────────────────────────

/**
 * Crea un middleware de validación a partir de un conjunto de reglas.
 *
 * @param {object} fieldRules - { campo: [regla1, regla2, ...] }
 * @returns {function} middleware de Express
 *
 * Ejemplo:
 *   validate(rules.transaction.create)
 */
export const validate = (fieldRules) => (req, res, next) => {
  const errors = [];

  for (const [field, fieldRuleList] of Object.entries(fieldRules)) {
    const value = req.body[field];

    for (const rule of fieldRuleList) {
      const error = rule(value, req.body);
      if (error) {
        errors.push(error);
        break; // solo reportar el primer error por campo
      }
    }
  }

  if (errors.length > 0) {
    return next(new ValidationError(errors));
  }

  next();
};
