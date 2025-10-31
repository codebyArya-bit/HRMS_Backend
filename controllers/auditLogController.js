import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get all audit logs with pagination and filtering
const getAuditLogs = async (req, res) => {
  try {
    console.log('🔍 GET /api/audit-logs called by user:', req.user);
    console.log('🔍 Query parameters:', req.query);
    
    const { 
      page = 1, 
      limit = 10, 
      category, 
      severity, 
      status, 
      startDate, 
      endDate,
      search 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};
    
    if (category) where.category = category;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
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
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      success: true,
      data: auditLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message
    });
  }
};

// Get audit log by ID
const getAuditLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const auditLog = await prisma.auditLog.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true
          }
        }
      }
    });

    if (!auditLog) {
      return res.status(404).json({
        success: false,
        message: 'Audit log not found'
      });
    }

    res.json({
      success: true,
      data: auditLog
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit log',
      error: error.message
    });
  }
};

// Create audit log entry
const createAuditLog = async (req, res) => {
  try {
    const {
      userId,
      action,
      category,
      resource,
      severity = 'INFO',
      status = 'SUCCESS',
      ipAddress,
      userAgent,
      details,
      description
    } = req.body;

    const auditLog = await prisma.auditLog.create({
      data: {
        userId: parseInt(userId),
        action,
        category,
        resource,
        severity,
        status,
        ipAddress,
        userAgent,
        details,
        description
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
      }
    });

    res.status(201).json({
      success: true,
      data: auditLog,
      message: 'Audit log created successfully'
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create audit log',
      error: error.message
    });
  }
};

// Helper function to log audit events (for use in other controllers)
const logAuditEvent = async (data) => {
  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        category: data.category || 'SYSTEM',
        resource: data.resource,
        severity: data.severity || 'INFO',
        status: data.status || 'SUCCESS',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        details: data.details ? JSON.stringify(data.details) : null,
        description: data.description
      }
    });
    return auditLog;
  } catch (error) {
    console.error('Error logging audit event:', error);
    // Don't throw error to avoid breaking the main operation
    return null;
  }
};

// Get audit log statistics
const getAuditLogStats = async (req, res) => {
  try {
    console.log('🔍 GET /api/audit-logs/stats called by user:', req.user);
    console.log('🔍 Stats query parameters:', req.query);
    
    const { startDate, endDate } = req.query;
    
    const where = {};
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [
      totalLogs,
      categoryCounts,
      severityCounts,
      statusCounts,
      recentActivity
    ] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({
        by: ['category'],
        where,
        _count: { category: true }
      }),
      prisma.auditLog.groupBy({
        by: ['severity'],
        where,
        _count: { severity: true }
      }),
      prisma.auditLog.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      }),
      prisma.auditLog.findMany({
        where,
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalLogs,
        categoryCounts: categoryCounts.reduce((acc, item) => {
          acc[item.category] = item._count.category;
          return acc;
        }, {}),
        severityCounts: severityCounts.reduce((acc, item) => {
          acc[item.severity] = item._count.severity;
          return acc;
        }, {}),
        statusCounts: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {}),
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error fetching audit log stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit log statistics',
      error: error.message
    });
  }
};

export {
  getAuditLogs,
  getAuditLogById,
  createAuditLog,
  logAuditEvent,
  getAuditLogStats
};