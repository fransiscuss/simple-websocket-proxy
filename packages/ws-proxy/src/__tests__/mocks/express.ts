import { vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock Express Request
export const createMockRequest = (overrides: Partial<Request> = {}): Request => {
  const req = {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: undefined,
    path: '/',
    method: 'GET',
    url: '/',
    originalUrl: '/',
    ip: '127.0.0.1',
    ips: [],
    protocol: 'http',
    secure: false,
    xhr: false,
    ...overrides,
  } as Request;
  
  return req;
};

// Mock Express Response
export const createMockResponse = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    getHeader: vi.fn(),
    removeHeader: vi.fn().mockReturnThis(),
    locals: {},
    headersSent: false,
    statusCode: 200,
    statusMessage: 'OK',
  } as any;
  
  return res;
};

// Mock Express NextFunction
export const createMockNext = (): NextFunction => {
  return vi.fn();
};

// Helper to create authenticated request
export const createAuthenticatedRequest = (userOverrides: any = {}): Request => {
  return createMockRequest({
    user: {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'ADMIN',
      ...userOverrides,
    },
    headers: {
      authorization: 'Bearer valid-jwt-token',
    },
  });
};

// Helper to create request with invalid auth
export const createUnauthenticatedRequest = (): Request => {
  return createMockRequest({
    headers: {},
  });
};

// Helper to create request with invalid token
export const createInvalidTokenRequest = (): Request => {
  return createMockRequest({
    headers: {
      authorization: 'Bearer invalid-token',
    },
  });
};