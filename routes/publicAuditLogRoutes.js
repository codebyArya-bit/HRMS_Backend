import express from 'express';
import {
  getAuditLogs,
  getAuditLogById,
  getAuditLogStats
} from '../controllers/auditLogController.js';

const router = express.Router();

// Public routes - NO authentication required
// GET /api/public/audit-logs - Get all audit logs with pagination and filtering
router.get('/', getAuditLogs);

// Get audit log statistics
router.get('/stats', getAuditLogStats);

// Get specific audit log by ID
router.get('/:id', getAuditLogById);

export default router;