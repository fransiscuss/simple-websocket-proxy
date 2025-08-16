import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { authRouter } from '../../routes/auth';
import { createMockPrismaClient } from '../mocks/prisma';
import { generateTestData } from '../helpers/test-setup';

// Mock dependencies
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock express Router
vi.mock('express', () => ({
  Router: vi.fn(),
}));

const mockBcrypt = vi.mocked(bcrypt);
const mockJwt = vi.mocked(jwt);
const mockRouter = vi.mocked(Router);

// Mock prisma
const mockPrisma = createMockPrismaClient();
vi.mock('../../services/database', () => ({
  prisma: mockPrisma,
}));

// Helper to simulate route execution
const executeRoute = async (method: string, path: string, body?: any, headers?: any) => {
  const routes = [];
  const mockRouterInstance = {
    post: vi.fn((path, handler) => routes.push({ method: 'POST', path, handler })),
    get: vi.fn((path, handler) => routes.push({ method: 'GET', path, handler })),
    put: vi.fn((path, handler) => routes.push({ method: 'PUT', path, handler })),
    delete: vi.fn((path, handler) => routes.push({ method: 'DELETE', path, handler })),
    patch: vi.fn((path, handler) => routes.push({ method: 'PATCH', path, handler })),
    use: vi.fn(),
  };

  // Override Router to capture routes
  mockRouter.mockReturnValue(mockRouterInstance as any);
  
  // Re-import to get the router with mocked Router
  const { authRouter: testRouter } = await import('../../routes/auth');
  
  // Find the matching route
  const route = routes.find(r => r.method === method && r.path === path);
  if (!route) {
    throw new Error(`Route ${method} ${path} not found`);
  }

  // Create mock request and response
  const req = {
    body: body || {},
    headers: headers || {},
    params: {},
    query: {},
  };

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };

  // Execute the route handler
  await route.handler(req, res);
  
  return { req, res };
};

describe('Auth Routes', () => {
  const validUser = generateTestData.user({
    email: 'admin@example.com',
    passwordHash: '$2a$10$hashedpassword',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_EXPIRES_IN = '24h';
  });

  describe('POST /login', () => {

    it('should login successfully with valid credentials', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('generated-jwt-token');

      const { res } = await executeRoute('POST', '/login', {
        email: 'admin@example.com',
        password: 'correct-password',
      });

      expect(mockPrisma.appUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('correct-password', validUser.passwordHash);
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          userId: validUser.id,
          email: validUser.email,
          role: validUser.role,
        },
        'test-jwt-secret',
        { expiresIn: '24h' }
      );
      
      expect(res.json).toHaveBeenCalledWith({
        token: 'generated-jwt-token',
        user: {
          id: validUser.id,
          email: validUser.email,
          role: validUser.role,
        },
      });
    });

    it('should reject login with invalid email', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(null);

      const { res } = await executeRoute('POST', '/login', {
        email: 'nonexistent@example.com',
        password: 'any-password',
      });

      expect(mockPrisma.appUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' },
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    it('should reject login with invalid password', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(false);

      const { res } = await executeRoute('POST', '/login', {
        email: 'admin@example.com',
        password: 'wrong-password',
      });

      expect(mockPrisma.appUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', validUser.passwordHash);
      expect(jwt.sign).not.toHaveBeenCalled();
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    it('should validate email format', async () => {
      const { res } = await executeRoute('POST', '/login', {
        email: 'invalid-email',
        password: 'any-password',
      });

      expect(mockPrisma.appUser.findUnique).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
    });

    it('should require password', async () => {
      const { res } = await executeRoute('POST', '/login', {
        email: 'admin@example.com',
        // password missing
      });

      expect(mockPrisma.appUser.findUnique).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
    });

    it('should require non-empty password', async () => {
      const { res } = await executeRoute('POST', '/login', {
        email: 'admin@example.com',
        password: '',
      });

      expect(mockPrisma.appUser.findUnique).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
    });

    it('should handle database errors', async () => {
      mockPrisma.appUser.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const { res } = await executeRoute('POST', '/login', {
        email: 'admin@example.com',
        password: 'any-password',
      });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should handle bcrypt errors', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
      mockBcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

      const { res } = await executeRoute('POST', '/login', {
        email: 'admin@example.com',
        password: 'any-password',
      });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should handle JWT signing errors', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      const { res } = await executeRoute('POST', '/login', {
        email: 'admin@example.com',
        password: 'correct-password',
      });

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should use default JWT secret and expiry when env vars not set', async () => {
      delete process.env.JWT_SECRET;
      delete process.env.JWT_EXPIRES_IN;

      mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('token');

      const { res } = await executeRoute('POST', '/login', {
        email: 'admin@example.com',
        password: 'correct-password',
      });

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        'default-jwt-secret-change-in-production',
        { expiresIn: '24h' }
      );
    });

    it('should handle missing request body', async () => {
      const { res } = await executeRoute('POST', '/login', undefined);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
    });

    it('should handle extra fields in request body', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('token');

      const { res } = await executeRoute('POST', '/login', {
        email: 'admin@example.com',
        password: 'correct-password',
        extraField: 'should-be-ignored',
      });

      // Should still work with extra fields
      expect(res.json).toHaveBeenCalledWith({
        token: 'token',
        user: expect.any(Object),
      });
    });

    it('should return user without sensitive information', async () => {
      const userWithSensitiveData = {
        ...validUser,
        passwordHash: 'sensitive-hash',
        resetToken: 'sensitive-token',
      };
      
      mockPrisma.appUser.findUnique.mockResolvedValue(userWithSensitiveData);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('token');

      const { res } = await executeRoute('POST', '/login', {
        email: 'admin@example.com',
        password: 'correct-password',
      });

      expect(res.json).toHaveBeenCalledWith({
        token: 'token',
        user: {
          id: validUser.id,
          email: validUser.email,
          role: validUser.role,
          // Should not include passwordHash or other sensitive fields
        },
      });
      
      const responseCall = res.json.mock.calls[0][0];
      expect(responseCall.user).not.toHaveProperty('passwordHash');
      expect(responseCall.user).not.toHaveProperty('resetToken');
    });

    it('should handle case-sensitive email lookup', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(null);

      // Try login with different case
      const { res } = await executeRoute('POST', '/login', {
        email: 'ADMIN@EXAMPLE.COM',
        password: 'any-password',
      });

      expect(mockPrisma.appUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'ADMIN@EXAMPLE.COM' },
      });
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle different user roles', async () => {
      const regularUser = generateTestData.user({
        email: 'user@example.com',
        role: 'USER',
      });
      
      mockPrisma.appUser.findUnique.mockResolvedValue(regularUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('token');

      const { res } = await executeRoute('POST', '/login', {
        email: 'user@example.com',
        password: 'correct-password',
      });

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          userId: regularUser.id,
          email: regularUser.email,
          role: 'USER',
        },
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('Route Registration', () => {
    it('should register POST /login route', () => {
      const mockRouter = {
        post: vi.fn(),
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        patch: vi.fn(),
        use: vi.fn(),
      };

      mockRouter.mockReturnValue(mockRouter as any);
      
      // Re-import to trigger route registration
      require('../../routes/auth');

      expect(mockRouter.post).toHaveBeenCalledWith('/login', expect.any(Function));
    });
  });

  describe('Security Considerations', () => {
    it('should not reveal whether email or password is wrong', async () => {
      // Test invalid email
      mockPrisma.appUser.findUnique.mockResolvedValue(null);
      const { res: res1 } = await executeRoute('POST', '/login', {
        email: 'wrong@example.com',
        password: 'any-password',
      });

      // Test invalid password
      mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(false);
      const { res: res2 } = await executeRoute('POST', '/login', {
        email: 'admin@example.com',
        password: 'wrong-password',
      });

      // Both should return the same error message
      expect(res1.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
      expect(res2.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    it('should use timing-safe comparison for passwords', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
      
      const { res } = await executeRoute('POST', '/login', {
        email: 'admin@example.com',
        password: 'test-password',
      });

      // Verify bcrypt.compare was used (timing-safe)
      expect(bcrypt.compare).toHaveBeenCalledWith('test-password', validUser.passwordHash);
    });

    it('should not expose internal error details', async () => {
      mockPrisma.appUser.findUnique.mockRejectedValue(new Error('Sensitive database error with connection string'));

      const { res } = await executeRoute('POST', '/login', {
        email: 'admin@example.com',
        password: 'any-password',
      });

      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      // Should not expose the actual database error
    });
  });
});