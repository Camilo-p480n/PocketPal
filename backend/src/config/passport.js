import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { pool } from "./db.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    // En passport.js - aquí está la lógica real
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const avatar = profile.photos?.[0]?.value || null;

        // 1️⃣ ¿Ya existe por google_id? → es un login
        const [byGoogleId] = await pool.execute(
          "SELECT * FROM users WHERE google_id = ?",
          [googleId],
        );

        if (byGoogleId.length > 0) {
          console.log("✅ Login - usuario existente por google_id");

          // Refrescar accessToken, conservar refreshToken si Google no lo reenvió
          await pool.execute(
            `UPDATE users 
         SET google_access_token = ?, 
             google_refresh_token = ?
         WHERE id = ?`,
            [
              accessToken,
              refreshToken ?? byGoogleId[0].google_refresh_token, // conserva si es null
              byGoogleId[0].id,
            ],
          );
          return done(null, { ...byGoogleId[0], isNewUser: false }); // 👈 flag
        }

        // 2️⃣ ¿Existe por email? → tenía cuenta normal, vincular Google
        const [byEmail] = await pool.execute(
          "SELECT * FROM users WHERE email = ?",
          [email],
        );

        if (byEmail.length > 0) {
          console.log("✅ Login - vinculando google_id a cuenta existente");

          await pool.execute(
            `UPDATE users 
         SET google_id = ?, avatar = ?, 
             google_access_token = ?, google_refresh_token = ?
         WHERE id = ?`,
            [googleId, avatar, accessToken, refreshToken, byEmail[0].id],
          );
          return done(null, { ...byEmail[0], isNewUser: false }); // 👈 flag
        }

        // 3️⃣ No existe → es un registro nuevo
        console.log("✅ Registro - usuario nuevo");

        const [result] = await pool.execute(
          `INSERT INTO users 
        (name, email, google_id, avatar, google_access_token, google_refresh_token) 
       VALUES (?, ?, ?, ?, ?, ?)`,
          [name, email, googleId, avatar, accessToken, refreshToken],
        );

        const [[newUser]] = await pool.execute(
          "SELECT * FROM users WHERE id = ?",
          [result.insertId],
        );

        return done(null, { ...newUser, isNewUser: true }); // 👈 flag
      } catch (error) {
        console.error("Error en Google Strategy:", error);
        return done(error, null);
      }
    },
  ),
);

export default passport;

/*
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback'
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const [rows] = await db.query('SELECT * FROM users WHERE google_id = ? OR email = ?', 
      [profile.id, email]);

    if (rows.length > 0) {
      // Usuario existe → actualizar google_id si no lo tiene
      if (!rows[0].google_id) {
        await db.query('UPDATE users SET google_id = ?, avatar = ? WHERE id = ?', 
          [profile.id, profile.photos[0].value, rows[0].id]);
      }
      return done(null, rows[0]);
    }

    // Usuario nuevo → crear
    const [result] = await db.query(
      'INSERT INTO users (name, email, google_id, avatar) VALUES (?, ?, ?, ?)',
      [profile.displayName, email, profile.id, profile.photos[0].value]
    );

    const [newUser] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    return done(null, newUser[0]);

  } catch (error) {
    return done(error, null);
  }
}));

module.exports = passport;
*/
