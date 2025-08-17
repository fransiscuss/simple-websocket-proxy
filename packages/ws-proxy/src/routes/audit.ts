import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { prisma } from '../services/database';
import { createLogger } from '../utils/logger';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router: IRouter = Router();
const logger = createLogger({ name: 'audit-api' });

router.use(authenticateToken);
router.use(requireAdmin);

const auditQuerySchema = z.object({
  page: z.string().optional().transform(val => {
    if (!val) return 1;
    const parsed = parseInt(val);
    return isNaN(parsed) ? 1 : Math.max(1, parsed);
  }),
  limit: z.string().optional().transform(val => {
    if (!val) return 50;
    const parsed = parseInt(val);
    return isNaN(parsed) ? 50 : Math.min(100, Math.max(1, parsed));
  }),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  startDate: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), {
    message: "Invalid start date format"
  }),
  endDate: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), {
    message: "Invalid end date format"
  }),
});

router.get('/', async (req, res) => {
  try {
    const { page, limit, action, entityType, entityId, startDate, endDate } = auditQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};
    
    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }
    
    if (entityType) {
      where.entityType = { contains: entityType, mode: 'insensitive' };
    }
    
    if (entityId) {
      where.entityId = entityId;
    }
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      auditLogs,
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
    logger.error('Error fetching audit logs', { error, userId: req.user?.userId });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

router.get('/actions', async (req, res) => {
  try {
    const actions = await prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });

    res.json({
      actions: actions.map((a: { action: string }) => a.action),
    });
  } catch (error) {
    logger.error('Error fetching audit actions', { error, userId: req.user?.userId });
    res.status(500).json({ error: 'Failed to fetch audit actions' });
  }
});

router.get('/entity-types', async (req, res) => {
  try {
    const entityTypes = await prisma.auditLog.findMany({
      select: { entityType: true },
      distinct: ['entityType'],
      orderBy: { entityType: 'asc' },
    });

    res.json({
      entityTypes: entityTypes.map((et: { entityType: string }) => et.entityType),
    });
  } catch (error) {
    logger.error('Error fetching entity types', { error, userId: req.user?.userId });
    res.status(500).json({ error: 'Failed to fetch entity types' });
  }
});

export { router as auditRouter };