import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { prisma } from '../services/database';
import { createLogger } from '../utils/logger';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router: IRouter = Router();
const logger = createLogger({ name: 'sessions-api' });

router.use(authenticateToken);
router.use(requireAdmin);

const sessionsQuerySchema = z.object({
  page: z.string().optional().transform(val => {
    if (!val) return 1;
    const parsed = parseInt(val);
    return isNaN(parsed) ? 1 : Math.max(1, parsed);
  }),
  limit: z.string().optional().transform(val => {
    if (!val) return 20;
    const parsed = parseInt(val);
    return isNaN(parsed) ? 20 : Math.min(100, Math.max(1, parsed));
  }),
  endpointId: z.string().optional(),
  state: z.enum(['ACTIVE', 'CLOSED', 'FAILED']).optional(),
});

router.get('/', async (req, res) => {
  try {
    const { page, limit, endpointId, state } = sessionsQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    
    if (endpointId) {
      where.endpointId = endpointId;
    }
    
    if (state) {
      where.state = state;
    }

    const [sessions, total] = await Promise.all([
      prisma.liveSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          endpoint: {
            select: {
              id: true,
              name: true,
              targetUrl: true,
            },
          },
          _count: {
            select: { trafficSamples: true },
          },
        },
      }),
      prisma.liveSession.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error fetching sessions', { error, userId: req.user?.userId });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma.liveSession.findUnique({
      where: { id },
      include: {
        endpoint: {
          select: {
            id: true,
            name: true,
            targetUrl: true,
          },
        },
        trafficSamples: {
          take: 50,
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    logger.error('Error fetching session', { error, sessionId: req.params.id, userId: req.user?.userId });
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma.liveSession.findUnique({
      where: { id },
      select: { id: true, endpointId: true },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await prisma.liveSession.update({
      where: { id },
      data: { state: 'CLOSED' },
    });

    await prisma.auditLog.create({
      data: {
        action: 'FORCE_CLOSE_SESSION',
        entityType: 'SESSION',
        entityId: id,
        details: {
          endpointId: session.endpointId,
          userId: req.user!.userId,
        },
      },
    });

    logger.info('Session force closed', { 
      sessionId: id,
      endpointId: session.endpointId,
      userId: req.user?.userId 
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Error closing session', { error, sessionId: req.params.id, userId: req.user?.userId });
    res.status(500).json({ error: 'Failed to close session' });
  }
});

export { router as sessionsRouter };