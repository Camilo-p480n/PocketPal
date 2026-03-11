import { Router } from "express";
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";
import { validate, rules } from "../middleware/validate.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();
router.use(protect)
router.get("/", getCategories);
router.get("/:id", getCategoryById);
router.post("/", validate(rules.category.create), createCategory);
router.put("/:id", validate(rules.category.update), updateCategory);
router.delete("/:id", deleteCategory);

export default router;
