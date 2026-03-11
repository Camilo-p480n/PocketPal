import { Router } from 'express';
import { syncManual } from "../controllers/gmailController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();
router.use(protect);

router.post("/sync", protect, syncManual);

export default router;
