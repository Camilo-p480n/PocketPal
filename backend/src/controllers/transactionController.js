// src/controllers/transactionController.js
// Controller delgado: extrae datos de req, llama al servicio, forma la respuesta.
// Toda la lógica de negocio y SQL está en transactionService.js.

import {transactionService} from "../services/transactionService.js";

export const getTransactions = async (req, res, next) => {
  try {
    const result = await transactionService.list(req.user.id, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await transactionService.getById(req.params.id, req.user.id);
    res.json({ success: true, data: { transaction } });
  } catch (err) { next(err); }
};

export const createTransaction = async (req, res, next) => {
  try {
    const transaction = await transactionService.create(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Transacción creada', data: { transaction } });
  } catch (err) { next(err); }
};

export const updateTransaction = async (req, res, next) => {
  try {
    const transaction = await transactionService.update(req.params.id, req.user.id, req.body);
    res.json({ success: true, message: 'Transacción actualizada', data: { transaction } });
  } catch (err) { next(err); }
};

export const deleteTransaction = async (req, res, next) => {
  try {
    await transactionService.delete(req.params.id, req.user.id);
    res.json({ success: true, message: 'Transacción eliminada' });
  } catch (err) { next(err); }
};