import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { hasPermission } from '../middlewares/roleMiddleware.js';
import {
  setup2FA,
  verify2FA,
  disable2FA,
  get2FAStatus,
  generateNewBackupCodes,
  verifyToken,
  get2FAStats,
  getAllUsers2FAStatus,
  adminEnable2FA,
  adminDisable2FA
} from '../controllers/twoFactorController.js';

const router = express.Router();

// User routes (require authentication)
router.post('/setup', authMiddleware, setup2FA);
router.post('/verify', authMiddleware, verify2FA);
router.post('/disable', authMiddleware, disable2FA);
router.get('/status', authMiddleware, get2FAStatus);
router.post('/backup-codes', authMiddleware, generateNewBackupCodes);

// Public route for token verification during login
router.post('/verify-token', verifyToken);

// Admin routes (require admin permissions)
router.get('/stats', authMiddleware, hasPermission('manage_users'), get2FAStats);
router.get('/users', authMiddleware, hasPermission('manage_users'), getAllUsers2FAStatus);
router.post('/admin/enable/:userId', authMiddleware, hasPermission('manage_users'), adminEnable2FA);
router.post('/admin/disable/:userId', authMiddleware, hasPermission('manage_users'), adminDisable2FA);

export default router;