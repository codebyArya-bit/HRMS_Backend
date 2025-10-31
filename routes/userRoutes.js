import express from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { hasRole, hasPermission, isAdmin, isAdminOrHR } from "../middlewares/roleMiddleware.js";

const router = express.Router();

/* =========================================================
   👥 USER MANAGEMENT ROUTES
   ========================================================= */

// GET /api/users - Get all users with filtering and pagination
router.get("/", authMiddleware, hasPermission("manage_users"), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      department = "",
      role = "",
      status = "",
      sortBy = "joinDate",
      sortOrder = "desc"
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {
      AND: [
        search ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { employeeId: { contains: search, mode: "insensitive" } }
          ]
        } : {},
        department ? { department: { contains: department, mode: "insensitive" } } : {},
        role ? { role: { name: { contains: role, mode: "insensitive" } } } : {}
        // Note: status field removed as it doesn't exist in User model
      ]
    };

    // Get users with role information
    const users = await prisma.user.findMany({
      where,
      include: {
        role: {
          select: {
            id: true,
            name: true,
            permissions: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip,
      take
    });

    // Get total count for pagination
    const totalUsers = await prisma.user.count({ where });

    // Remove sensitive data for non-admin users
    const sanitizedUsers = users.map(user => {
      const userData = { ...user };
      delete userData.password;
      
      // Only admin/HR can see salary information
      const userRole = req.user.role?.name || req.user.role;
      if (!['ADMIN', 'HR'].includes(userRole)) {
        delete userData.salary;
      }

      return userData;
    });

    res.json({
      users: sanitizedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / take),
        totalUsers,
        hasNext: skip + take < totalUsers,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET /api/users/:id - Get single user by ID
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;

    // Check if user can access this data
    const requestingUserRole = requestingUser.role?.name || requestingUser.role;
    if (!['ADMIN', 'HR'].includes(requestingUserRole) && requestingUser.id !== parseInt(id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove password
    delete user.password;

    // Only admin/HR can see salary information
    const requestingUserRole2 = requestingUser.role?.name || requestingUser.role;
    if (!['ADMIN', 'HR'].includes(requestingUserRole2)) {
      delete user.salary;
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// POST /api/users - Create new user (Admin/HR only)
router.post("/", authMiddleware, hasPermission("manage_users"), async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      employeeId,
      department,
      roleId
    } = req.body;

    // Validation
    if (!name || !email || !password || !employeeId || !roleId) {
      return res.status(400).json({ 
        error: "Name, email, password, employee ID, and role are required" 
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { employeeId }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: existingUser.email === email ? "Email already exists" : "Employee ID already exists"
      });
    }

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { id: parseInt(roleId) }
    });

    if (!role) {
      return res.status(400).json({ error: "Invalid role ID" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        employeeId,
        department,
        roleId: parseInt(roleId)
      },
      include: {
        role: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Remove password from response
    delete newUser.password;

    res.status(201).json({
      message: "User created successfully",
      user: newUser
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PUT /api/users/:id - Update user
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;
    const updateData = req.body;

    // Check permissions
    const canUpdateAnyUser = hasPermission("manage_users")(req, res, () => {});
    const isOwnProfile = requestingUser.id === parseInt(id);

    if (!canUpdateAnyUser && !isOwnProfile) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prepare update data based on permissions
    const allowedFields = isOwnProfile 
      ? ["name", "phone", "address", "dateOfBirth"] // Users can only update their own basic info
      : ["name", "email", "employeeId", "department", "position", "phone", "address", "dateOfBirth", "salary", "roleId", "status"]; // Admin/HR can update everything

    const filteredUpdateData = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredUpdateData[field] = updateData[field];
      }
    });

    // Special handling for date fields
    if (filteredUpdateData.dateOfBirth) {
      filteredUpdateData.dateOfBirth = new Date(filteredUpdateData.dateOfBirth);
    }

    // Special handling for salary
    if (filteredUpdateData.salary) {
      filteredUpdateData.salary = parseFloat(filteredUpdateData.salary);
    }

    // Special handling for roleId
    if (filteredUpdateData.roleId) {
      const role = await prisma.role.findUnique({
        where: { id: parseInt(filteredUpdateData.roleId) }
      });
      if (!role) {
        return res.status(400).json({ error: "Invalid role ID" });
      }
      filteredUpdateData.roleId = parseInt(filteredUpdateData.roleId);
    }

    // Check for email uniqueness if updating email
    if (filteredUpdateData.email && filteredUpdateData.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: filteredUpdateData.email }
      });
      if (emailExists) {
        return res.status(400).json({ error: "Email already exists" });
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: filteredUpdateData,
      include: {
        role: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Remove password from response
    delete updatedUser.password;

    res.json({
      message: "User updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /api/users/:id - Delete user (Admin only)
router.delete("/:id", authMiddleware, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;

    // Prevent self-deletion
    if (requestingUser.id === parseInt(id)) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Delete user
    await prisma.user.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// PUT /api/users/:id/password - Change user password
router.put("/:id/password", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    const requestingUser = req.user;

    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }

    // Check permissions
    const requestingUserRole3 = requestingUser.role?.name || requestingUser.role;
    const canChangeAnyPassword = ['ADMIN', 'HR'].includes(requestingUserRole3);
    const isOwnPassword = requestingUser.id === parseInt(id);

    if (!canChangeAnyPassword && !isOwnPassword) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password for own password change
    if (isOwnPassword && !canChangeAnyPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required" });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { password: hashedPassword }
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ error: "Failed to update password" });
  }
});

// GET /api/users/stats/overview - Get user statistics (Admin/HR only)
router.get("/stats/overview", authMiddleware, hasPermission("manage_users"), async (req, res) => {
  try {
    // Get basic counts
    const totalUsers = await prisma.user.count();
    const activeUsers = totalUsers; // All users in database are considered active
    const inactiveUsers = 0; // No inactive status tracking

    // Get department breakdown
    const departmentStats = await prisma.user.groupBy({
      by: ["department"],
      _count: {
        id: true
      },
      where: {
        department: {
          not: null
        }
      }
    });

    // Get role breakdown
    const roleStats = await prisma.user.groupBy({
      by: ["roleId"],
      _count: {
        id: true
      }
    });

    // Get role names separately
    const roleNames = await prisma.role.findMany({
      select: {
        id: true,
        name: true
      }
    });

    // Combine role stats with role names
    const roleStatsWithNames = roleStats.map(stat => {
      const role = roleNames.find(r => r.id === stat.roleId);
      return {
        roleId: stat.roleId,
        roleName: role ? role.name : 'Unknown',
        count: stat._count.id
      };
    });

    // Get recent hires (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentHires = await prisma.user.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });

    res.json({
      totalUsers,
      activeUsers,
      inactiveUsers,
      recentHires,
      departmentBreakdown: departmentStats.map(stat => ({
        department: stat.department,
        count: stat._count.id
      })),
      roleBreakdown: roleStatsWithNames
    });
  } catch (error) {
    console.error("Error fetching user statistics:", error);
    res.status(500).json({ error: "Failed to fetch user statistics" });
  }
});

export default router;