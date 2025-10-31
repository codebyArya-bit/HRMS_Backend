import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

/* =========================================================
   🧩 REGISTER USER (Basic Test Endpoint)
   ========================================================= */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, roleId } = req.body; // use roleId not role name
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log("Registering user:", { name, email, roleId });

    const user = await prisma.User.create({
      data: { name, email, password: hashedPassword, roleId },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error("Registration Error:", error);
    res
      .status(400)
      .json({ error: "Registration failed", details: error.message });
  }
});

/* =========================================================
   🔐 LOGIN ROUTE
   ========================================================= */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("📥 Login attempt:", email);

  try {
    // Fetch user + role name
    const user = await prisma.User.findUnique({
      where: { email },
      include: { role: true }, // ✅ Include role relation
    });

    console.log("🔍 User fetched from DB:", user ? user.email : "Not found");

    if (!user) {
      // Log failed login attempt - user not found
      await prisma.AuditLog.create({
        data: {
          action: "Failed Login Attempt",
          category: "Authentication",
          resource: "User Account",
          severity: "warning",
          status: "failed",
          ipAddress: req.ip || req.connection.remoteAddress || "unknown",
          userAgent: req.get('User-Agent') || "unknown",
          description: `Failed login attempt for non-existent user: ${email}`,
          details: JSON.stringify({
            attemptedEmail: email,
            reason: "User not found",
            timestamp: new Date().toISOString()
          })
        }
      });
      return res.status(404).json({ error: "User not found" });
    }

    // Compare password
    const valid = await bcrypt.compare(password, user.password);
    console.log("🔑 Password valid:", valid);

    if (!valid) {
      // Log failed login attempt - invalid password
      await prisma.AuditLog.create({
        data: {
          userId: user.id,
          action: "Failed Login Attempt",
          category: "Authentication",
          resource: "User Account",
          resourceId: user.id.toString(),
          severity: "warning",
          status: "failed",
          ipAddress: req.ip || req.connection.remoteAddress || "unknown",
          userAgent: req.get('User-Agent') || "unknown",
          description: `Failed login attempt for user ${user.name} (${user.email}) - invalid password`,
          details: JSON.stringify({
            userId: user.id,
            userEmail: user.email,
            userName: user.name,
            reason: "Invalid password",
            timestamp: new Date().toISOString()
          })
        }
      });
      return res.status(401).json({ error: "Invalid password" });
    }

    // Generate JWT safely
    const token = jwt.sign(
      { id: user.id, role: user.role?.name },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" }
    );

    // Log login activity
    await prisma.LoginActivity.create({
      data: { userId: user.id, activity: "User logged in" },
    });

    // Create audit log entry for login
    await prisma.AuditLog.create({
      data: {
        userId: user.id,
        action: "User Login",
        category: "Authentication",
        resource: "User Account",
        resourceId: user.id.toString(),
        severity: "info",
        status: "success",
        ipAddress: req.ip || req.connection.remoteAddress || "unknown",
        userAgent: req.get('User-Agent') || "unknown",
        description: `User ${user.name} (${user.email}) logged in successfully`,
        details: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userRole: user.role?.name,
          loginTime: new Date().toISOString()
        })
      }
    });

    console.log("✅ Login success:", { user: user.email, role: user.role?.name });

    // Respond
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role?.name,
      },
    });
  } catch (error) {
    console.error("🔥 Login Error:", error);
    res
      .status(500)
      .json({ error: "Login failed", details: error.message });
  }
});

/* =========================================================
   👤 PROFILE (Protected)
   ========================================================= */
router.get("/me", authMiddleware, (req, res) => {
  console.log("🔐 Accessing /me:", req.user);
  res.json(req.user);
});

export default router;
