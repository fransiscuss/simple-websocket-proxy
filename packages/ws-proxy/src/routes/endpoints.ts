import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { prisma } from '../services/database';
import { createLogger } from '../utils/logger';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router: IRouter = Router();
const logger = createLogger({ name: 'endpoints-api' });

router.use(authenticateToken);
router.use(requireAdmin);

const createEndpointSchema = z.object({
  name: z.string().min(1).max(255),
  targetUrl: z.string().url(),
  limits: z.object({
    maxConnections: z.number().int().min(1).max(10000).default(100),
    maxMessageSize: z.number().int().min(1024).max(16777216).default(1048576),
    timeoutMs: z.number().int().min(1000).max(300000).default(30000),
  }).default({
    maxConnections: 100,
    maxMessageSize: 1048576,
    timeoutMs: 30000,
  }),
  sampling: z.object({
    enabled: z.boolean().default(false),
    percentage: z.number().min(0).max(100).default(10),
  }).default({
    enabled: false,
    percentage: 10,
  }),
  enabled: z.boolean().default(true),
});

const updateEndpointSchema = createEndpointSchema.partial();

router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '10', search = '', enabled } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { targetUrl: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    
    if (enabled !== undefined) {
      where.enabled = enabled === 'true';
    }

    const [endpoints, total] = await Promise.all([
      prisma.endpoint.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { liveSessions: true },
          },
        },
      }),
      prisma.endpoint.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      endpoints,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    logger.error('Error fetching endpoints', { error, userId: req.user?.userId });
    res.status(500).json({ error: 'Failed to fetch endpoints' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const endpoint = await prisma.endpoint.findUnique({
      where: { id },
      include: {
        _count: {
          select: { 
            liveSessions: true,
            trafficSamples: true,
          },
        },
      },
    });

    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    res.json(endpoint);
  } catch (error) {
    logger.error('Error fetching endpoint', { error, endpointId: req.params.id, userId: req.user?.userId });
    res.status(500).json({ error: 'Failed to fetch endpoint' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = createEndpointSchema.parse(req.body);

    const endpoint = await prisma.endpoint.create({
      data,
    });

    // Create audit log (non-blocking - don't fail the request if this fails)
    try {
      await prisma.auditLog.create({
        data: {
          action: 'CREATE_ENDPOINT',
          entityType: 'ENDPOINT',
          entityId: endpoint.id,
          details: {
            name: endpoint.name,
            targetUrl: endpoint.targetUrl,
            userId: req.user!.userId,
          },
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log', { error: auditError, endpointId: endpoint.id });
    }

    logger.info('Endpoint created', { 
      endpointId: endpoint.id, 
      name: endpoint.name,
      userId: req.user?.userId 
    });

    res.status(201).json(endpoint);
  } catch (error) {
    logger.error('Error creating endpoint', { error, userId: req.user?.userId });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to create endpoint' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateEndpointSchema.parse(req.body);

    const existingEndpoint = await prisma.endpoint.findUnique({
      where: { id },
    });

    if (!existingEndpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    const endpoint = await prisma.endpoint.update({
      where: { id },
      data,
    });

    // Create audit log (non-blocking - don't fail the request if this fails)
    try {
      await prisma.auditLog.create({
        data: {
          action: 'UPDATE_ENDPOINT',
          entityType: 'ENDPOINT',
          entityId: endpoint.id,
          details: {
            changes: data,
            userId: req.user!.userId,
          },
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log', { error: auditError, endpointId: endpoint.id });
    }

    logger.info('Endpoint updated', { 
      endpointId: endpoint.id, 
      changes: data,
      userId: req.user?.userId 
    });

    res.json(endpoint);
  } catch (error) {
    logger.error('Error updating endpoint', { error, endpointId: req.params.id, userId: req.user?.userId });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to update endpoint' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existingEndpoint = await prisma.endpoint.findUnique({
      where: { id },
    });

    if (!existingEndpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    await prisma.endpoint.delete({
      where: { id },
    });

    // Create audit log (non-blocking - don't fail the request if this fails)
    try {
      await prisma.auditLog.create({
        data: {
          action: 'DELETE_ENDPOINT',
          entityType: 'ENDPOINT',
          entityId: id,
          details: {
            name: existingEndpoint.name,
            targetUrl: existingEndpoint.targetUrl,
            userId: req.user!.userId,
          },
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log', { error: auditError, endpointId: id });
    }

    logger.info('Endpoint deleted', { 
      endpointId: id, 
      name: existingEndpoint.name,
      userId: req.user?.userId 
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting endpoint', { error, endpointId: req.params.id, userId: req.user?.userId });
    res.status(500).json({ error: 'Failed to delete endpoint' });
  }
});

export { router as endpointsRouter };