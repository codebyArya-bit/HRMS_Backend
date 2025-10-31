import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { 
  hasPermission, 
  hasRole, 
  canAccessUserData, 
  isAdminOrHR,
  isManagerOrAbove,
  clearPermissionsCache 
} from '../middlewares/roleMiddleware.js';

const router = express.Router();
const prisma = new PrismaClient();

// Public endpoint for Employee Directory - accessible to everyone
router.get('/directory', async (req, res) => {
  try {
    const { page = 1, limit = 50, department, search } = req.query;
    const skip = (page - 1) * limit;

    let whereClause = {
      // Only show users with EMPLOYEE role for directory
      role: { name: 'EMPLOYEE' }
    };

    // Apply filters
    if (department && department !== 'all') {
      whereClause.department = department;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        skip: parseInt(skip),
        take: parseInt(limit),
        select: {
          id: true,
          employeeId: true,
          name: true,
          email: true,
          department: true,
          phone: true,
          joinDate: true,
          role: {
            select: {
              name: true,
              description: true
            }
          }
        },
        orderBy: {
          name: 'asc'
        }
      }),
      prisma.user.count({ where: whereClause })
    ]);

    res.json({
      employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching employee directory:', error);
    res.status(500).json({ error: 'Failed to fetch employee directory' });
  }
});

// Get all employees (Admin/HR can see all, Manager can see team, Employee can see self)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, department, role, search } = req.query;
    const userRole = req.user.role?.name || req.user.role;
    const skip = (page - 1) * limit;

    let whereClause = {};

    // Role-based filtering
    if (userRole === 'EMPLOYEE') {
      whereClause.id = req.user.id;
    } else if (userRole === 'MANAGER') {
      // Manager can see their department employees
      whereClause.department = req.user.department;
    }
    // Admin and HR can see all employees (no additional filtering)

    // Apply additional filters
    if (department && (userRole === 'ADMIN' || userRole === 'HR')) {
      whereClause.department = department;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      whereClause.role = { name: role };
    }

    const [employees, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        skip: parseInt(skip),
        take: parseInt(limit),
        select: {
          id: true,
          employeeId: true,
          name: true,
          email: true,
          department: true,
          role: {
            select: {
              name: true,
              description: true,
              color: true
            }
          }
        }
      }),
      prisma.user.count({ where: whereClause })
    ]);

    res.json({
      employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get employee by ID
router.get('/:id', authMiddleware, canAccessUserData('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role?.name || req.user.role;

    const employee = await prisma.user.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        department: true,
        role: true
      }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Create new employee (Admin/HR only)
router.post('/', authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const {
      employeeId,
      name,
      email,
      password,
      department,
      position,
      phone,
      address,
      dateOfBirth,
      hireDate,
      salary,
      roleId
    } = req.body;

    // Validate required fields
    if (!employeeId || !name || !email || !password || !department || !roleId) {
      return res.status(400).json({ 
        error: 'Missing required fields: employeeId, name, email, password, department, roleId' 
      });
    }

    // Check if employee ID or email already exists
    const existingEmployee = await prisma.user.findFirst({
      where: {
        OR: [
          { employeeId },
          { email }
        ]
      }
    });

    if (existingEmployee) {
      return res.status(400).json({ 
        error: existingEmployee.employeeId === employeeId 
          ? 'Employee ID already exists' 
          : 'Email already exists' 
      });
    }

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId }
    });

    if (!role) {
      return res.status(400).json({ error: 'Invalid role ID' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create employee
    const employee = await prisma.user.create({
      data: {
        employeeId,
        name,
        email,
        password: hashedPassword,
        department,
        position,
        phone,
        address,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        hireDate: hireDate ? new Date(hireDate) : new Date(),
        salary: salary ? parseFloat(salary) : null,
        roleId
      },
      include: {
        role: {
          select: {
            name: true,
            description: true,
            color: true
          }
        }
      }
    });

    // Remove password from response
    const { password: _, ...employeeResponse } = employee;

    res.status(201).json(employeeResponse);
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Update employee (Admin/HR can update any, employees can update their own profile)
router.put('/:id', authMiddleware, canAccessUserData('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role?.name || req.user.role;
    const isOwnProfile = id === req.user.id;

    const {
      name,
      email,
      department,
      position,
      phone,
      address,
      dateOfBirth,
      salary,
      roleId,
      status
    } = req.body;

    // Prepare update data based on role permissions
    let updateData = {};

    // Fields that employees can update for themselves
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;

    // Fields only Admin/HR can update
    if ((userRole === 'ADMIN' || userRole === 'HR') && !isOwnProfile) {
      if (email !== undefined) updateData.email = email;
      if (department !== undefined) updateData.department = department;
      if (position !== undefined) updateData.position = position;
      if (salary !== undefined) updateData.salary = salary ? parseFloat(salary) : null;
      if (roleId !== undefined) updateData.roleId = roleId;
      if (status !== undefined) updateData.status = status;
    }

    // Check if email is being changed and if it already exists
    if (updateData.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: updateData.email,
          id: { not: id }
        }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Verify role exists if being updated
    if (updateData.roleId) {
      const role = await prisma.role.findUnique({
        where: { id: updateData.roleId }
      });

      if (!role) {
        return res.status(400).json({ error: 'Invalid role ID' });
      }
    }

    const updatedEmployee = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        role: {
          select: {
            name: true,
            description: true,
            color: true
          }
        }
      }
    });

    // Clear permissions cache if role was updated
    if (updateData.roleId) {
      clearPermissionsCache(id);
    }

    // Remove password from response
    const { password: _, ...employeeResponse } = updatedEmployee;

    res.json(employeeResponse);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// Delete employee (Admin only)
router.delete('/:id', authMiddleware, hasRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if employee exists
    const employee = await prisma.user.findUnique({
      where: { id }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Prevent deleting own account
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id }
    });

    // Clear permissions cache
    clearPermissionsCache(id);

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

// Get employee statistics (Admin/HR only)
router.get('/stats/overview', authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const [
      totalEmployees,
      activeEmployees,
      departmentStats,
      roleStats,
      recentHires
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count(), // All users are considered active
      prisma.user.groupBy({
        by: ['department'],
        _count: { department: true },
        orderBy: { _count: { department: 'desc' } }
      }),
      prisma.user.groupBy({
        by: ['roleId'],
        _count: { roleId: true }
      }),
      prisma.user.findMany({
        where: {
          joinDate: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        orderBy: { joinDate: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          department: true,
          joinDate: true,
          role: {
            select: { name: true }
          }
        }
      })
    ]);

    // Get role information separately
    const roles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        color: true
      }
    });

    // Combine role stats with role information
    const roleStatsWithInfo = roleStats.map(stat => {
      const role = roles.find(r => r.id === stat.roleId);
      return {
        roleId: stat.roleId,
        roleName: role ? role.name : 'Unknown',
        roleColor: role ? role.color : '#000000',
        count: stat._count.roleId
      };
    });

    res.json({
      totalEmployees,
      activeEmployees,
      inactiveEmployees: totalEmployees - activeEmployees,
      departmentStats,
      roleStats: roleStatsWithInfo,
      recentHires
    });
  } catch (error) {
    console.error('Get employee stats error:', error);
    res.status(500).json({ error: 'Failed to fetch employee statistics' });
  }
});

// Change employee password (Admin/HR can change any, employees can change their own)
router.put('/:id/password', authMiddleware, canAccessUserData('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    const userRole = req.user.role?.name || req.user.role;
    const isOwnProfile = id === req.user.id;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    // If changing own password, verify current password
    if (isOwnProfile && currentPassword) {
      const user = await prisma.user.findUnique({
        where: { id }
      });

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    // Admin/HR can change passwords without current password verification
    if (!isOwnProfile && (userRole !== 'ADMIN' && userRole !== 'HR')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;