import express from "express";
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { isAdminOrHR } from '../middlewares/roleMiddleware.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get hiring pipeline overview
router.get("/pipeline", authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const { jobId } = req.query;
    
    const whereClause = {};
    if (jobId) whereClause.jobId = parseInt(jobId);

    const candidates = await prisma.Candidate.findMany({
      where: whereClause,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            department: true
          }
        },
        interviews: {
          select: {
            id: true,
            scheduledDate: true,
            status: true,
            type: true,
            rating: true
          }
        }
      },
      orderBy: { dateApplied: 'desc' }
    });

    // Group candidates by status for pipeline view
    const pipeline = {
      NEW: candidates.filter(c => c.status === 'NEW'),
      SCREENING: candidates.filter(c => c.status === 'SCREENING'),
      INTERVIEW: candidates.filter(c => c.status === 'INTERVIEW'),
      OFFERED: candidates.filter(c => c.status === 'OFFERED'),
      HIRED: candidates.filter(c => c.status === 'HIRED'),
      REJECTED: candidates.filter(c => c.status === 'REJECTED')
    };

    // Calculate conversion rates
    const totalCandidates = candidates.length;
    const conversionRates = {
      screeningRate: totalCandidates > 0 ? (pipeline.SCREENING.length + pipeline.INTERVIEW.length + pipeline.OFFERED.length + pipeline.HIRED.length) / totalCandidates * 100 : 0,
      interviewRate: totalCandidates > 0 ? (pipeline.INTERVIEW.length + pipeline.OFFERED.length + pipeline.HIRED.length) / totalCandidates * 100 : 0,
      offerRate: totalCandidates > 0 ? (pipeline.OFFERED.length + pipeline.HIRED.length) / totalCandidates * 100 : 0,
      hireRate: totalCandidates > 0 ? pipeline.HIRED.length / totalCandidates * 100 : 0
    };

    res.json({
      pipeline,
      conversionRates,
      totalCandidates
    });
  } catch (error) {
    console.error('Error fetching hiring pipeline:', error);
    res.status(500).json({ error: 'Failed to fetch hiring pipeline' });
  }
});

// Move candidate to next stage
router.patch("/candidate/:id/advance", authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, nextStage } = req.body;

    const candidate = await prisma.Candidate.findUnique({
      where: { id: parseInt(id) }
    });

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Define stage progression
    const stageProgression = {
      'NEW': 'SCREENING',
      'SCREENING': 'INTERVIEW',
      'INTERVIEW': 'OFFERED',
      'OFFERED': 'HIRED'
    };

    const newStatus = nextStage || stageProgression[candidate.status];
    
    if (!newStatus) {
      return res.status(400).json({ error: 'Cannot advance from current stage' });
    }

    const updatedCandidate = await prisma.Candidate.update({
      where: { id: parseInt(id) },
      data: {
        status: newStatus,
        ...(newStatus === 'HIRED' && { dateHired: new Date() })
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            department: true
          }
        }
      }
    });

    // Log the stage change
    await prisma.AuditLog.create({
      data: {
        userId: req.user.id,
        action: 'CANDIDATE_STAGE_CHANGE',
        entityType: 'Candidate',
        entityId: parseInt(id),
        details: `Candidate ${candidate.name} moved from ${candidate.status} to ${newStatus}. Notes: ${notes || 'No notes provided'}`
      }
    });

    res.json(updatedCandidate);
  } catch (error) {
    console.error('Error advancing candidate:', error);
    res.status(500).json({ error: 'Failed to advance candidate' });
  }
});

// Reject candidate
router.patch("/candidate/:id/reject", authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const candidate = await prisma.Candidate.findUnique({
      where: { id: parseInt(id) }
    });

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const updatedCandidate = await prisma.Candidate.update({
      where: { id: parseInt(id) },
      data: {
        status: 'REJECTED',
        rejectionReason: reason
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            department: true
          }
        }
      }
    });

    // Log the rejection
    await prisma.AuditLog.create({
      data: {
        userId: req.user.id,
        action: 'CANDIDATE_REJECTED',
        entityType: 'Candidate',
        entityId: parseInt(id),
        details: `Candidate ${candidate.name} rejected. Reason: ${reason || 'No reason provided'}`
      }
    });

    res.json(updatedCandidate);
  } catch (error) {
    console.error('Error rejecting candidate:', error);
    res.status(500).json({ error: 'Failed to reject candidate' });
  }
});

// Get hiring workflow statistics
router.get("/stats", authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const { timeframe = '30' } = req.query; // days
    const startDate = new Date(Date.now() - parseInt(timeframe) * 24 * 60 * 60 * 1000);

    const [
      totalCandidates,
      newCandidates,
      interviewsScheduled,
      offersExtended,
      hires,
      rejections,
      avgTimeToHire
    ] = await Promise.all([
      prisma.Candidate.count(),
      prisma.Candidate.count({
        where: {
          dateApplied: { gte: startDate }
        }
      }),
      prisma.Interview.count({
        where: {
          scheduledDate: { gte: startDate }
        }
      }),
      prisma.Candidate.count({
        where: {
          status: 'OFFERED',
          updatedAt: { gte: startDate }
        }
      }),
      prisma.Candidate.count({
        where: {
          status: 'HIRED',
          dateHired: { gte: startDate }
        }
      }),
      prisma.Candidate.count({
        where: {
          status: 'REJECTED',
          updatedAt: { gte: startDate }
        }
      }),
      // Calculate average time to hire (mock calculation for now)
      prisma.Candidate.findMany({
        where: {
          status: 'HIRED',
          dateHired: { gte: startDate }
        },
        select: {
          dateApplied: true,
          dateHired: true
        }
      })
    ]);

    // Calculate average time to hire in days
    const timeToHireData = avgTimeToHire.map(candidate => {
      const timeDiff = new Date(candidate.dateHired) - new Date(candidate.dateApplied);
      return timeDiff / (1000 * 60 * 60 * 24); // Convert to days
    });

    const averageTimeToHire = timeToHireData.length > 0 
      ? timeToHireData.reduce((sum, days) => sum + days, 0) / timeToHireData.length 
      : 0;

    // Get department-wise hiring stats
    const departmentStats = await prisma.Candidate.groupBy({
      by: ['status'],
      where: {
        job: {
          department: { not: null }
        }
      },
      _count: {
        status: true
      }
    });

    res.json({
      overview: {
        totalCandidates,
        newCandidates,
        interviewsScheduled,
        offersExtended,
        hires,
        rejections,
        averageTimeToHire: Math.round(averageTimeToHire)
      },
      departmentStats,
      timeframe: parseInt(timeframe)
    });
  } catch (error) {
    console.error('Error fetching hiring workflow stats:', error);
    res.status(500).json({ error: 'Failed to fetch hiring workflow statistics' });
  }
});

// Get hiring bottlenecks analysis
router.get("/bottlenecks", authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    // Analyze where candidates are getting stuck
    const stageAnalysis = await prisma.Candidate.groupBy({
      by: ['status'],
      _count: {
        status: true
      },
      _avg: {
        id: true // This is a placeholder - in real implementation, you'd track stage duration
      }
    });

    // Find jobs with low conversion rates
    const jobsWithLowConversion = await prisma.Job.findMany({
      where: {
        archived: false,
        applicants: {
          some: {}
        }
      },
      include: {
        _count: {
          select: {
            applicants: true
          }
        },
        applicants: {
          where: {
            status: 'HIRED'
          }
        }
      }
    });

    const lowConversionJobs = jobsWithLowConversion
      .map(job => ({
        id: job.id,
        title: job.title,
        department: job.department,
        totalApplications: job._count.applicants,
        hires: job.applicants.length,
        conversionRate: job._count.applicants > 0 ? (job.applicants.length / job._count.applicants) * 100 : 0
      }))
      .filter(job => job.conversionRate < 10 && job.totalApplications > 5)
      .sort((a, b) => a.conversionRate - b.conversionRate);

    // Identify interview scheduling delays
    const interviewDelays = await prisma.Interview.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledDate: {
          lt: new Date()
        }
      },
      include: {
        candidate: {
          select: {
            name: true,
            job: {
              select: {
                title: true
              }
            }
          }
        }
      }
    });

    res.json({
      stageBottlenecks: stageAnalysis,
      lowConversionJobs,
      overdueInterviews: interviewDelays.length,
      recommendations: [
        ...(stageAnalysis.find(s => s.status === 'SCREENING' && s._count.status > 10) 
          ? ['Consider automating initial screening process'] : []),
        ...(lowConversionJobs.length > 0 
          ? ['Review job requirements and descriptions for low-conversion positions'] : []),
        ...(interviewDelays.length > 0 
          ? ['Address overdue interviews to maintain candidate experience'] : [])
      ]
    });
  } catch (error) {
    console.error('Error analyzing hiring bottlenecks:', error);
    res.status(500).json({ error: 'Failed to analyze hiring bottlenecks' });
  }
});

export default router;