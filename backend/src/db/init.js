import {pool} from "../config/db.js";

// Tablas en orden de dependencias (FK)
const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    google_id varchar(255) unique null,
    avatar varchar(500) null,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS categories (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) UNIQUE NOT NULL,
    type       ENUM('income','expense') NOT NULL,
    user_id    INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS transactions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    category_id INT NOT NULL,
    type        ENUM('income', 'expense', 'saving') NOT NULL,
    amount      DECIMAL(12,2) NOT NULL,
    description TEXT,
    date        DATE NOT NULL DEFAULT (CURRENT_DATE),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tx_user_date (user_id, date DESC),
    INDEX idx_tx_user_type (user_id, type),
    CONSTRAINT fk_tx_user     FOREIGN KEY (user_id)     REFERENCES users(id)       ON DELETE CASCADE,
    CONSTRAINT fk_tx_category FOREIGN KEY (category_id) REFERENCES categories(id),
    CONSTRAINT chk_tx_amount  CHECK (amount > 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS goals (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    title          VARCHAR(200) UNIQUE NOT NULL,
    target_amount  DECIMAL(12,2) NOT NULL,
    current_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    is_completed   TINYINT(1) NOT NULL DEFAULT 0,
    completed_at   TIMESTAMP NULL DEFAULT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_goal_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_goal_amount CHECK (target_amount > 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS goal_allocations (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    goal_id    INT NOT NULL,
    amount     DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_alloc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_alloc_goal FOREIGN KEY (goal_id) REFERENCES goals(id)  ON DELETE CASCADE,
    CONSTRAINT chk_alloc_amount CHECK (amount > 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS ai_chat_history (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    role       ENUM('user','assistant') NOT NULL,
    content    TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_chat_user (user_id, created_at DESC),
    CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

const DEFAULT_CATEGORIES = [
  { name: "Salario", type: "income" },
  { name: "Freelance", type: "income" },
  { name: "Inversiones", type: "income" },
  { name: "Bonos", type: "income" },
  { name: "Ventas", type: "income" },
  { name: "Otros ingresos", type: "income" },
  { name: "Alimentación", type: "expense" },
  { name: "Transporte", type: "expense" },
  { name: "Arriendo", type: "expense" },
  { name: "Entretenimiento", type: "expense" },
  { name: "Salud", type: "expense" },
  { name: "Educación", type: "expense" },
  { name: "Ropa", type: "expense" },
  { name: "Servicios", type: "expense" },
  { name: "Tecnología", type: "expense" },
  { name: "Restaurantes", type: "expense" },
  { name: "Supermercado", type: "expense" },
  { name: "Otros gastos", type: "expense" },
];

export const initializeDatabase = async () => {
  console.log("🗄️  Inicializando base de datos MySQL...");

  // Crear tablas una por una (mysql2 no soporta múltiples statements en execute())
  for (const sql of TABLES) {
    await pool.execute(sql);
  }
  console.log("✅ Tablas e indices creados/verificados");

  for (const cat of DEFAULT_CATEGORIES) {
    await pool.execute(
      `INSERT INTO categories (name, type, user_id)
       SELECT ?, ?, NULL FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1 FROM categories WHERE name = ? AND type = ? AND user_id IS NULL
       )`,
      [cat.name, cat.type, cat.name, cat.type],
    );
  }
  console.log("✅ Categorías globales verificadas");
};