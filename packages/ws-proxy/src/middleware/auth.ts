import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createLogger } from '../utils/logger';

const logger = createLogger({ name: 'auth-middleware' });
const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';

interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('Missing authentication token', { path: req.path });
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Invalid authentication token', { error, path: req.path });
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    logger.warn('Access denied - admin role required', { 
      userId: req.user?.userId, 
      role: req.user?.role,
      path: req.path 
    });
    return res.status(403).json({ error: 'Admin role required' });
  }
  next();
};