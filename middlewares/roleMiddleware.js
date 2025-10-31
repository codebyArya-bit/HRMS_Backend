import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cache for role permissions to avoid repeated database queries
const rolePermissionsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Middleware to check if user has specific role
 * @param {string|string[]} allowedRoles - Single role or array of roles
 */
export const hasRole = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role?.name || req.user.role;
    
    if (roles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({ 
      error: 'Access denied. Insufficient role permissions.',
      required: roles,
      current: userRole
    });
  };
};

/**
 * Middleware to check if user has specific permission
 * @param {string|string[]} requiredPermissions - Single permission or array of permissions
 * @param {boolean} requireAll - If true, user must have ALL permissions. If false, user needs ANY permission
 */
export const hasPermission = (requiredPermissions, requireAll = true) => {
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const userId = req.user.id;
      const cacheKey = `user_${userId}_permissions`;
      
      // Check cache first
      let userPermissions = rolePermissionsCache.get(cacheKey);
      
      if (!userPermissions || Date.now() - userPermissions.timestamp > CACHE_TTL) {
        // Fetch user with role and permissions
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            role: {
              include: {
                permissions: true
              }
            }
          }
        });

        if (!user || !user.role) {
          return res.status(403).json({ error: 'User role not found' });
        }

        userPermissions = {
          permissions: user.role.permissions.map(p => p.id),
          timestamp: Date.now()
        };
        
        rolePermissionsCache.set(cacheKey, userPermissions);
      }

      const hasRequiredPermissions = requireAll 
        ? permissions.every(perm => userPermissions.permissions.includes(perm))
        : permissions.some(perm => userPermissions.permissions.includes(perm));

      if (hasRequiredPermissions) {
        return next();
      }

      return res.status(403).json({ 
        error: 'Access denied. Insufficient permissions.',
        required: permissions,
        requireAll,
        userPermissions: userPermissions.permissions
      });

    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Internal server error during permission check' });
    }
  };
};

/**
 * Middleware to check if user can access their own data or has admin privileges
 * @param {string} userIdParam - The parameter name containing the user ID to check
 */
export const canAccessUserData = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const targetUserId = req.params[userIdParam] || req.body[userIdParam] || req.query[userIdParam];
    const currentUserId = req.user.id;
    const userRole = req.user.role?.name || req.user.role;

    // Admin can access any user's data
    if (userRole === 'ADMIN') {
      return next();
    }

    // HR can access employee data
    if (userRole === 'HR' && targetUserId !== currentUserId) {
      return next();
    }

    // Manager can access their team members' data (this would need additional logic for team relationships)
    if (userRole === 'MANAGER' && targetUserId !== currentUserId) {
      // TODO: Add team relationship check
      return next();
    }

    // Users can access their own data
    if (targetUserId === currentUserId) {
      return next();
    }

    return res.status(403).json({ 
      error: 'Access denied. You can only access your own data or you lack sufficient privileges.' 
    });
  };
};

/**
 * Middleware to check if user belongs to specific department
 * @param {string|string[]} allowedDepartments - Single department or array of departments
 */
export const hasDepartmentAccess = (allowedDepartments) => {
  const departments = Array.isArray(allowedDepartments) ? allowedDepartments : [allowedDepartments];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userDepartment = req.user.department;
    const userRole = req.user.role?.name || req.user.role;

    // Admin can access all departments
    if (userRole === 'ADMIN') {
      return next();
    }

    if (departments.includes(userDepartment)) {
      return next();
    }

    return res.status(403).json({ 
      error: 'Access denied. Department access required.',
      required: departments,
      current: userDepartment
    });
  };
};

/**
 * Clear permissions cache for a specific user or all users
 * @param {string} userId - Optional user ID to clear cache for specific user
 */
export const clearPermissionsCache = (userId = null) => {
  if (userId) {
    rolePermissionsCache.delete(`user_${userId}_permissions`);
  } else {
    rolePermissionsCache.clear();
  }
};

// Export individual role checkers for convenience
export const isAdmin = hasRole('ADMIN');
export const isHR = hasRole('HR');
export const isManager = hasRole('MANAGER');
export const isEmployee = hasRole('EMPLOYEE');

// Export combined role checkers
export const isAdminOrHR = hasRole(['ADMIN', 'HR']);
export const isManagerOrAbove = hasRole(['ADMIN', 'HR', 'MANAGER']);