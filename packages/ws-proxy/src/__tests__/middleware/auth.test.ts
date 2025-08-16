import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { createMockRequest, createMockResponse, createMockNext } from '../mocks/express';

// Mock logger
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

const mockJwt = vi.mocked(jwt);

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure JWT_SECRET is set for tests
    process.env.JWT_SECRET = 'test-jwt-secret-123';
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token successfully', () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'ADMIN',
      };
      
      mockJwt.verify.mockReturnValue(mockPayload as any);
      
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer valid-token',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      authenticateToken(req, res, next);
      
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String));
      expect(req.user).toEqual(mockPayload);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request with missing authorization header', () => {
      const req = createMockRequest({
        headers: {},
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      authenticateToken(req, res, next);
      
      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
    });

    it('should reject request with malformed authorization header', () => {
      const req = createMockRequest({
        headers: {
          authorization: 'InvalidFormat',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      authenticateToken(req, res, next);
      
      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
    });

    it('should reject request with Bearer but no token', () => {
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer ',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      authenticateToken(req, res, next);
      
      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
    });

    it('should reject invalid token', () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      authenticateToken(req, res, next);
      
      expect(mockJwt.verify).toHaveBeenCalledWith('invalid-token', expect.any(String));
      expect(req.user).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    });

    it('should reject expired token', () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      mockJwt.verify.mockImplementation(() => {
        throw error;
      });
      
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer expired-token',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      authenticateToken(req, res, next);
      
      expect(mockJwt.verify).toHaveBeenCalledWith('expired-token', expect.any(String));
      expect(req.user).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    });

    it('should handle multiple Bearer prefixes', () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'ADMIN',
      };
      
      mockJwt.verify.mockReturnValue(mockPayload as any);
      
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer Bearer valid-token',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      authenticateToken(req, res, next);
      
      expect(mockJwt.verify).toHaveBeenCalledWith('Bearer', expect.any(String));
      expect(req.user).toEqual(mockPayload);
      expect(next).toHaveBeenCalled();
    });

    it('should use default JWT secret when env var not set', () => {
      // Temporarily clear JWT_SECRET
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'ADMIN',
      };
      
      mockJwt.verify.mockReturnValue(mockPayload as any);
      
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer valid-token',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      authenticateToken(req, res, next);
      
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'default-jwt-secret-change-in-production');
      
      // Restore the original secret
      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin user', () => {
      const req = createMockRequest({
        user: {
          userId: 'user-123',
          email: 'admin@example.com',
          role: 'ADMIN',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      requireAdmin(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject user without user object', () => {
      const req = createMockRequest({
        user: undefined,
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      requireAdmin(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin role required' });
    });

    it('should reject non-admin user', () => {
      const req = createMockRequest({
        user: {
          userId: 'user-123',
          email: 'user@example.com',
          role: 'USER',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      requireAdmin(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin role required' });
    });

    it('should reject user with null role', () => {
      const req = createMockRequest({
        user: {
          userId: 'user-123',
          email: 'user@example.com',
          role: null,
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      requireAdmin(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin role required' });
    });

    it('should reject user with undefined role', () => {
      const req = createMockRequest({
        user: {
          userId: 'user-123',
          email: 'user@example.com',
          role: undefined,
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      requireAdmin(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin role required' });
    });

    it('should be case sensitive for role checking', () => {
      const req = createMockRequest({
        user: {
          userId: 'user-123',
          email: 'user@example.com',
          role: 'admin', // lowercase
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      requireAdmin(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin role required' });
    });
  });

  describe('Integration', () => {
    it('should work together in middleware chain', () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'admin@example.com',
        role: 'ADMIN',
      };
      
      mockJwt.verify.mockReturnValue(mockPayload as any);
      
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer valid-admin-token',
        },
      });
      const res = createMockResponse();
      const next1 = createMockNext();
      const next2 = createMockNext();
      
      // First authenticate
      authenticateToken(req, res, next1);
      
      expect(next1).toHaveBeenCalled();
      expect(req.user).toEqual(mockPayload);
      
      // Then check admin
      requireAdmin(req, res, next2);
      
      expect(next2).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block non-admin in middleware chain', () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'USER',
      };
      
      mockJwt.verify.mockReturnValue(mockPayload as any);
      
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer valid-user-token',
        },
      });
      const res = createMockResponse();
      const next1 = createMockNext();
      const next2 = createMockNext();
      
      // First authenticate
      authenticateToken(req, res, next1);
      
      expect(next1).toHaveBeenCalled();
      expect(req.user).toEqual(mockPayload);
      
      // Then check admin (should fail)
      requireAdmin(req, res, next2);
      
      expect(next2).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should handle authentication failure before admin check', () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });
      const res = createMockResponse();
      const next1 = createMockNext();
      const next2 = createMockNext();
      
      // First authenticate (should fail)
      authenticateToken(req, res, next1);
      
      expect(next1).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(403);
      
      // Admin check would not be reached in real scenario,
      // but if called, should also fail
      requireAdmin(req, res, next2);
      
      expect(next2).not.toHaveBeenCalled();
    });
  });

  describe('Type Safety', () => {
    it('should properly type user object in request', () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'admin@example.com',
        role: 'ADMIN',
      };
      
      mockJwt.verify.mockReturnValue(mockPayload as any);
      
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer valid-token',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      authenticateToken(req, res, next);
      
      // TypeScript should understand these properties exist
      expect(req.user?.userId).toBe('user-123');
      expect(req.user?.email).toBe('admin@example.com');
      expect(req.user?.role).toBe('ADMIN');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle jwt.verify throwing non-Error object', () => {
      mockJwt.verify.mockImplementation(() => {
        throw 'String error'; // eslint-disable-line no-throw-literal
      });
      
      const req = createMockRequest({
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      authenticateToken(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    });

    it('should handle empty authorization header value', () => {
      const req = createMockRequest({
        headers: {
          authorization: '',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      authenticateToken(req, res, next);
      
      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle authorization header with only spaces', () => {
      const req = createMockRequest({
        headers: {
          authorization: '   ',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      authenticateToken(req, res, next);
      
      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});