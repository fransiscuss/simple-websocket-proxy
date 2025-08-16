import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createIntegrationTestHelpers, setupIntegrationTestGlobals } from '../helpers/integration-setup';
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

// Mock prisma
vi.mock('../../services/database', () => ({
  prisma: {
    appUser: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

const mockBcrypt = vi.mocked(bcrypt);
const mockJwt = vi.mocked(jwt);

describe('Auth API Integration Tests', () => {
  const { request, unAuthHeaders } = createIntegrationTestHelpers();
  let mockPrisma: any;
  
  setupIntegrationTestGlobals();
  
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_EXPIRES_IN = '24h';
    
    // Get the mocked prisma instance
    const { prisma } = await import('../../services/database');
    mockPrisma = vi.mocked(prisma);
  });

  describe('POST /auth/login', () => {
    const validUser = generateTestData.user({
      email: 'admin@example.com',
      passwordHash: '$2a$10$hashedpassword',
    });

    it('should login successfully with valid credentials', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('generated-jwt-token');

      const response = await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .send({
          email: 'admin@example.com',
          password: 'correct-password',
        })
        .expect(200);

      expect(response.body).toEqual({
        token: 'generated-jwt-token',
        user: {
          id: validUser.id,
          email: validUser.email,
          role: validUser.role,
        },
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
        expect.any(String),
        { expiresIn: '24h' }
      );
    });

    it('should reject login with invalid email', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(null);

      const response = await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .send({
          email: 'nonexistent@example.com',
          password: 'any-password',
        })
        .expect(401);

      expect(response.body).toEqual({ error: 'Invalid credentials' });
      expect(mockPrisma.appUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' },
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('should reject login with invalid password', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(false);

      const response = await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .send({
          email: 'admin@example.com',
          password: 'wrong-password',
        })
        .expect(401);

      expect(response.body).toEqual({ error: 'Invalid credentials' });
      expect(mockPrisma.appUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', validUser.passwordHash);
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('should validate email format', async () => {
      const response = await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .send({
          email: 'invalid-email',
          password: 'any-password',
        })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
      expect(mockPrisma.appUser.findUnique).not.toHaveBeenCalled();
    });

    it('should require password', async () => {
      const response = await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .send({
          email: 'admin@example.com',
          // password missing
        })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
      expect(mockPrisma.appUser.findUnique).not.toHaveBeenCalled();
    });

    it('should require non-empty password', async () => {
      const response = await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .send({
          email: 'admin@example.com',
          password: '',
        })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
      expect(mockPrisma.appUser.findUnique).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.appUser.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const response = await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .send({
          email: 'admin@example.com',
          password: 'any-password',
        })
        .expect(500);

      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    it('should handle bcrypt errors gracefully', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
      mockBcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

      const response = await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .send({
          email: 'admin@example.com',
          password: 'any-password',
        })
        .expect(500);

      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    it('should handle JWT signing errors gracefully', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      const response = await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .send({
          email: 'admin@example.com',
          password: 'correct-password',
        })
        .expect(500);

      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    it('should use default JWT configuration when env vars not set', async () => {
      delete process.env.JWT_SECRET;
      delete process.env.JWT_EXPIRES_IN;

      mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('token');

      await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .send({
          email: 'admin@example.com',
          password: 'correct-password',
        })
        .expect(200);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        'default-jwt-secret-change-in-production',
        { expiresIn: '24h' }
      );
    });

    it('should handle missing request body', async () => {
      const response = await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid request data',
        details: expect.any(Array),
      });
    });

    it('should handle extra fields in request body gracefully', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('token');

      const response = await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .send({
          email: 'admin@example.com',
          password: 'correct-password',
          extraField: 'should-be-ignored',
        })
        .expect(200);

      expect(response.body).toEqual({
        token: 'token',
        user: expect.any(Object),
      });
    });

    it('should not expose sensitive user information', async () => {
      const userWithSensitiveData = {
        ...validUser,
        passwordHash: 'sensitive-hash',
        resetToken: 'sensitive-token',
      };
      
      mockPrisma.appUser.findUnique.mockResolvedValue(userWithSensitiveData);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('token');

      const response = await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .send({
          email: 'admin@example.com',
          password: 'correct-password',
        })
        .expect(200);

      expect(response.body.user).toEqual({
        id: validUser.id,
        email: validUser.email,
        role: validUser.role,
      });
      
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.user).not.toHaveProperty('resetToken');
    });

    it('should handle case-sensitive email lookup correctly', async () => {
      mockPrisma.appUser.findUnique.mockResolvedValue(null);

      const response = await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .send({
          email: 'ADMIN@EXAMPLE.COM',
          password: 'any-password',
        })
        .expect(401);

      expect(mockPrisma.appUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'ADMIN@EXAMPLE.COM' },
      });
      expect(response.body).toEqual({ error: 'Invalid credentials' });
    });

    it('should handle different user roles correctly', async () => {
      const regularUser = generateTestData.user({
        email: 'user@example.com',
        role: 'USER',
      });
      
      mockPrisma.appUser.findUnique.mockResolvedValue(regularUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('token');

      const response = await request
        .post('/auth/login')
        .set(unAuthHeaders())
        .send({
          email: 'user@example.com',
          password: 'correct-password',
        })
        .expect(200);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          userId: regularUser.id,
          email: regularUser.email,
          role: 'USER',
        },
        expect.any(String),
        expect.any(Object)
      );
      
      expect(response.body.user.role).toBe('USER');
    });

    describe('Security considerations', () => {
      it('should not reveal whether email or password is wrong', async () => {
        // Test invalid email
        mockPrisma.appUser.findUnique.mockResolvedValue(null);
        const response1 = await request
          .post('/auth/login')
          .set(unAuthHeaders())
          .send({
            email: 'wrong@example.com',
            password: 'any-password',
          })
          .expect(401);

        // Test invalid password
        mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
        mockBcrypt.compare.mockResolvedValue(false);
        const response2 = await request
          .post('/auth/login')
          .set(unAuthHeaders())
          .send({
            email: 'admin@example.com',
            password: 'wrong-password',
          })
          .expect(401);

        // Both should return the same error message
        expect(response1.body).toEqual({ error: 'Invalid credentials' });
        expect(response2.body).toEqual({ error: 'Invalid credentials' });
      });

      it('should use timing-safe password comparison', async () => {
        mockPrisma.appUser.findUnique.mockResolvedValue(validUser);
        
        await request
          .post('/auth/login')
          .set(unAuthHeaders())
          .send({
            email: 'admin@example.com',
            password: 'test-password',
          });

        // Verify bcrypt.compare was used (timing-safe)
        expect(bcrypt.compare).toHaveBeenCalledWith('test-password', validUser.passwordHash);
      });

      it('should not expose internal error details', async () => {
        mockPrisma.appUser.findUnique.mockRejectedValue(
          new Error('Sensitive database error with connection string')
        );

        const response = await request
          .post('/auth/login')
          .set(unAuthHeaders())
          .send({
            email: 'admin@example.com',
            password: 'any-password',
          })
          .expect(500);

        expect(response.body).toEqual({ error: 'Internal server error' });
        // Should not expose the actual database error
      });
    });
  });
});