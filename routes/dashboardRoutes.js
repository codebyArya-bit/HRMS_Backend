import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { hasRole, isAdminOrHR, isManagerOrAbove } from '../middlewares/roleMiddleware.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get dashboard statistics based on user role
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userRole = req.user.role?.name || req.user.role;
    const userId = req.user.id;
    const userDepartment = req.user.department;

    let stats = {};

    if (userRole === 'ADMIN') {
      // Admin gets system-wide statistics
      const [
        totalEmployees,
        activeEmployees,
        totalRoles,
        departmentCount,
        openJobRoles,
        recentLogins,
        pendingApprovals
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count(), // All users are considered active
        prisma.role.count(),
        prisma.user.groupBy({ by: ['department'] }).then(result => result.length),
        prisma.job.count({ where: { status: 'OPEN' } }),
        prisma.loginActivity.count({
          where: {
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        }),
        // Mock pending approvals for now
        Promise.resolve(5)
      ]);

      stats = {
        totalEmployees,
        activeEmployees,
        inactiveEmployees: totalEmployees - activeEmployees,
        totalRoles,
        departmentCount,
        openJobRoles,
        recentLogins,
        pendingApprovals,
        systemHealth: 'Good'
      };

    } else if (userRole === 'HR') {
      // HR gets employee-focused statistics
      const [
        totalEmployees,
        activeEmployees,
        newHiresThisMonth,
        departmentCount,
        pendingOnboarding,
        activeJobs,
        newCandidates,
        hiredCandidates
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count(), // All users are considered active
        prisma.user.count({
          where: {
            joinDate: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          }
        }),
        prisma.user.groupBy({ by: ['department'] }).then(result => result.length),
        // Mock pending onboarding
        Promise.resolve(3),
        // Job and candidate statistics
        prisma.job.count({ where: { status: 'OPEN' } }),
        prisma.candidate.count({ where: { status: 'NEW' } }),
        prisma.candidate.findMany({
          where: {
            status: 'HIRED',
            dateHired: { not: null }
          },
          select: {
            dateApplied: true,
            dateHired: true
          }
        })
      ]);

      // Calculate average time to hire in days
      const timeToHireData = hiredCandidates.map(candidate => {
        const timeDiff = new Date(candidate.dateHired) - new Date(candidate.dateApplied);
        return timeDiff / (1000 * 60 * 60 * 24); // Convert to days
      });

      const avgTimeToHire = timeToHireData.length > 0 
        ? Math.round(timeToHireData.reduce((sum, days) => sum + days, 0) / timeToHireData.length)
        : 0;

      stats = {
        totalEmployees,
        activeEmployees,
        newHiresThisMonth,
        departmentCount,
        pendingOnboarding,
        employeeRetention: '94%',
        // Fields expected by HR dashboard
        activeJobs,
        newCandidates,
        avgTimeToHire: avgTimeToHire > 0 ? `${avgTimeToHire} days` : '0 days'
      };

    } else if (userRole === 'MANAGER') {
      // Manager gets team-focused statistics
      const [
        teamMembers,
        activeTeamMembers,
        departmentEmployees
      ] = await Promise.all([
        prisma.user.count({
          where: { department: userDepartment }
        }),
        prisma.user.count({
          where: { 
            department: userDepartment
          }
        }),
        prisma.user.findMany({
          where: { department: userDepartment },
          select: {
            id: true,
            name: true
          }
        })
      ]);

      stats = {
        teamMembers,
        activeTeamMembers,
        departmentEmployees,
        teamPerformance: '87%',
        pendingReviews: 2,
        upcomingDeadlines: 4
      };

    } else {
      // Employee gets personal statistics
      const employee = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          role: {
            select: { name: true, description: true }
          }
        }
      });

      stats = {
        personalInfo: {
          name: employee.name,
          department: employee.department,
          position: employee.position,
          role: employee.role.name
        },
        pendingTasks: 3,
        completedTasks: 15,
        upcomingEvents: 2,
        leaveBalance: 18
      };
    }

    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get recent activities based on user role
router.get('/activities', authMiddleware, async (req, res) => {
  try {
    const userRole = req.user.role?.name || req.user.role;
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    let activities = [];

    if (userRole === 'ADMIN' || userRole === 'HR') {
      // Get system-wide activities
      const recentLogins = await prisma.loginActivity.findMany({
        take: parseInt(limit),
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              name: true,
              department: true
            }
          }
        }
      });

      activities = recentLogins.map(login => ({
        id: login.id,
        type: 'login',
        description: `${login.user.name} logged in`,
        timestamp: login.timestamp,
        user: login.user.name,
        department: login.user.department
      }));

      // Add mock activities for demonstration
      activities.push(
        {
          id: 'mock1',
          type: 'employee_created',
          description: 'New employee John Doe added to Engineering',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          user: 'HR Admin',
          department: 'Engineering'
        },
        {
          id: 'mock2',
          type: 'role_updated',
          description: 'Manager role permissions updated',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
          user: 'System Admin',
          department: 'System'
        }
      );

    } else {
      // Get user-specific activities (mock for now)
      activities = [
        {
          id: 'user1',
          type: 'profile_updated',
          description: 'Profile information updated',
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000)
        },
        {
          id: 'user2',
          type: 'task_completed',
          description: 'Completed quarterly report',
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000)
        }
      ];
    }

    res.json(activities.slice(0, parseInt(limit)));
  } catch (error) {
    console.error('Dashboard activities error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard activities' });
  }
});

// Get department overview (Admin/HR/Manager)
router.get('/departments', authMiddleware, isManagerOrAbove, async (req, res) => {
  try {
    const userRole = req.user.role?.name || req.user.role;
    const userDepartment = req.user.department;

    let whereClause = {};
    
    // Manager can only see their own department
    if (userRole === 'MANAGER') {
      whereClause.department = userDepartment;
    }

    const departmentStats = await prisma.user.groupBy({
      by: ['department'],
      where: whereClause,
      _count: {
        id: true
      }
    });

    const departments = await Promise.all(
      departmentStats.map(async (dept) => {
        const activeCount = await prisma.user.count({
          where: {
            department: dept.department,
            ...(userRole === 'MANAGER' && { department: userDepartment })
          }
        });

        return {
          name: dept.department,
          count: dept._count.id,
          totalEmployees: dept._count.id,
          activeEmployees: activeCount
        };
      })
    );

    res.json(departments);
  } catch (error) {
    console.error('Department overview error:', error);
    res.status(500).json({ error: 'Failed to fetch department overview' });
  }
});

// Get role distribution (Admin/HR only)
router.get('/roles', authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const roleStats = await prisma.role.findMany({
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    const roles = roleStats.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      color: role.color,
      userCount: role._count.users
    }));

    res.json(roles);
  } catch (error) {
    console.error('Role distribution error:', error);
    res.status(500).json({ error: 'Failed to fetch role distribution' });
  }
});

// Get performance metrics (Manager and above)
router.get('/performance', authMiddleware, isManagerOrAbove, async (req, res) => {
  try {
    const userRole = req.user.role?.name || req.user.role;
    const userDepartment = req.user.department;

    // Mock performance data for now
    let performanceData = {
      productivity: 85,
      efficiency: 92,
      satisfaction: 88,
      retention: 94
    };

    if (userRole === 'MANAGER') {
      // Department-specific performance
      performanceData.department = userDepartment;
      performanceData.teamSize = await prisma.user.count({
        where: { department: userDepartment }
      });
    }

    res.json(performanceData);
  } catch (error) {
    console.error('Performance metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

export default router;
