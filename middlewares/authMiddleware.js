import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

/**
 * 🔐 Middleware: Authenticates and attaches user info to req.user
 */
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 1️⃣ Check header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("🚫 Missing or invalid Authorization header");
      return res.status(401).json({ error: "Unauthorized - No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // 2️⃣ Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    console.log("🔍 JWT decoded payload:", decoded);

    // 3️⃣ Find user from DB
    const user = await prisma.User.findUnique({
      where: { id: decoded.id },
      include: { role: true },
    });

    if (!user) {
      console.warn("⚠️ No user found for token ID:", decoded.id);
      return res.status(404).json({ error: "User not found" });
    }

    // 4️⃣ Attach to req
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
      role: user.role?.name || "UNKNOWN",
    };

    console.log("✅ Authenticated user:", req.user);

    // Proceed to next middleware / route
    next();
  } catch (error) {
    console.error("🔥 Auth middleware error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired, please login again" });
    }

    res.status(401).json({ error: "Invalid or missing token" });
  }
};
