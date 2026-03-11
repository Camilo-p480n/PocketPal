// src/routes/transactionRoutes.js
import { Router } from "express";
import { getTransactions, getTransactionById, createTransaction, updateTransaction, deleteTransaction } from "../controllers/transactionController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validate, rules } from "../middleware/validate.js";

const router = Router();

router.use(protect);

router.get("/", getTransactions);
router.get("/:id", getTransactionById);
router.post("/", validate(rules.transaction.create), createTransaction);
router.put("/:id", validate(rules.transaction.update), updateTransaction);
router.delete("/:id", deleteTransaction);

export default router;