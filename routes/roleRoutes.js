import express from "express";
import prisma from "../config/prisma.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { hasRole, hasPermission, isAdmin, isAdminOrHR } from "../middlewares/roleMiddleware.js";
import { logAuditEvent } from "../controllers/auditLogController.js";

const router = express.Router();

/* =========================================================
   🔐 ROLE MANAGEMENT ROUTES
   ========================================================= */

// GET /api/roles - Get all roles with permissions
router.get("/", authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const roles = await prisma.Role.findMany({
      include: {
        permissions: true, // Include all permission fields
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true
          }
        },
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    });

    // Format the response
    const formattedRoles = roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      userCount: role._count.users,
      users: role.users,
      permissions: role.permissions, // Direct access to permissions array
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    }));

    res.json(formattedRoles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

// POST /api/roles/revert/:auditLogId - Revert role changes based on audit log (Admin only)
router.post("/revert/:auditLogId", authMiddleware, isAdmin, async (req, res) => {
  try {
    const { auditLogId } = req.params;

    // Validate auditLogId
    if (!auditLogId || isNaN(parseInt(auditLogId))) {
      return res.status(400).json({ error: "Invalid audit log ID" });
    }

    // Get the audit log entry
    const auditLog = await prisma.AuditLog.findUnique({
      where: { id: parseInt(auditLogId) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!auditLog) {
      return res.status(404).json({ error: "Audit log entry not found" });
    }

    // Check if this is a role management action
    if (auditLog.category !== 'ROLE_MANAGEMENT') {
      return res.status(400).json({ error: "This audit log entry is not related to role management" });
    }

    let details;
    try {
      details = typeof auditLog.details === 'string' ? JSON.parse(auditLog.details) : auditLog.details;
    } catch (error) {
      return res.status(400).json({ error: "Invalid audit log details format" });
    }

    // Validate resourceId
    if (!auditLog.resourceId || isNaN(parseInt(auditLog.resourceId))) {
      return res.status(400).json({ error: "Invalid resource ID in audit log" });
    }

    const roleId = parseInt(auditLog.resourceId);

    switch (auditLog.action) {
      case 'CREATE_ROLE':
        // Revert role creation by deleting the role
        const roleToDelete = await prisma.Role.findUnique({
          where: { id: roleId },
          include: {
            _count: {
              select: { users: true }
            }
          }
        });

        if (!roleToDelete) {
          return res.status(404).json({ error: "Role to revert not found" });
        }

        if (roleToDelete._count.users > 0) {
          return res.status(400).json({ 
            error: `Cannot revert role creation. ${roleToDelete._count.users} user(s) are currently assigned to this role.` 
          });
        }

        await prisma.Role.delete({
          where: { id: roleId }
        });

        // Log the revert action
        await logAuditEvent({
          userId: req.user.id,
          action: 'REVERT_CREATE_ROLE',
          category: 'ROLE_MANAGEMENT',
          resource: 'Role',
          resourceId: roleId.toString(),
          severity: 'WARNING',
          status: 'SUCCESS',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: {
            originalAuditLogId: auditLog.id,
            revertedRoleName: details.roleName,
            originalAction: auditLog.action,
            originalTimestamp: auditLog.timestamp
          },
          description: `Reverted role creation: deleted role "${details.roleName}" (Original action by ${auditLog.user?.name || 'Unknown'} on ${new Date(auditLog.timestamp).toLocaleString()})`
        });

        res.json({
          message: `Successfully reverted role creation: "${details.roleName}" has been deleted`,
          revertedAction: auditLog.action,
          originalTimestamp: auditLog.timestamp
        });
        break;

      case 'UPDATE_ROLE':
        // Revert role update by restoring previous values
        if (!details.changes) {
          return res.status(400).json({ error: "No change details found in audit log" });
        }

        const roleToUpdate = await prisma.Role.findUnique({
          where: { id: roleId }
        });

        if (!roleToUpdate) {
          return res.status(404).json({ error: "Role to revert not found" });
        }

        const updateData = {};
        
        // Revert name change
        if (details.changes.name) {
          updateData.name = details.changes.name.from;
        }
        
        // Revert description change
        if (details.changes.description) {
          updateData.description = details.changes.description.from;
        }

        // Revert permission changes
        if (details.changes.permissions) {
          updateData.permissions = {
            set: [], // Clear current permissions
            connect: details.changes.permissions.from.map(p => ({ id: p.id }))
          };
        }

        // Revert user assignment changes
        if (details.changes.users) {
          updateData.users = {
            set: [], // Clear current user assignments
            connect: details.changes.users.from.map(u => ({ id: u.id }))
          };
        }

        const revertedRole = await prisma.Role.update({
          where: { id: roleId },
          data: updateData,
          include: {
            permissions: {
              select: {
                id: true,
                name: true,
                description: true,
                category: true
              }
            },
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                employeeId: true
              }
            }
          }
        });

        // Log the revert action
        await logAuditEvent({
          userId: req.user.id,
          action: 'REVERT_UPDATE_ROLE',
          category: 'ROLE_MANAGEMENT',
          resource: 'Role',
          resourceId: roleId.toString(),
          severity: 'WARNING',
          status: 'SUCCESS',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: {
            originalAuditLogId: auditLog.id,
            roleName: revertedRole.name,
            revertedChanges: details.changes,
            originalAction: auditLog.action,
            originalTimestamp: auditLog.timestamp
          },
          description: `Reverted role update for "${revertedRole.name}" (Original action by ${auditLog.user?.name || 'Unknown'} on ${new Date(auditLog.timestamp).toLocaleString()})`
        });

        res.json({
          message: `Successfully reverted role update for "${revertedRole.name}"`,
          role: {
            id: revertedRole.id,
            name: revertedRole.name,
            description: revertedRole.description,
            permissions: revertedRole.permissions,
            users: revertedRole.users,
            createdAt: revertedRole.createdAt,
            updatedAt: revertedRole.updatedAt
          },
          revertedAction: auditLog.action,
          originalTimestamp: auditLog.timestamp
        });
        break;

      case 'DELETE_ROLE':
        // Revert role deletion by recreating the role
        if (!details.roleName) {
          return res.status(400).json({ error: "Role name not found in audit log details" });
        }

        // Check if a role with the same name already exists
        const existingRoleWithName = await prisma.Role.findUnique({
          where: { name: details.roleName }
        });

        if (existingRoleWithName) {
          return res.status(400).json({ 
            error: `Cannot revert role deletion. A role with name "${details.roleName}" already exists.` 
          });
        }

        const recreatedRole = await prisma.Role.create({
          data: {
            name: details.roleName,
            description: details.description || '',
            permissions: {
              connect: (details.permissions || []).map(p => ({ id: p.id }))
            }
          },
          include: {
            permissions: {
              select: {
                id: true,
                name: true,
                description: true,
                category: true
              }
            },
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                employeeId: true
              }
            }
          }
        });

        // Log the revert action
        await logAuditEvent({
          userId: req.user.id,
          action: 'REVERT_DELETE_ROLE',
          category: 'ROLE_MANAGEMENT',
          resource: 'Role',
          resourceId: recreatedRole.id.toString(),
          severity: 'INFO',
          status: 'SUCCESS',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: {
            originalAuditLogId: auditLog.id,
            recreatedRoleName: recreatedRole.name,
            originalAction: auditLog.action,
            originalTimestamp: auditLog.timestamp,
            restoredPermissions: recreatedRole.permissions.length
          },
          description: `Reverted role deletion: recreated role "${recreatedRole.name}" with ${recreatedRole.permissions.length} permissions (Original action by ${auditLog.user?.name || 'Unknown'} on ${new Date(auditLog.timestamp).toLocaleString()})`
        });

        res.json({
          message: `Successfully reverted role deletion: "${recreatedRole.name}" has been recreated`,
          role: {
            id: recreatedRole.id,
            name: recreatedRole.name,
            description: recreatedRole.description,
            permissions: recreatedRole.permissions,
            users: recreatedRole.users,
            createdAt: recreatedRole.createdAt,
            updatedAt: recreatedRole.updatedAt
          },
          revertedAction: auditLog.action,
          originalTimestamp: auditLog.timestamp
        });
        break;

      default:
        return res.status(400).json({ error: `Cannot revert action: ${auditLog.action}` });
    }

  } catch (error) {
    console.error("Error reverting role changes:", error);
    res.status(500).json({ error: "Failed to revert role changes" });
  }
});

// GET /api/roles/history/:roleId - Get role change history (Admin only)
router.get("/history/:roleId", authMiddleware, isAdmin, async (req, res) => {
  try {
    const { roleId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Get audit logs for this specific role
    const [auditLogs, total] = await Promise.all([
      prisma.AuditLog.findMany({
        where: {
          category: 'ROLE_MANAGEMENT',
          resourceId: roleId.toString()
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              employeeId: true
            }
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        skip,
        take
      }),
      prisma.AuditLog.count({
        where: {
          category: 'ROLE_MANAGEMENT',
          resourceId: roleId.toString()
        }
      })
    ]);

    // Format the audit logs
    const formattedLogs = auditLogs.map(log => {
      let details;
      try {
        details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      } catch (error) {
        details = {};
      }

      return {
        id: log.id,
        timestamp: log.timestamp,
        action: log.action,
        user: log.user,
        description: log.description,
        details: details,
        severity: log.severity,
        status: log.status,
        canRevert: ['CREATE_ROLE', 'UPDATE_ROLE', 'DELETE_ROLE'].includes(log.action) && 
                   !log.action.startsWith('REVERT_') // Don't allow reverting revert actions
      };
    });

    res.json({
      success: true,
      data: formattedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Error fetching role history:", error);
    res.status(500).json({ error: "Failed to fetch role history" });
  }
});

// GET /api/roles/audit-logs - Get all role management audit logs (Admin only)
router.get("/audit-logs", authMiddleware, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {
      category: 'ROLE_MANAGEMENT'
    };

    // Add search functionality
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [auditLogs, total] = await Promise.all([
      prisma.AuditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              employeeId: true
            }
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        skip,
        take
      }),
      prisma.AuditLog.count({ where })
    ]);

    // Format the audit logs
    const formattedLogs = auditLogs.map(log => {
      let details;
      try {
        details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      } catch (error) {
        details = {};
      }

      return {
        id: log.id,
        timestamp: log.timestamp,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        user: log.user,
        description: log.description,
        details: details,
        severity: log.severity,
        status: log.status,
        canRevert: ['CREATE_ROLE', 'UPDATE_ROLE', 'DELETE_ROLE'].includes(log.action) && 
                   !log.action.startsWith('REVERT_') // Don't allow reverting revert actions
      };
    });

    res.json({
      success: true,
      data: formattedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Error fetching role audit logs:", error);
    res.status(500).json({ error: "Failed to fetch role audit logs" });
  }
});

// --- Legacy Roles List (keeping for backward compatibility) ---
router.get("/roles", authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const roles = await prisma.Role.findMany({
      include: {
        _count: { select: { users: true } },
        permissions: { 
          select: { id: true, name: true }
        },
      },
      orderBy: { name: "asc" },
    });
    res.json(
      roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        userCount: r._count.users,
        permissions: r.permissions.map((p) => p.permission.name),
      }))
    );
  } catch (error) {
    console.error("Fetch roles error:", error);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

// GET /api/roles/:id - Get single role by ID
router.get("/:id", authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const { id } = req.params;

    const role = await prisma.Role.findUnique({
      where: { id: parseInt(id) },
      include: {
        permissions: {
          select: {
            id: true,
            name: true,
            category: true,
            description: true
          }
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            department: true
          }
        }
      }
    });

    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Format the response
    const formattedRole = {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      users: role.users,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };

    res.json(formattedRole);
  } catch (error) {
    console.error("Error fetching role:", error);
    res.status(500).json({ error: "Failed to fetch role" });
  }
});

// POST /api/roles - Create new role (Admin only)
router.post("/", authMiddleware, isAdmin, async (req, res) => {
  try {
    const { name, description, permissionIds = [], userIds = [] } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: "Role name is required" });
    }

    // Check if role already exists
    const existingRole = await prisma.Role.findUnique({
      where: { name }
    });

    if (existingRole) {
      return res.status(400).json({ error: "Role name already exists" });
    }

    // Verify all permission IDs exist
    if (permissionIds.length > 0) {
      const permissions = await prisma.Permission.findMany({
        where: {
          id: {
            in: permissionIds // Permission IDs are strings, no need to parseInt
          }
        }
      });

      if (permissions.length !== permissionIds.length) {
        return res.status(400).json({ error: "One or more permission IDs are invalid" });
      }
    }

    // Verify all user IDs exist
    if (userIds.length > 0) {
      const users = await prisma.User.findMany({
        where: {
          id: {
            in: userIds.map(id => parseInt(id))
          }
        }
      });

      if (users.length !== userIds.length) {
        return res.status(400).json({ error: "One or more user IDs are invalid" });
      }
    }

    // Create role with permissions and users
    const newRole = await prisma.Role.create({
      data: {
        name,
        description,
        permissions: {
          connect: permissionIds.map(permissionId => ({
            id: permissionId // Permission ID is a string, no need to parseInt
          }))
        },
        users: {
          connect: userIds.map(userId => ({
            id: parseInt(userId)
          }))
        }
      },
      include: {
        permissions: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true
          }
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true
          }
        }
      }
    });

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'CREATE_ROLE',
      category: 'ROLE_MANAGEMENT',
      resource: 'Role',
      resourceId: newRole.id.toString(),
      severity: 'INFO',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: {
        roleName: newRole.name,
        description: newRole.description,
        permissionIds: permissionIds,
        userIds: userIds,
        permissionCount: newRole.permissions.length,
        userCount: newRole.users.length
      },
      description: `Created new role "${newRole.name}" with ${newRole.permissions.length} permissions and ${newRole.users.length} assigned users`
    });

    // Format response
    const formattedRole = {
      id: newRole.id,
      name: newRole.name,
      description: newRole.description,
      permissions: newRole.permissions, // Direct access since it's a many-to-many relation
      users: newRole.users,
      createdAt: newRole.createdAt,
      updatedAt: newRole.updatedAt
    };

    res.status(201).json({
      message: "Role created successfully",
      role: formattedRole
    });
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({ error: "Failed to create role" });
  }
});

// PUT /api/roles/:id - Update existing role (Admin only)
router.put("/:id", authMiddleware, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissionIds = [], userIds = [] } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: "Role name is required" });
    }

    // Check if role exists and get current state for audit logging
    const existingRole = await prisma.Role.findUnique({
      where: { id: parseInt(id) },
      include: {
        permissions: {
          select: {
            id: true,
            name: true
          }
        },
        users: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!existingRole) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Check if name is taken by another role
    const roleWithSameName = await prisma.Role.findFirst({
      where: { 
        name,
        id: { not: parseInt(id) }
      }
    });

    if (roleWithSameName) {
      return res.status(400).json({ error: "Role name already exists" });
    }

    // Verify all permission IDs exist
    if (permissionIds.length > 0) {
      const permissions = await prisma.Permission.findMany({
        where: {
          id: {
            in: permissionIds // Permission IDs are strings
          }
        }
      });

      if (permissions.length !== permissionIds.length) {
        return res.status(400).json({ error: "One or more permission IDs are invalid" });
      }
    }

    // Verify all user IDs exist
    if (userIds.length > 0) {
      const users = await prisma.User.findMany({
        where: {
          id: {
            in: userIds.map(id => parseInt(id))
          }
        }
      });

      if (users.length !== userIds.length) {
        return res.status(400).json({ error: "One or more user IDs are invalid" });
      }
    }

    // Update role with permissions and users
    const updatedRole = await prisma.Role.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        permissions: {
          set: [], // Clear existing permissions
          connect: permissionIds.map(permissionId => ({
            id: permissionId
          }))
        },
        users: {
          set: [], // Clear existing user assignments
          connect: userIds.map(userId => ({
            id: parseInt(userId)
          }))
        }
      },
      include: {
        permissions: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true
          }
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true
          }
        }
      }
    });

    // Prepare audit log details
    const changes = {};
    if (existingRole.name !== name) {
      changes.name = { from: existingRole.name, to: name };
    }
    if (existingRole.description !== description) {
      changes.description = { from: existingRole.description, to: description };
    }

    const oldPermissionIds = existingRole.permissions.map(p => p.id).sort();
    const newPermissionIds = [...permissionIds].sort();
    if (JSON.stringify(oldPermissionIds) !== JSON.stringify(newPermissionIds)) {
      changes.permissions = {
        from: existingRole.permissions.map(p => ({ id: p.id, name: p.name })),
        to: updatedRole.permissions.map(p => ({ id: p.id, name: p.name }))
      };
    }

    const oldUserIds = existingRole.users.map(u => u.id).sort();
    const newUserIds = userIds.map(id => parseInt(id)).sort();
    if (JSON.stringify(oldUserIds) !== JSON.stringify(newUserIds)) {
      changes.users = {
        from: existingRole.users.map(u => ({ id: u.id, name: u.name })),
        to: updatedRole.users.map(u => ({ id: u.id, name: u.name }))
      };
    }

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'UPDATE_ROLE',
      category: 'ROLE_MANAGEMENT',
      resource: 'Role',
      resourceId: updatedRole.id.toString(),
      severity: 'INFO',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: {
        roleName: updatedRole.name,
        changes: changes,
        permissionCount: updatedRole.permissions.length,
        userCount: updatedRole.users.length
      },
      description: `Updated role "${updatedRole.name}" - ${Object.keys(changes).length} changes made`
    });

    // Format response
    const formattedRole = {
      id: updatedRole.id,
      name: updatedRole.name,
      description: updatedRole.description,
      permissions: updatedRole.permissions,
      users: updatedRole.users,
      createdAt: updatedRole.createdAt,
      updatedAt: updatedRole.updatedAt
    };

    res.json({
      message: "Role updated successfully",
      role: formattedRole
    });
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ error: "Failed to update role" });
  }
});

// DELETE /api/roles/:id - Delete role (Admin only)
router.delete("/:id", authMiddleware, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if role exists and get details for audit logging
    const existingRole = await prisma.Role.findUnique({
      where: { id: parseInt(id) },
      include: {
        permissions: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    if (!existingRole) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Check if role has users assigned
    if (existingRole._count.users > 0) {
      return res.status(400).json({ 
        error: `Cannot delete role. ${existingRole._count.users} user(s) are assigned to this role.` 
      });
    }

    // Delete the role (permissions will be automatically disconnected due to the relation)
    await prisma.Role.delete({
      where: { id: parseInt(id) }
    });

    // Log audit event
    await logAuditEvent({
      userId: req.user.id,
      action: 'DELETE_ROLE',
      category: 'ROLE_MANAGEMENT',
      resource: 'Role',
      resourceId: id.toString(),
      severity: 'WARNING',
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: {
        roleName: existingRole.name,
        description: existingRole.description,
        permissionCount: existingRole.permissions.length,
        permissions: existingRole.permissions.map(p => ({ id: p.id, name: p.name }))
      },
      description: `Deleted role "${existingRole.name}" with ${existingRole.permissions.length} permissions`
    });

    res.json({
      message: "Role deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({ error: "Failed to delete role" });
  }
});

// GET /api/roles/stats/overview - Get role statistics (Admin/HR only)
router.get("/stats/overview", authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    // Get role distribution
    const roleStats = await prisma.Role.findMany({
      include: {
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    });

    // Get total roles and permissions
    const totalRoles = await prisma.Role.count();
    const totalPermissions = await prisma.Permission.count();

    // Get most assigned role
    const mostAssignedRole = roleStats.reduce((max, role) => 
      role._count.users > (max?._count?.users || 0) ? role : max, null
    );

    res.json({
      totalRoles,
      totalPermissions,
      mostAssignedRole: mostAssignedRole ? {
        name: mostAssignedRole.name,
        userCount: mostAssignedRole._count.users
      } : null,
      roleDistribution: roleStats.map(role => ({
        id: role.id,
        name: role.name,
        userCount: role._count.users,
        percentage: totalRoles > 0 ? Math.round((role._count.users / totalRoles) * 100) : 0
      }))
    });
  } catch (error) {
    console.error("Error fetching role statistics:", error);
    res.status(500).json({ error: "Failed to fetch role statistics" });
  }
});

/* =========================================================
   🔑 PERMISSION MANAGEMENT ROUTES
   ========================================================= */

// --- Permissions List ---
router.get("/permissions", authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const permissions = await prisma.Permission.findMany({
      include: {
        _count: {
          select: {
            roles: true
          }
        }
      },
      orderBy: { name: "asc" },
    });

    const formattedPermissions = permissions.map(permission => ({
      id: permission.id,
      name: permission.name,
      description: permission.description,
      category: permission.category,
      roleCount: permission._count.roles,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt
    }));

    res.json(formattedPermissions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});

export default router;
