import mysql from "mysql2/promise";
import "dotenv/config";

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+00:00",
  // Convierte TINYINT(1) a boolean de JS automáticamente
  typeCast: (field, next) => {
    if (field.type === "TINY" && field.length === 1)
      return field.string() === "1";
    return next();
  },
});

pool
  .getConnection()
  .then((conn) => {
    console.log("✅ Conexión a MySQL establecida");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ Error conectando a MySQL:", err.message);
    process.exit(1);
  });