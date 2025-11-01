import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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
const app = express();
const port = process.env.PORT || 3001;

// Configure CORS for production and development
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        process.env.FRONTEND_URL, 
        'https://your-frontend.vercel.app',
        'http://localhost:5173',  // Allow local dev server
        'http://localhost:5174',  // Allow local dev server (Vite fallback port)
        'http://localhost:3000',  // Allow local dev server
        'http://localhost:3001'   // Allow local dev server
      ].filter(Boolean)  // Remove undefined values
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

console.log("Gemini API Key:", process.env.GEMINI_API_KEY ? "Loaded ✅" : "❌ Not Loaded");

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
  res.send("✅ HRMS Backend API is running!");
});

// Health check endpoint for Render
app.get("/api/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.listen(port, () =>
  console.log(`🚀 Server running on http://localhost:${port}`)
);
