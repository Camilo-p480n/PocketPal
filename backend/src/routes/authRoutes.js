import { Router } from "express";
import {
  register,
  login,
  getMe,
  googleAuth,
  googleCallback,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validate, rules } from "../middleware/validate.js";

const router = Router();
// Email / Password
router.post("/register", validate(rules.auth.register), register);
router.post("/login", validate(rules.auth.login), login);
router.get("/me", protect, getMe);
// OAuth Google
router.get("/google", googleAuth); // inicia el flujo OAuth
router.get("/google/callback", googleCallback); // callback compartido (registro y login)

export default router;
