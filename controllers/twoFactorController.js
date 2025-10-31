import { PrismaClient } from '@prisma/client';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Generate backup codes
const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
};

// Setup 2FA for a user
const setup2FA = async (req, res) => {
  try {
    const userId = req.user.id;
    const { method = 'totp' } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is already enabled for this user' });
    }

    // Generate secret for TOTP
    const secret = speakeasy.generateSecret({
      name: `HRMS (${user.email})`,
      issuer: 'HRMS System',
      length: 32
    });

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store the secret temporarily (not enabled yet)
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret.base32,
        twoFactorMethod: method,
        backupCodes: JSON.stringify(backupCodes),
        twoFactorSetupDate: new Date()
      }
    });

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      backupCodes: backupCodes,
      manualEntryKey: secret.base32
    });
  } catch (error) {
    console.error('Setup 2FA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify and enable 2FA
const verify2FA = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Get user with secret
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'No 2FA setup found' });
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow some time drift
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    // Enable 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorLastUsed: new Date()
      }
    });

    res.json({ message: '2FA enabled successfully' });
  } catch (error) {
    console.error('Verify 2FA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Disable 2FA
const disable2FA = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, password } = req.body;

    if (!token && !password) {
      return res.status(400).json({ error: 'Token or password is required' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    let verified = false;

    // Verify with 2FA token if provided
    if (token && user.twoFactorSecret) {
      verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 2
      });
    }

    // If token verification failed, check backup codes
    if (!verified && token && user.backupCodes) {
      const backupCodes = JSON.parse(user.backupCodes);
      const codeIndex = backupCodes.indexOf(token.toUpperCase());
      if (codeIndex !== -1) {
        // Remove used backup code
        backupCodes.splice(codeIndex, 1);
        await prisma.user.update({
          where: { id: userId },
          data: { backupCodes: JSON.stringify(backupCodes) }
        });
        verified = true;
      }
    }

    if (!verified) {
      return res.status(400).json({ error: 'Invalid token or password' });
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorMethod: null,
        backupCodes: null,
        twoFactorSetupDate: null,
        twoFactorLastUsed: null
      }
    });

    // Remove all 2FA devices
    await prisma.twoFactorDevice.deleteMany({
      where: { userId: userId }
    });

    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get 2FA status
const get2FAStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        twoFactorMethod: true,
        twoFactorSetupDate: true,
        twoFactorLastUsed: true,
        backupCodes: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const backupCodes = user.backupCodes ? JSON.parse(user.backupCodes) : [];

    res.json({
      enabled: user.twoFactorEnabled,
      method: user.twoFactorMethod,
      setupDate: user.twoFactorSetupDate,
      lastUsed: user.twoFactorLastUsed,
      backupCodesCount: backupCodes.length
    });
  } catch (error) {
    console.error('Get 2FA status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Generate new backup codes
const generateNewBackupCodes = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    // Generate new backup codes
    const newBackupCodes = generateBackupCodes();

    // Update user with new backup codes
    await prisma.user.update({
      where: { id: userId },
      data: {
        backupCodes: JSON.stringify(newBackupCodes)
      }
    });

    res.json({ backupCodes: newBackupCodes });
  } catch (error) {
    console.error('Generate backup codes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify 2FA token (for login)
const verifyToken = async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ error: 'User ID and token are required' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    let verified = false;

    // Try TOTP verification first
    if (user.twoFactorSecret) {
      verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 2
      });
    }

    // If TOTP failed, try backup codes
    if (!verified && user.backupCodes) {
      const backupCodes = JSON.parse(user.backupCodes);
      const codeIndex = backupCodes.indexOf(token.toUpperCase());
      if (codeIndex !== -1) {
        // Remove used backup code
        backupCodes.splice(codeIndex, 1);
        await prisma.user.update({
          where: { id: userId },
          data: { 
            backupCodes: JSON.stringify(backupCodes),
            twoFactorLastUsed: new Date()
          }
        });
        verified = true;
      }
    }

    if (verified) {
      // Update last used timestamp
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorLastUsed: new Date() }
      });
    }

    res.json({ verified });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get 2FA statistics (for admin)
const get2FAStats = async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const usersWithTwoFactor = await prisma.user.count({
      where: { twoFactorEnabled: true }
    });

    const recentSetups = await prisma.user.count({
      where: {
        twoFactorEnabled: true,
        twoFactorSetupDate: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });

    const methodStats = await prisma.user.groupBy({
      by: ['twoFactorMethod'],
      where: { twoFactorEnabled: true },
      _count: true
    });

    res.json({
      totalUsers,
      usersWithTwoFactor,
      adoptionRate: totalUsers > 0 ? (usersWithTwoFactor / totalUsers * 100).toFixed(2) : 0,
      recentSetups,
      methodStats: methodStats.reduce((acc, stat) => {
        acc[stat.twoFactorMethod || 'unknown'] = stat._count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Get 2FA stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all users with their 2FA status (for admin)
const getAllUsers2FAStatus = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = "",
      department = "",
      twoFactorEnabled = ""
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
        twoFactorEnabled !== "" ? { twoFactorEnabled: twoFactorEnabled === "true" } : {}
      ]
    };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        department: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        twoFactorSetupDate: true,
        twoFactorLastUsed: true,
        joinDate: true,
        role: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      },
      skip,
      take
    });

    const totalUsers = await prisma.user.count({ where });

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / take),
        totalUsers,
        hasNext: skip + take < totalUsers,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get users 2FA status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: Enable 2FA for a user
const adminEnable2FA = async (req, res) => {
  try {
    const { userId } = req.params;
    const { method = 'totp' } = req.body;

    // Convert userId to integer
    const userIdInt = parseInt(userId, 10);
    if (isNaN(userIdInt)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userIdInt }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: 'User already has 2FA enabled' });
    }

    // Generate secret and setup 2FA
    const secret = speakeasy.generateSecret({
      name: `HRMS (${user.email})`,
      issuer: 'HRMS System'
    });

    // Update user with 2FA details
    await prisma.user.update({
      where: { id: userIdInt },
      data: {
        twoFactorSecret: secret.base32,
        twoFactorMethod: method,
        twoFactorEnabled: true,
        twoFactorSetupDate: new Date()
      }
    });

    res.json({
      message: '2FA enabled for user successfully',
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url
    });
  } catch (error) {
    console.error('Admin enable 2FA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: Disable 2FA for a user
const adminDisable2FA = async (req, res) => {
  try {
    const { userId } = req.params;

    // Convert userId to integer
    const userIdInt = parseInt(userId, 10);
    if (isNaN(userIdInt)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userIdInt }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: 'User does not have 2FA enabled' });
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: userIdInt },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorMethod: null,
        twoFactorSetupDate: null,
        twoFactorLastUsed: null
      }
    });

    // Remove all 2FA devices
    await prisma.twoFactorDevice.deleteMany({
      where: { userId: userIdInt }
    });

    res.json({ message: '2FA disabled for user successfully' });
  } catch (error) {
    console.error('Admin disable 2FA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export {
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
};