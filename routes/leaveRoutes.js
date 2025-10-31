import express from "express";
import prisma from "../config/prisma.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { hasRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

/* =========================================================
   🏖️ LEAVE REQUEST ROUTES
   ========================================================= */

// GET /api/leave - Get all leave requests (for managers/HR/admin)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const userRole = user.role?.name || user.role;

    let whereClause = {};

    // If user is an employee, only show their own requests
    if (userRole === 'EMPLOYEE') {
      whereClause.employeeId = user.id;
    }
    // Managers, HR, and Admin can see all requests
    // You can add more specific filtering logic here if needed

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            employeeId: true
          }
        }
      },
      orderBy: {
        appliedAt: 'desc'
      }
    });

    res.json(leaveRequests);
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    res.status(500).json({ error: "Failed to fetch leave requests" });
  }
});

// GET /api/leave/pending - Get pending leave requests (for managers)
router.get("/pending", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const userRole = user.role?.name || user.role;

    // Only managers, HR, and admin can view pending requests
    if (!['MANAGER', 'HR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const pendingRequests = await prisma.leaveRequest.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            employeeId: true
          }
        }
      },
      orderBy: {
        appliedAt: 'desc'
      }
    });

    res.json(pendingRequests);
  } catch (error) {
    console.error("Error fetching pending leave requests:", error);
    res.status(500).json({ error: "Failed to fetch pending leave requests" });
  }
});

// POST /api/leave - Create a new leave request
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, reason, leaveType, comments } = req.body;
    const employeeId = req.user.id;

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ error: "Start date, end date, and reason are required" });
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        leaveType: leaveType || 'ANNUAL',
        comments,
        employeeId
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            employeeId: true
          }
        }
      }
    });

    res.status(201).json(leaveRequest);
  } catch (error) {
    console.error("Error creating leave request:", error);
    res.status(500).json({ error: "Failed to create leave request" });
  }
});

// PUT /api/leave/:id/approve - Approve a leave request (managers/HR/admin only)
router.put("/:id/approve", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { managerComments } = req.body;
    const user = req.user;
    const userRole = user.role?.name || user.role;

    // Only managers, HR, and admin can approve requests
    if (!['MANAGER', 'HR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!leaveRequest) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    if (leaveRequest.status !== 'PENDING') {
      return res.status(400).json({ error: "Only pending requests can be approved" });
    }

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: {
        status: 'APPROVED',
        managerComments,
        reviewedAt: new Date()
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            employeeId: true
          }
        }
      }
    });

    res.json(updatedRequest);
  } catch (error) {
    console.error("Error approving leave request:", error);
    res.status(500).json({ error: "Failed to approve leave request" });
  }
});

// PUT /api/leave/:id/reject - Reject a leave request (managers/HR/admin only)
router.put("/:id/reject", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { managerComments } = req.body;
    const user = req.user;
    const userRole = user.role?.name || user.role;

    // Only managers, HR, and admin can reject requests
    if (!['MANAGER', 'HR', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!leaveRequest) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    if (leaveRequest.status !== 'PENDING') {
      return res.status(400).json({ error: "Only pending requests can be rejected" });
    }

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: {
        status: 'REJECTED',
        managerComments,
        reviewedAt: new Date()
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            employeeId: true
          }
        }
      }
    });

    res.json(updatedRequest);
  } catch (error) {
    console.error("Error rejecting leave request:", error);
    res.status(500).json({ error: "Failed to reject leave request" });
  }
});

// GET /api/leave/:id - Get a specific leave request
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const userRole = user.role?.name || user.role;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            employeeId: true
          }
        }
      }
    });

    if (!leaveRequest) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    // Employees can only view their own requests
    if (userRole === 'EMPLOYEE' && leaveRequest.employeeId !== user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(leaveRequest);
  } catch (error) {
    console.error("Error fetching leave request:", error);
    res.status(500).json({ error: "Failed to fetch leave request" });
  }
});

// DELETE /api/leave/:id - Cancel a leave request (employee can cancel their own, managers can cancel any)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const userRole = user.role?.name || user.role;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id) }
    });

    if (!leaveRequest) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    // Check permissions
    const canCancel = 
      leaveRequest.employeeId === user.id || // Own request
      ['MANAGER', 'HR', 'ADMIN'].includes(userRole); // Manager/HR/Admin

    if (!canCancel) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Can only cancel pending or approved requests
    if (!['PENDING', 'APPROVED'].includes(leaveRequest.status)) {
      return res.status(400).json({ error: "Cannot cancel this request" });
    }

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: {
        status: 'CANCELLED',
        reviewedAt: new Date()
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            employeeId: true
          }
        }
      }
    });

    res.json(updatedRequest);
  } catch (error) {
    console.error("Error cancelling leave request:", error);
    res.status(500).json({ error: "Failed to cancel leave request" });
  }
});

export default router;