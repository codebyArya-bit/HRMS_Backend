import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { isAdminOrHR } from '../middlewares/roleMiddleware.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get all candidates with job information
router.get('/', authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const { status, jobId, limit = 50, offset = 0 } = req.query;
    
    const whereClause = {};
    if (status) whereClause.status = status;
    if (jobId) whereClause.appliedForJobId = parseInt(jobId);

    const candidates = await prisma.candidate.findMany({
      where: whereClause,
      include: {
        appliedFor: {
          select: {
            id: true,
            title: true,
            department: true
          }
        }
      },
      orderBy: { dateApplied: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    // Calculate AI scores (mock for now, can be replaced with actual AI scoring)
    const candidatesWithScores = candidates.map(candidate => ({
      ...candidate,
      aiScore: Math.floor(Math.random() * 40) + 60, // Random score between 60-100
      skills: ['JavaScript', 'React', 'Node.js'], // Mock skills
      experience: `${Math.floor(Math.random() * 10) + 1} years`,
      location: 'Remote'
    }));

    const totalCount = await prisma.candidate.count({ where: whereClause });

    res.json({
      candidates: candidatesWithScores,
      totalCount,
      hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// Get candidate by ID
router.get('/:id', authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const { id } = req.params;
    
    const candidate = await prisma.candidate.findUnique({
      where: { id: parseInt(id) },
      include: {
        appliedFor: {
          select: {
            id: true,
            title: true,
            department: true,
            requirements: true
          }
        }
      }
    });

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Add additional mock data for detailed view
    const candidateWithDetails = {
      ...candidate,
      aiScore: Math.floor(Math.random() * 40) + 60,
      skills: ['JavaScript', 'React', 'Node.js', 'Python', 'SQL'],
      experience: `${Math.floor(Math.random() * 10) + 1} years`,
      location: 'Remote',
      education: 'Bachelor\'s in Computer Science',
      previousCompany: 'Tech Corp Inc.',
      resumeUrl: '/resumes/candidate-' + id + '.pdf',
      coverLetterUrl: '/cover-letters/candidate-' + id + '.pdf'
    };

    res.json(candidateWithDetails);
  } catch (error) {
    console.error('Error fetching candidate:', error);
    res.status(500).json({ error: 'Failed to fetch candidate' });
  }
});

// Create new candidate (job application)
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, appliedForJobId } = req.body;

    // Check if job exists
    const job = await prisma.job.findUnique({
      where: { id: parseInt(appliedForJobId) }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if candidate already applied for this job
    const existingApplication = await prisma.candidate.findFirst({
      where: {
        email: email,
        appliedForJobId: parseInt(appliedForJobId)
      }
    });

    if (existingApplication) {
      return res.status(400).json({ error: 'Candidate has already applied for this job' });
    }

    const candidate = await prisma.candidate.create({
      data: {
        name,
        email,
        phone,
        appliedForJobId: parseInt(appliedForJobId),
        status: 'NEW'
      },
      include: {
        appliedFor: {
          select: {
            id: true,
            title: true,
            department: true
          }
        }
      }
    });

    res.status(201).json(candidate);
  } catch (error) {
    console.error('Error creating candidate:', error);
    res.status(500).json({ error: 'Failed to create candidate application' });
  }
});

// Update candidate status
router.patch('/:id/status', authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, dateHired } = req.body;

    const updateData = { status };
    if (status === 'HIRED' && dateHired) {
      updateData.dateHired = new Date(dateHired);
    }

    const candidate = await prisma.candidate.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        appliedFor: {
          select: {
            id: true,
            title: true,
            department: true
          }
        }
      }
    });

    res.json(candidate);
  } catch (error) {
    console.error('Error updating candidate status:', error);
    res.status(500).json({ error: 'Failed to update candidate status' });
  }
});

// Get candidate statistics
router.get('/stats/overview', authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const [
      totalCandidates,
      newCandidates,
      interviewingCandidates,
      hiredCandidates,
      rejectedCandidates
    ] = await Promise.all([
      prisma.candidate.count(),
      prisma.candidate.count({ where: { status: 'NEW' } }),
      prisma.candidate.count({ where: { status: 'INTERVIEWING' } }),
      prisma.candidate.count({ where: { status: 'HIRED' } }),
      prisma.candidate.count({ where: { status: 'REJECTED' } })
    ]);

    // Get recent candidates (last 7 days)
    const recentCandidates = await prisma.candidate.count({
      where: {
        dateApplied: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });

    res.json({
      totalCandidates,
      newCandidates,
      interviewingCandidates,
      hiredCandidates,
      rejectedCandidates,
      recentCandidates,
      conversionRate: totalCandidates > 0 ? ((hiredCandidates / totalCandidates) * 100).toFixed(1) : '0'
    });
  } catch (error) {
    console.error('Error fetching candidate statistics:', error);
    res.status(500).json({ error: 'Failed to fetch candidate statistics' });
  }
});

// Delete candidate
router.delete('/:id', authMiddleware, isAdminOrHR, async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.candidate.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Candidate deleted successfully' });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ error: 'Failed to delete candidate' });
  }
});

export default router;