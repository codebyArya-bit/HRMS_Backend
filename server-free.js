import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { promisify } from "util";
import { exec } from "child_process";
import authRoutes from "./routes/authRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import auditLogRoutes from "./routes/auditLogRoutes.js";
import publicAuditLogRoutes from "./routes/publicAuditLogRoutes.js";
import twoFactorRoutes from "./routes/twoFactorRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import candidateRoutes from "./routes/candidateRoutes.js";
import interviewRoutes from "./routes/interviewRoutes.js";
import hiringWorkflowRoutes from "./routes/hiringWorkflowRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";

dotenv.config();

// Create async version of exec
const execAsync = promisify(exec);

// Initialize Prisma with in-memory database for Free plan
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.NODE_ENV === 'production' 
        ? 'file::memory:?cache=shared' 
        : process.env.DATABASE_URL || 'file:./dev.db'
    }
  }
});

const app = express();
const port = process.env.PORT || 10000;

// Configure CORS for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, 'https://your-frontend.vercel.app']
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

console.log("Gemini API Key:", process.env.GEMINI_API_KEY ? "Loaded ✅" : "❌ Not Loaded");

// Initialize database on startup for Free plan
async function initializeDatabase() {
  if (process.env.NODE_ENV === 'production') {
    try {
      console.log("🔄 Initializing in-memory database...");
      
      // First, push schema to create tables (better for in-memory DB)
      console.log("📊 Pushing database schema...");
      await execAsync('npx prisma db push --force-reset');
      console.log("✅ Database schema pushed");
      
      // Enable foreign keys for SQLite
      await prisma.$executeRaw`PRAGMA foreign_keys = ON;`;
      
      // Ensure tables exist with explicit creation (fallback for in-memory DB)
      console.log("🔧 Ensuring tables exist...");
      try {
        // Create roles table if it doesn't exist
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            color TEXT DEFAULT 'gray',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'active'
          );
        `;
        
        // Create permissions table if it doesn't exist
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS permissions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT
          );
        `;
        
        // Create User table if it doesn't exist
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS User (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            employeeId TEXT UNIQUE,
            name TEXT NOT NULL,
            password TEXT NOT NULL,
            department TEXT,
            avatar TEXT,
            joinDate DATETIME DEFAULT CURRENT_TIMESTAMP,
            roleId INTEGER NOT NULL,
            twoFactorEnabled BOOLEAN DEFAULT 0,
            twoFactorSecret TEXT,
            twoFactorMethod TEXT,
            backupCodes TEXT,
            twoFactorSetupDate DATETIME,
            twoFactorLastUsed DATETIME,
            phone TEXT,
            FOREIGN KEY (roleId) REFERENCES roles(id)
          );
        `;
        
        console.log("✅ Tables ensured to exist");
      } catch (tableError) {
        console.log("⚠️ Table creation warning (may already exist):", tableError.message);
      }
      
      // Create default roles first
      console.log("🔑 Creating default roles...");
      const roles = [
        { name: 'ADMIN', description: 'System Administrator', color: 'red' },
        { name: 'HR', description: 'Human Resources', color: 'blue' },
        { name: 'MANAGER', description: 'Department Manager', color: 'green' },
        { name: 'EMPLOYEE', description: 'Regular Employee', color: 'gray' }
      ];
      
      for (const roleData of roles) {
        await prisma.Role.upsert({
          where: { name: roleData.name },
          update: {},
          create: roleData
        });
      }
      console.log("✅ Default roles created");
      
      // Get admin role ID
      const adminRole = await prisma.Role.findUnique({
        where: { name: 'ADMIN' }
      });
      
      // Create basic admin user if not exists
      const adminExists = await prisma.User.findFirst({
        where: { email: 'admin@hrms.com' }
      });
      
      if (!adminExists && adminRole) {
        console.log("👤 Creating default admin user...");
        await prisma.User.create({
          data: {
            email: 'admin@hrms.com',
            password: '$2b$10$rQZ9QmjytWIHq8fJvXNUyeJ.Hn8pGpxRjGJVwV8FGV4.QmjytWIHq8', // 'admin123'
            name: 'Admin User',
            roleId: adminRole.id,
            department: 'IT'
          }
        });
        console.log("✅ Default admin user created");
      }
      
      console.log("✅ Database initialized successfully");
    } catch (error) {
      console.error("❌ Database initialization failed:", error);
    }
  }
}

// ===== ROUTES =====
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/dashboard-stats", dashboardRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/public/audit-logs", publicAuditLogRoutes);
app.use("/api/2fa", twoFactorRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/hiring-workflow", hiringWorkflowRoutes);
app.use("/api/departments", departmentRoutes);

app.get("/", (req, res) => {
  res.send("✅ HRMS Backend API is running! (Free Plan - In-Memory Database)");
});

// Health check endpoint for Render
app.get("/api/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    plan: "free",
    database: "in-memory"
  });
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(port, () =>
    console.log(`🚀 Server running on http://localhost:${port} (Free Plan)`)
  );
});