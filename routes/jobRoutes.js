import express from "express";
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { isAdminOrHR } from '../middlewares/roleMiddleware.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get all jobs with application statistics
router.get("/", async (req, res) => {
  try {
    const { status, department, limit = 50, offset = 0 } = req.query;
    
    console.log('🔍 Job route query params:', { status, department, limit, offset });
    
    const whereClause = {};
    // If no status specified, exclude archived jobs by default
    if (status) {
      whereClause.status = status;
    } else {
      whereClause.status = { not: 'ARCHIVED' };
    }
    if (department) whereClause.department = department;

    const jobs = await prisma.Job.findMany({
      where: whereClause,
      include: {
        postedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        applicants: {
          select: {
            id: true,
            status: true,
            dateApplied: true
          }
        },
        _count: {
          select: {
            applicants: true
          }
        }
      },
      orderBy: { datePosted: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    // Add application statistics to each job
    const jobsWithStats = jobs.map(job => ({
      ...job,
      applicationStats: {
        totalApplications: job._count.applicants,
        newApplications: job.applicants.filter(app => app.status === 'NEW').length,
        interviewingApplications: job.applicants.filter(app => app.status === 'INTERVIEW').length,
        hiredApplications: job.applicants.filter(app => app.status === 'HIRED').length,
        rejectedApplications: job.applicants.filter(app => app.status === 'REJECTED').length,
        recentApplications: job.applicants.filter(app => {
          const daysDiff = (new Date() - new Date(app.dateApplied)) / (1000 * 60 * 60 * 24);
          return daysDiff <= 7;
        }).length
      }
    }));

    const totalCount = await prisma.Job.count({ where: whereClause });

    res.json({
      jobs: jobsWithStats,
      totalCount,
      hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// Get job by ID with detailed application information
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const job = await prisma.Job.findUnique({
      where: { id: parseInt(id) },
      include: {
        postedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        },
        applicants: {
          include: {
            interviews: {
              select: {
                id: true,
                scheduledDate: true,
                status: true,
                type: true
              }
            }
          },
          orderBy: { dateApplied: 'desc' }
        }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Calculate detailed statistics
    const stats = {
      totalApplications: job.applicants.length,
      statusBreakdown: {
        NEW: job.applicants.filter(app => app.status === 'NEW').length,
        SCREENING: job.applicants.filter(app => app.status === 'SCREENING').length,
        INTERVIEW: job.applicants.filter(app => app.status === 'INTERVIEW').length,
        OFFERED: job.applicants.filter(app => app.status === 'OFFERED').length,
        HIRED: job.applicants.filter(app => app.status === 'HIRED').length,
        REJECTED: job.applicants.filter(app => app.status === 'REJECTED').length
      },
      interviewsScheduled: job.applicants.reduce((total, app) => total + app.interviews.length, 0),
      applicationTrend: {
        thisWeek: job.applicants.filter(app => {
          const daysDiff = (new Date() - new Date(app.dateApplied)) / (1000 * 60 * 60 * 24);
          return daysDiff <= 7;
        }).length,
        thisMonth: job.applicants.filter(app => {
          const daysDiff = (new Date() - new Date(app.dateApplied)) / (1000 * 60 * 60 * 24);
          return daysDiff <= 30;
        }).length
      }
    };

    res.json({
      ...job,
      applicationStats: stats
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

// Create new job
router.post("/", authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const jobData = {
      ...req.body,
      postedById: req.user.id
    };

    const job = await prisma.Job.create({
      data: jobData,
      include: {
        postedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.status(201).json(job);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(400).json({ error: "Failed to create job" });
  }
});

// Update job
router.put("/:id", authMiddleware, isAdminOrHR, async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await prisma.Job.update({
      where: { id: parseInt(id) },
      data: req.body,
      include: {
        postedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            applicants: true
          }
        }
      }
    });
    res.json(updated);
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(400).json({ error: "Update failed" });
  }
});

// Update job status
router.put("/:id/status", authMiddleware, isAdminOrHR, async (req, res) => {
  const { id } = req.params;
  try {
    const job = await prisma.Job.update({
      where: { id: parseInt(id) },
      data: { status: req.body.status },
      include: {
        _count: {
          select: {
            applicants: true
          }
        }
      }
    });
    res.json(job);
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(400).json({ error: "Status update failed" });
  }
});

// Get job application statistics overview
router.get("/stats/overview", authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const [
      totalJobs,
      openJobs,
      closedJobs,
      totalApplications,
      recentApplications
    ] = await Promise.all([
      prisma.Job.count(),
      prisma.Job.count({ where: { status: 'OPEN' } }),
      prisma.Job.count({ where: { status: 'CLOSED' } }),
      prisma.Candidate.count(),
      prisma.Candidate.count({
        where: {
          dateApplied: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    // Get top performing jobs (most applications)
    const topJobs = await prisma.Job.findMany({
      include: {
        _count: {
          select: {
            applicants: true
          }
        }
      },
      orderBy: {
        applicants: {
          _count: 'desc'
        }
      },
      take: 5
    });

    res.json({
      totalJobs,
      openJobs,
      closedJobs,
      totalApplications,
      recentApplications,
      topJobs: topJobs.map(job => ({
        id: job.id,
        title: job.title,
        department: job.department,
        applicationCount: job._count.applicants
      }))
    });
  } catch (error) {
    console.error('Error fetching job statistics:', error);
    res.status(500).json({ error: 'Failed to fetch job statistics' });
  }
});

// Duplicate job
router.post("/:id/duplicate", authMiddleware, isAdminOrHR, async (req, res) => {
  const { id } = req.params;
  try {
    // Get the original job
    const originalJob = await prisma.Job.findUnique({
      where: { id: parseInt(id) }
    });

    if (!originalJob) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Create a duplicate with modified title and reset fields
    const duplicateJobData = {
      title: `${originalJob.title} (Copy)`,
      department: originalJob.department,
      location: originalJob.location,
      jobType: originalJob.jobType,
      salaryRange: originalJob.salaryRange,
      description: originalJob.description,
      requirements: originalJob.requirements,
      benefits: originalJob.benefits,
      openings: originalJob.openings,
      status: 'OPEN', // Always start as open
      postedById: req.user.id, // Set current user as poster
      datePosted: new Date()
    };

    const duplicatedJob = await prisma.Job.create({
      data: duplicateJobData,
      include: {
        postedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            applicants: true
          }
        }
      }
    });

    // Add application statistics (will be 0 for new job)
    const jobWithStats = {
      ...duplicatedJob,
      applicationStats: {
        totalApplications: 0,
        newApplications: 0,
        interviewingApplications: 0,
        hiredApplications: 0,
        rejectedApplications: 0,
        recentApplications: 0
      }
    };

    res.status(201).json(jobWithStats);
  } catch (error) {
    console.error('Error duplicating job:', error);
    res.status(500).json({ error: "Failed to duplicate job" });
  }
});

// Archive job (soft delete)
router.delete("/:id", authMiddleware, isAdminOrHR, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.Job.update({
      where: { id: parseInt(id) },
      data: { archived: true },
    });
    res.json({ message: "Job archived successfully" });
  } catch (error) {
    console.error('Error archiving job:', error);
    res.status(400).json({ error: "Archive failed" });
  }
});

export default router;
