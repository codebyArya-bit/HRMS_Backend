import express from "express";
import prisma from "../config/prisma.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";

const router = express.Router();

/* =========================================================
   👑 ADMIN DASHBOARD OVERVIEW
   ========================================================= */
router.get("/dashboard-stats", authMiddleware, isAdmin, async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    const jobCount = await prisma.job.count();
    const candidateCount = await prisma.candidate.count();
    const loginActivityCount = await prisma.loginActivity.count();

    res.json({
      stats: {
        totalUsers: userCount,
        totalJobs: jobCount,
        totalCandidates: candidateCount,
        totalLogins: loginActivityCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

/* =========================================================
   🧑‍💼 DEPARTMENT OVERVIEW
   ========================================================= */
router.get("/department-overview", authMiddleware, isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { department: true },
    });

    const departmentCounts = {};
    users.forEach((u) => {
      if (!u.department) return;
      departmentCounts[u.department] = (departmentCounts[u.department] || 0) + 1;
    });

    res.json({ departmentOverview: departmentCounts });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch department overview" });
  }
});

/* =========================================================
   🆕 RECENT EMPLOYEES
   ========================================================= */
router.get("/recent-employees", authMiddleware, isAdmin, async (req, res) => {
  try {
    const recent = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, role: true, department: true, createdAt: true },
    });

    res.json({ recentEmployees: recent });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch recent employees" });
  }
});

/* =========================================================
   📈 DAILY LOGIN ACTIVITY
   ========================================================= */
router.get("/activity/daily", authMiddleware, isAdmin, async (req, res) => {
  try {
    // Get login activities for the last 24 hours, grouped by hour
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const activities = await prisma.loginActivity.findMany({
      where: {
        timestamp: {
          gte: yesterday,
          lte: now
        }
      },
      select: {
        timestamp: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Group by hour
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: 0,
      users: []
    }));

    activities.forEach(activity => {
      const hour = activity.timestamp.getHours();
      hourlyData[hour].count++;
      hourlyData[hour].users.push(activity.user);
    });

    res.json({ dailyActivity: hourlyData });
  } catch (error) {
    console.error("Daily activity error:", error);
    res.status(500).json({ error: "Failed to fetch daily activity" });
  }
});

/* =========================================================
   📆 WEEKLY LOGIN ACTIVITY
   ========================================================= */
router.get("/activity/weekly", authMiddleware, isAdmin, async (req, res) => {
  try {
    // Get login activities for the last 7 days, grouped by day
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const activities = await prisma.loginActivity.findMany({
      where: {
        timestamp: {
          gte: weekAgo,
          lte: now
        }
      },
      select: {
        timestamp: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Group by day of week
    const weeklyData = Array.from({ length: 7 }, (_, i) => ({
      day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i],
      count: 0,
      users: []
    }));

    activities.forEach(activity => {
      const dayOfWeek = activity.timestamp.getDay();
      weeklyData[dayOfWeek].count++;
      weeklyData[dayOfWeek].users.push(activity.user);
    });

    res.json({ weeklyActivity: weeklyData });
  } catch (error) {
    console.error("Weekly activity error:", error);
    res.status(500).json({ error: "Failed to fetch weekly activity" });
  }
});

/* =========================================================
   📥 BULK IMPORT USERS
   ========================================================= */
router.post("/users/bulk-import", authMiddleware, isAdmin, async (req, res) => {
  try {
    const { users, fileName } = req.body;
    if (!users?.length) return res.status(400).json({ error: "No users provided" });

    let successfulRecords = 0;
    let failedRecords = 0;
    let errors = [];

    const createdUsers = [];
    
    // Process users one by one to track success/failure
    for (const user of users) {
      try {
        const createdUser = await prisma.user.create({
          data: {
            name: user.name,
            email: user.email,
            employeeId: user.employeeId,
            password: user.password, // Should be hashed in real implementation
            role: { connect: { name: user.role || "EMPLOYEE" } },
            department: user.department || null,
          },
        });
        createdUsers.push(createdUser);
        successfulRecords++;
      } catch (error) {
        failedRecords++;
        errors.push(`Failed to create user ${user.email}: ${error.message}`);
      }
    }

    // Log import with correct field names
    await prisma.importJob.create({
      data: {
        fileName: fileName || `bulk_import_${new Date().toISOString().split('T')[0]}.csv`,
        totalRecords: users.length,
        successfulRecords,
        failedRecords,
        errorsJson: errors.length > 0 ? JSON.stringify(errors) : null,
        importedById: req.user.id,
      },
    });

    res.json({ 
      message: "Bulk import completed", 
      totalRecords: users.length,
      successfulRecords,
      failedRecords,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Bulk Import Error:", error);
    res.status(500).json({ error: "Bulk import failed" });
  }
});

/* =========================================================
   📤 EXPORT USERS
   ========================================================= */
router.get("/users/export", authMiddleware, isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { 
        id: true, 
        name: true, 
        email: true, 
        employeeId: true,
        department: true, 
        joinDate: true,
        role: {
          select: {
            name: true
          }
        }
      },
    });

    // Transform the data to flatten the role
    const transformedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
      role: user.role.name,
      department: user.department,
      joinDate: user.joinDate
    }));

    // Log export job
    await prisma.exportJob.create({
      data: { 
        exportedById: req.user.id, 
        fileName: `users_export_${new Date().toISOString().split('T')[0]}.csv`,
        format: 'CSV',
        records: transformedUsers.length
      },
    });

    res.json(transformedUsers);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export users" });
  }
});

/* =========================================================
   📜 IMPORT HISTORY
   ========================================================= */
router.get("/history/imports", authMiddleware, isAdmin, async (req, res) => {
  try {
    const imports = await prisma.importJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        importedBy: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // Transform data to match frontend expectations
    const transformedImports = imports.map(importJob => ({
      id: importJob.id,
      fileName: importJob.fileName,
      date: importJob.createdAt.toISOString().split('T')[0],
      status: importJob.failedRecords > 0 ? 
        (importJob.successfulRecords > 0 ? 'partial' : 'failed') : 'completed',
      totalRecords: importJob.totalRecords,
      successfulRecords: importJob.successfulRecords,
      failedRecords: importJob.failedRecords,
      importedBy: importJob.importedBy.name,
      errors: importJob.errorsJson ? JSON.parse(importJob.errorsJson) : []
    }));

    res.json(transformedImports);
  } catch (error) {
    console.error("Import history error:", error);
    res.status(500).json({ error: "Failed to fetch import history" });
  }
});

/* =========================================================
   📜 EXPORT HISTORY
   ========================================================= */
router.get("/history/exports", authMiddleware, isAdmin, async (req, res) => {
  try {
    const exports = await prisma.exportJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        exportedBy: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // Transform data to match frontend expectations
    const transformedExports = exports.map(exportJob => ({
      id: exportJob.id,
      fileName: exportJob.fileName,
      date: exportJob.createdAt.toISOString().split('T')[0],
      format: exportJob.format,
      records: exportJob.records,
      exportedBy: exportJob.exportedBy.name,
      filters: exportJob.filtersJson ? JSON.parse(exportJob.filtersJson) : null
    }));

    res.json(transformedExports);
  } catch (error) {
    console.error("Export history error:", error);
    res.status(500).json({ error: "Failed to fetch export history" });
  }
});

export default router;
