// src/controllers/authController.js
import passport from "../config/passport.js";
import jwt from "jsonwebtoken";
import { authService } from "../services/authService.js";

// ─── Email / Password ────────────────────────────────────────────────────────

export const register = async (req, res, next) => {
  try {
    const { user, token } = await authService.register(req.body);
    res
      .status(201)
      .json({ success: true, message: "Cuenta creada", data: { user, token } });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { user, token } = await authService.login(req.body);
    res.json({
      success: true,
      message: "Sesión iniciada",
      data: { user, token },
    });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};

// ─── Google OAuth 2.0 ─────────────────────────────────────────────────────────

export const googleAuth = async (req, res, next) => {
  try {
    const emailHint = req.query.login_hint;

    // Si viene el email, revisamos si ya tiene token para elegir el prompt correcto
    const isExistingUser = emailHint
      ? await authService.hasGoogleToken(emailHint)
      : false;

    return passport.authenticate("google", {
      scope: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/gmail.readonly",
      ],
      session: false,
      accessType: "offline",
      // Aquí se decide si se registra o se hace login
      prompt: isExistingUser ? "select_account" : "consent",
    })(req, res, next);
  } catch (err) {
    next(err);
  }
};

// Callback compartido para registro y login
export const googleCallback = [
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/frontend/index.html?error=oauth_failed`,
  }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    res.redirect(
      `${process.env.FRONTEND_URL}/frontend/dashboard.html` +
        `?token=${token}` +
        `&name=${encodeURIComponent(req.user.name)}` +
        `&email=${encodeURIComponent(req.user.email)}` +
        `&avatar=${encodeURIComponent(req.user.avatar ?? "")}`,
    );
  },
];
