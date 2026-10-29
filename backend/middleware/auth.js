// middleware/auth.js
// Protects admin routes with a real JWT check. The parent view and login routes
// are deliberately NOT behind this - parents access their view via an unguessable
// token link, not a login, and you obviously can't require a token to get a token.

const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../routes/auth");

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required. Please log in." });
  }

  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

module.exports = { requireAuth };
