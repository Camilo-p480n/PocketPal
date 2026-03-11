import { Router } from "express";
import {
  getGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  // allocateToGoal,
  addContribution,
  completeGoal,
} from "../controllers/goalController.js";
import { validate, rules } from "../middleware/validate.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();
router.use(protect)
router.get('/', getGoals);
router.get('/:id', getGoalById);
router.post('/', validate(rules.goal.create), createGoal);
router.put('/:id', validate(rules.goal.update), updateGoal);
router.delete('/:id', deleteGoal);
// router.post('/:id/allocations', validate(rules.goal.allocate), allocateToGoal);
//Rutas al completar las metas
router.post("/:goalId/contribute", protect, addContribution);
router.post("/:goalId/complete", protect, completeGoal);

export default router;
