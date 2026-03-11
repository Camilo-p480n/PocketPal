// routes/summaryRoutes.js
import { Route, Router } from "express";
import {
  getSummary,
  getGoalsOverview,
} from "../controllers/summaryController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();
router.use(protect);

router.get("/", getSummary);
router.get("/goals", getGoalsOverview);

export default router;
