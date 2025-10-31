import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { isAdminOrHR } from '../middlewares/roleMiddleware.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get all interviews with candidate and interviewer information
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, candidateId, interviewerId, date, limit = 50, offset = 0 } = req.query;
    
    const whereClause = {};
    if (status) whereClause.status = status;
    if (candidateId) whereClause.candidateId = parseInt(candidateId);
    if (interviewerId) whereClause.interviewerId = parseInt(interviewerId);
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      whereClause.scheduledDate = {
        gte: startDate,
        lt: endDate
      };
    }

    const interviews = await prisma.interview.findMany({
      where: whereClause,
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            appliedFor: {
              select: {
                title: true,
                department: true
              }
            }
          }
        },
        interviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        },
        scheduledBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { scheduledDate: 'asc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const totalCount = await prisma.interview.count({ where: whereClause });

    res.json({
      interviews,
      totalCount,
      hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
    });
  } catch (error) {
    console.error('Error fetching interviews:', error);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

// Get interview by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const interview = await prisma.interview.findUnique({
      where: { id: parseInt(id) },
      include: {
        candidate: {
          include: {
            appliedFor: {
              select: {
                title: true,
                department: true,
                requirements: true
              }
            }
          }
        },
        interviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        },
        scheduledBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    res.json(interview);
  } catch (error) {
    console.error('Error fetching interview:', error);
    res.status(500).json({ error: 'Failed to fetch interview' });
  }
});

// Create new interview
router.post('/', authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const { 
      title, 
      candidateId, 
      interviewerId, 
      scheduledDate, 
      duration, 
      type, 
      location, 
      notes 
    } = req.body;

    // Check if candidate exists
    const candidate = await prisma.candidate.findUnique({
      where: { id: parseInt(candidateId) }
    });

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Check if interviewer exists
    const interviewer = await prisma.user.findUnique({
      where: { id: parseInt(interviewerId) }
    });

    if (!interviewer) {
      return res.status(404).json({ error: 'Interviewer not found' });
    }

    // Check for scheduling conflicts
    const conflictingInterview = await prisma.interview.findFirst({
      where: {
        interviewerId: parseInt(interviewerId),
        scheduledDate: {
          gte: new Date(scheduledDate),
          lt: new Date(new Date(scheduledDate).getTime() + (duration || 60) * 60000)
        },
        status: {
          in: ['SCHEDULED', 'RESCHEDULED']
        }
      }
    });

    if (conflictingInterview) {
      return res.status(400).json({ error: 'Interviewer has a scheduling conflict' });
    }

    const interview = await prisma.interview.create({
      data: {
        title,
        candidateId: parseInt(candidateId),
        interviewerId: parseInt(interviewerId),
        scheduledById: req.user.id,
        scheduledDate: new Date(scheduledDate),
        duration: duration || 60,
        type: type || 'TECHNICAL',
        location,
        notes
      },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            appliedFor: {
              select: {
                title: true,
                department: true
              }
            }
          }
        },
        interviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      }
    });

    // Update candidate status to INTERVIEW if not already
    if (candidate.status === 'NEW' || candidate.status === 'SCREENING') {
      await prisma.candidate.update({
        where: { id: parseInt(candidateId) },
        data: { status: 'INTERVIEW' }
      });
    }

    res.status(201).json(interview);
  } catch (error) {
    console.error('Error creating interview:', error);
    res.status(500).json({ error: 'Failed to create interview' });
  }
});

// Update interview
router.patch('/:id', authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.scheduledDate) {
      updateData.scheduledDate = new Date(updateData.scheduledDate);
    }

    if (updateData.interviewerId) {
      updateData.interviewerId = parseInt(updateData.interviewerId);
    }

    if (updateData.candidateId) {
      updateData.candidateId = parseInt(updateData.candidateId);
    }

    const interview = await prisma.interview.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            appliedFor: {
              select: {
                title: true,
                department: true
              }
            }
          }
        },
        interviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      }
    });

    res.json(interview);
  } catch (error) {
    console.error('Error updating interview:', error);
    res.status(500).json({ error: 'Failed to update interview' });
  }
});

// Add feedback to interview
router.patch('/:id/feedback', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback, rating } = req.body;

    const interview = await prisma.interview.update({
      where: { id: parseInt(id) },
      data: {
        feedback,
        rating: rating ? parseInt(rating) : null,
        status: 'COMPLETED'
      },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json(interview);
  } catch (error) {
    console.error('Error adding feedback:', error);
    res.status(500).json({ error: 'Failed to add feedback' });
  }
});

// Get interview statistics
router.get('/stats/overview', authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const [
      totalInterviews,
      scheduledInterviews,
      completedInterviews,
      cancelledInterviews,
      todayInterviews
    ] = await Promise.all([
      prisma.interview.count(),
      prisma.interview.count({ where: { status: 'SCHEDULED' } }),
      prisma.interview.count({ where: { status: 'COMPLETED' } }),
      prisma.interview.count({ where: { status: 'CANCELLED' } }),
      prisma.interview.count({
        where: {
          scheduledDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      })
    ]);

    // Get upcoming interviews (next 7 days)
    const upcomingInterviews = await prisma.interview.count({
      where: {
        scheduledDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        status: 'SCHEDULED'
      }
    });

    // Calculate average rating
    const ratingStats = await prisma.interview.aggregate({
      _avg: {
        rating: true
      },
      where: {
        rating: {
          not: null
        }
      }
    });

    res.json({
      totalInterviews,
      scheduledInterviews,
      completedInterviews,
      cancelledInterviews,
      todayInterviews,
      upcomingInterviews,
      averageRating: ratingStats._avg.rating ? ratingStats._avg.rating.toFixed(1) : '0'
    });
  } catch (error) {
    console.error('Error fetching interview statistics:', error);
    res.status(500).json({ error: 'Failed to fetch interview statistics' });
  }
});

// Get interviewer availability
router.get('/availability/:interviewerId', authMiddleware, async (req, res) => {
  try {
    const { interviewerId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const scheduledInterviews = await prisma.interview.findMany({
      where: {
        interviewerId: parseInt(interviewerId),
        scheduledDate: {
          gte: startDate,
          lt: endDate
        },
        status: {
          in: ['SCHEDULED', 'RESCHEDULED']
        }
      },
      select: {
        scheduledDate: true,
        duration: true
      }
    });

    res.json({
      date,
      scheduledInterviews: scheduledInterviews.map(interview => ({
        startTime: interview.scheduledDate,
        endTime: new Date(interview.scheduledDate.getTime() + interview.duration * 60000)
      }))
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Delete interview
router.delete('/:id', authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.interview.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Interview deleted successfully' });
  } catch (error) {
    console.error('Error deleting interview:', error);
    res.status(500).json({ error: 'Failed to delete interview' });
  }
});

export default router;