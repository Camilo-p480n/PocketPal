import jwt from "jsonwebtoken";

// The secret key used to sign tokens - stored in environment variables for security
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a JWT token for a user after successful login/registration
 * @param {object} payload - Data to encode in the token (usually { id, email })
 * @returns {string} - The signed JWT token string
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verify and decode a JWT token
 * @param {string} token - The JWT token to verify
 * @returns {object} - The decoded payload if valid
 * @throws {Error} - If the token is invalid or expired
 */
export const verifyToken = (token) => {
  // jwt.verify() throws an error if the token is invalid or expired
  return jwt.verify(token, JWT_SECRET);
};
