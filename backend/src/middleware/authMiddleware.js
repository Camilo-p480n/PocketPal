// middleware/authMiddleware.js
// This middleware protects routes that require the user to be logged in.
// It runs BEFORE the actual route handler and checks the JWT token.

import { verifyToken } from "../utils/jwt.js";

/**
 * Middleware to verify a user is authenticated via JWT
 *
 * How it works:
 * 1. Client sends requests with an Authorization header: "Bearer <token>"
 * 2. We extract the token from the header
 * 3. We verify the token is valid and not expired
 * 4. We attach the decoded user info to req.user so controllers can use it
 * 5. If anything fails, we return a 401 Unauthorized error
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Call next() to proceed to the route handler
 */
export const protect = (req, res, next) => {
  try {
    // Get the Authorization header value (e.g. "Bearer eyJhbGci...")
    const authHeader = req.headers.authorization;

    // Check the header exists and starts with "Bearer "
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please log in.',
      });
    }

    // Extract just the token part after "Bearer "
    // authHeader.split(' ') gives ['Bearer', '<token>']
    const token = authHeader.split(' ')[1];

    // Verify the token - this throws an error if it's invalid or expired
    const decoded = verifyToken(token);

    // Attach the decoded user payload to the request object
    // Controllers can access req.user.id to know which user made the request
    req.user = decoded;

    // Token is valid - proceed to the actual route handler
    next();
  } catch (error) {
    // Token was invalid, expired, or tampered with
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please log in again.',
    });
  }
};
