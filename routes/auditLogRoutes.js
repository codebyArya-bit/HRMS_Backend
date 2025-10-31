import express from 'express';
import {
  getAuditLogs,
  getAuditLogById,
  createAuditLog,
  getAuditLogStats
} from '../controllers/auditLogController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { hasPermission } from '../middlewares/roleMiddleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

// GET /api/audit-logs - Get// Get all audit logs with pagination and filtering
router.get('/', hasPermission('view_audit_logs'), getAuditLogs);

// Get audit log statistics
router.get('/stats', hasPermission('view_audit_logs'), getAuditLogStats);

// Get specific audit log by ID
router.get('/:id', hasPermission('view_audit_logs'), getAuditLogById);

// POST /api/audit-logs - Create new audit log
router.post('/', hasPermission('manage_audit_logs'), createAuditLog);

export default router;