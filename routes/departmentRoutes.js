import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Centralized department definitions (matching frontend)
const DEPARTMENTS = [
  {
    id: 'human-resources',
    name: 'Human Resources',
    code: 'HR',
    email: 'hr@company.com',
    headOfDepartment: 'Sarah Johnson',
    description: 'Human resources and talent management',
    color: 'green',
    budget: 500000,
    location: 'HQ - Floor 2'
  },
  {
    id: 'engineering',
    name: 'Engineering',
    code: 'ENG',
    email: 'engineering@company.com',
    headOfDepartment: 'John Smith',
    description: 'Software development and technical innovation',
    color: 'blue',
    budget: 2500000,
    location: 'HQ - Floor 3-5'
  },
  {
    id: 'marketing',
    name: 'Marketing',
    code: 'MKT',
    email: 'marketing@company.com',
    headOfDepartment: 'Emily Davis',
    description: 'Brand promotion and customer engagement',
    color: 'purple',
    budget: 800000,
    location: 'HQ - Floor 6'
  },
  {
    id: 'sales',
    name: 'Sales',
    code: 'SALES',
    email: 'sales@company.com',
    headOfDepartment: 'James Thompson',
    description: 'Revenue generation and client acquisition',
    color: 'orange',
    budget: 1200000,
    location: 'HQ - Floor 7'
  },
  {
    id: 'finance',
    name: 'Finance',
    code: 'FIN',
    email: 'finance@company.com',
    headOfDepartment: 'Michael Brown',
    description: 'Financial planning and accounting',
    color: 'yellow',
    budget: 600000,
    location: 'HQ - Floor 8'
  },
  {
    id: 'operations',
    name: 'Operations',
    code: 'OPS',
    email: 'operations@company.com',
    headOfDepartment: 'David Wilson',
    description: 'Business operations and process management',
    color: 'red',
    budget: 900000,
    location: 'HQ - Floor 9'
  },
  {
    id: 'customer-support',
    name: 'Customer Support',
    code: 'CS',
    email: 'support@company.com',
    headOfDepartment: 'Nicole Wilson',
    description: 'Customer service and technical support',
    color: 'teal',
    budget: 400000,
    location: 'HQ - Floor 1'
  },
  {
    id: 'product-management',
    name: 'Product Management',
    code: 'PM',
    email: 'product@company.com',
    headOfDepartment: 'Daniel Moore',
    description: 'Product strategy and development oversight',
    color: 'indigo',
    budget: 700000,
    location: 'HQ - Floor 10'
  },
  {
    id: 'quality-assurance',
    name: 'Quality Assurance',
    code: 'QA',
    email: 'qa@company.com',
    headOfDepartment: 'Stephanie Clark',
    description: 'Quality testing and assurance processes',
    color: 'pink',
    budget: 300000,
    location: 'HQ - Floor 4'
  },
  {
    id: 'management',
    name: 'Management',
    code: 'MGMT',
    email: 'management@company.com',
    headOfDepartment: 'Admin User',
    description: 'Executive leadership and strategic oversight',
    color: 'gray',
    budget: 1000000,
    location: 'HQ - Floor 11'
  }
];

// GET /api/departments - Get all departments
router.get('/', async (req, res) => {
  try {
    // Get user counts for each department
    const users = await prisma.user.findMany({
      select: {
        department: true
      }
    });

    // Calculate employee counts
    const departmentCounts = {};
    users.forEach(user => {
      if (user.department) {
        departmentCounts[user.department] = (departmentCounts[user.department] || 0) + 1;
      }
    });

    // Enhance departments with real employee counts
    const departmentsWithCounts = DEPARTMENTS.map(dept => ({
      ...dept,
      employeeCount: departmentCounts[dept.name] || 0
    }));

    res.json({
      success: true,
      data: departmentsWithCounts
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
      error: error.message
    });
  }
});

// GET /api/departments/:id - Get specific department
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const department = DEPARTMENTS.find(dept => dept.id === id || dept.name === id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Get employees in this department
    const employees = await prisma.user.findMany({
      where: {
        department: department.name
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        department: true,
        role: {
          select: {
            name: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        ...department,
        employeeCount: employees.length,
        employees
      }
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department',
      error: error.message
    });
  }
});

// GET /api/departments/stats/overview - Get department statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        department: true,
        role: {
          select: {
            name: true
          }
        }
      }
    });

    // Calculate statistics
    const stats = {
      totalDepartments: DEPARTMENTS.length,
      totalEmployees: users.length,
      departmentBreakdown: {},
      roleDistribution: {}
    };

    // Department breakdown
    users.forEach(user => {
      if (user.department) {
        stats.departmentBreakdown[user.department] = (stats.departmentBreakdown[user.department] || 0) + 1;
      }
      if (user.role?.name) {
        stats.roleDistribution[user.role.name] = (stats.roleDistribution[user.role.name] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching department stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department statistics',
      error: error.message
    });
  }
});

export default router;