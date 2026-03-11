// utils/hash.js
// Helper functions for hashing passwords and comparing them
// We NEVER store plain-text passwords - always store the hashed version

import bcrypt from "bcryptjs";

// Salt rounds: higher = more secure but slower (10-12 is a good balance)
const SALT_ROUNDS = 10;

/**
 * Hash a plain-text password
 * @param {string} password - The plain-text password to hash
 * @returns {Promise<string>} - The hashed password string
 */
export const hashPassword = async (password) => {
  // bcrypt.hash() automatically generates a salt and hashes the password
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare a plain-text password with a hashed password
 * @param {string} password - The plain-text password the user typed
 * @param {string} hash - The hashed password stored in the database
 * @returns {Promise<boolean>} - true if they match, false otherwise
 */
export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};
