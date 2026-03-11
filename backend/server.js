// server.js
// Application entry point - starts the HTTP server and initializes the database

import "dotenv/config"; // Load environment variables from .env file first

import { app } from "./src/app.js";
import { initializeDatabase } from "./src/db/init.js";

const PORT = process.env.PORT;

/**
 * Start the server
 * 1. Initialize the database (create tables if they don't exist)
 * 2. Start listening for HTTP requests
 */
const startServer = async () => {
  try {
    // Initialize the database schema before accepting any requests
    console.log("Initializing database...");
    await initializeDatabase();
    console.log("Database initialized successfully");

    // Start the HTTP server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    // Exit with error code so process managers (like PM2) know to restart
    process.exit(1);
  }
};

startServer();
