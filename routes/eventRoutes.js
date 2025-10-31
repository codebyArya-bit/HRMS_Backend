import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get all events
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, limit = 10, offset = 0 } = req.query;
    
    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const events = await prisma.Event.findMany({
      where: whereClause,
      include: {
        registrations: {
          select: {
            id: true,
            userId: true,
            status: true,
          }
        },
        _count: {
          select: {
            registrations: true
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    // Add registration count and user registration status
    const eventsWithDetails = events.map(event => ({
      ...event,
      registrationCount: event._count.registrations,
      isUserRegistered: event.registrations.some(reg => reg.userId === req.user.id),
      userRegistrationStatus: event.registrations.find(reg => reg.userId === req.user.id)?.status || null
    }));

    res.json({
      success: true,
      data: eventsWithDetails
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
      error: error.message
    });
  }
});

// Get single event by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.Event.findUnique({
      where: { id: parseInt(id) },
      include: {
        registrations: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                department: true
              }
            }
          }
        },
        _count: {
          select: {
            registrations: true
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const eventWithDetails = {
      ...event,
      registrationCount: event._count.registrations,
      isUserRegistered: event.registrations.some(reg => reg.userId === req.user.id),
      userRegistrationStatus: event.registrations.find(reg => reg.userId === req.user.id)?.status || null
    };

    res.json({
      success: true,
      data: eventWithDetails
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event',
      error: error.message
    });
  }
});

// Register for an event
router.post('/:id/register', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if event exists
    const event = await prisma.Event.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            registrations: {
              where: {
                status: 'REGISTERED'
              }
            }
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if event is open for registration
    if (event.status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        message: 'Event is not open for registration'
      });
    }

    // Check if user is already registered
    const existingRegistration = await prisma.EventRegistration.findUnique({
      where: {
        userId_eventId: {
          userId: userId,
          eventId: parseInt(id)
        }
      }
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this event'
      });
    }

    // Check capacity
    let registrationStatus = 'REGISTERED';
    if (event.maxCapacity && event._count.registrations >= event.maxCapacity) {
      registrationStatus = 'WAITLISTED';
    }

    // Create registration
    const registration = await prisma.EventRegistration.create({
      data: {
        userId: userId,
        eventId: parseInt(id),
        status: registrationStatus
      },
      include: {
        event: {
          select: {
            title: true,
            startDate: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: registrationStatus === 'REGISTERED' 
        ? 'Successfully registered for the event' 
        : 'Added to waitlist for the event',
      data: registration
    });
  } catch (error) {
    console.error('Error registering for event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register for event',
      error: error.message
    });
  }
});

// Cancel event registration
router.delete('/:id/register', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if registration exists
    const registration = await prisma.EventRegistration.findUnique({
      where: {
        userId_eventId: {
          userId: userId,
          eventId: parseInt(id)
        }
      }
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Update registration status to cancelled
    await prisma.EventRegistration.update({
      where: {
        id: registration.id
      },
      data: {
        status: 'CANCELLED'
      }
    });

    res.json({
      success: true,
      message: 'Registration cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling registration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel registration',
      error: error.message
    });
  }
});

// Get user's event registrations
router.get('/user/registrations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const whereClause = { userId };
    if (status) {
      whereClause.status = status;
    }

    const registrations = await prisma.EventRegistration.findMany({
      where: whereClause,
      include: {
        event: true
      },
      orderBy: {
        registeredAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: registrations
    });
  } catch (error) {
    console.error('Error fetching user registrations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registrations',
      error: error.message
    });
  }
});

export default router;