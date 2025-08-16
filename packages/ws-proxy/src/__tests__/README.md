# WebSocket Proxy Test Suite

This directory contains comprehensive unit and integration tests for the WebSocket proxy service using Vitest.

## Test Structure

```
__tests__/
├── helpers/
│   └── test-setup.ts          # Test utilities and data generators
├── mocks/
│   ├── express.ts             # Express request/response mocks
│   ├── prisma.ts              # Prisma client mocks
│   └── websocket.ts           # WebSocket mocks
├── middleware/
│   └── auth.test.ts           # Authentication middleware tests
├── proxy/
│   └── websocket-proxy.test.ts # Core WebSocket proxy tests
├── routes/
│   ├── auth.test.ts           # Authentication route tests
│   └── endpoints.test.ts      # Endpoint management route tests
├── services/
│   ├── database.test.ts       # Database service tests
│   ├── session-manager.test.ts # Session management tests
│   └── telemetry.test.ts      # Telemetry service tests
├── utils/
│   └── logger.test.ts         # Logging utility tests
├── setup.ts                   # Global test setup
└── README.md                  # This file
```

## Test Categories

### Unit Tests
- **Services**: Database operations, session management, telemetry
- **Utilities**: Logging functionality
- **Middleware**: Authentication and authorization
- **Proxy**: Core WebSocket proxy logic

### Integration Tests
- **Routes**: API endpoint behavior with mocked dependencies
- **End-to-End**: Complete request/response cycles

## Test Helpers

### Mock Objects
- **MockWebSocket**: Simulates WebSocket connections with event handling
- **MockPrismaClient**: Database client with configurable responses
- **Express Mocks**: Request, response, and next function mocks

### Test Data Generators
- **generateTestData**: Creates consistent test objects for users, endpoints, sessions, etc.
- **generateTestJWT**: Creates valid JWT tokens for authentication tests

### Utilities
- **waitFor**: Async helper for timing-dependent tests
- **createTestRequest/Response**: Express object factories
- **setupTestEnvironment**: Global test configuration

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts

# Run in watch mode
npm test -- --watch

# Run tests matching pattern
npm test -- --grep "WebSocket"
```

## Coverage Targets

The test suite aims for:
- **80%+ line coverage**
- **80%+ function coverage**
- **80%+ branch coverage**
- **80%+ statement coverage**

## Test Patterns

### Arrange-Act-Assert
```typescript
it('should create session successfully', async () => {
  // Arrange
  const endpointId = 'endpoint-123';
  mockDatabaseService.createSession.mockResolvedValue('session-123');
  
  // Act
  const sessionId = await sessionManager.createSession(endpointId, mockWebSocket);
  
  // Assert
  expect(sessionId).toBe('session-123');
  expect(mockDatabaseService.createSession).toHaveBeenCalledWith(endpointId);
});
```

### Error Testing
```typescript
it('should handle database errors', async () => {
  // Arrange
  mockPrisma.endpoint.findUnique.mockRejectedValue(new Error('Database error'));
  
  // Act & Assert
  await expect(databaseService.getEndpoint('test-id')).rejects.toThrow('Database error');
});
```

### Async Testing
```typescript
it('should handle WebSocket connection timeout', async () => {
  vi.useFakeTimers();
  
  const connectionPromise = proxy.handleConnection(mockWs, mockRequest, 'endpoint-123');
  
  vi.advanceTimersByTime(15000);
  
  await expect(connectionPromise).rejects.toThrow();
  
  vi.useRealTimers();
});
```

## Best Practices

### Test Independence
- Each test is isolated and can run independently
- Mocks are reset between tests
- No shared state between tests

### Descriptive Names
- Test names clearly describe the scenario and expected outcome
- Use "should" statements for clarity

### Edge Cases
- Test both happy path and error scenarios
- Include boundary conditions and invalid inputs
- Test timeout and connection failure scenarios

### Mock Strategy
- Mock external dependencies (database, WebSocket connections)
- Use dependency injection for testability
- Verify mock interactions where relevant

## Mock Configurations

### Database Service
```typescript
mockDatabaseService.getEndpoint.mockResolvedValue(testEndpoint);
mockDatabaseService.createSession.mockResolvedValue('session-123');
```

### WebSocket Connections
```typescript
const mockWs = new MockWebSocket();
mockWs.simulateMessage('test message', false);
mockWs.simulateClose(1000, 'Normal closure');
```

### Express Routes
```typescript
const req = createAuthenticatedRequest({
  body: { name: 'Test Endpoint' },
  params: { id: 'endpoint-123' }
});
```

## Testing Guidelines

1. **Test Behavior, Not Implementation**: Focus on what the code should do, not how it does it
2. **One Assertion Per Test**: Each test should verify one specific behavior
3. **Clear Test Structure**: Use consistent arrange-act-assert pattern
4. **Meaningful Assertions**: Verify both positive and negative outcomes
5. **Mock External Dependencies**: Isolate units under test
6. **Test Error Scenarios**: Include unhappy path testing
7. **Use Descriptive Names**: Test names should read like specifications

## Common Patterns

### Testing Async Operations
```typescript
it('should handle async database operations', async () => {
  mockPrisma.endpoint.create.mockResolvedValue(testEndpoint);
  
  const result = await endpointService.createEndpoint(data);
  
  expect(result).toEqual(testEndpoint);
});
```

### Testing Event Emitters
```typescript
it('should emit events correctly', () => {
  const eventSpy = vi.fn();
  emitter.on('test-event', eventSpy);
  
  emitter.emit('test-event', { data: 'test' });
  
  expect(eventSpy).toHaveBeenCalledWith({ data: 'test' });
});
```

### Testing WebSocket Handlers
```typescript
it('should handle WebSocket messages', async () => {
  await proxy.handleConnection(mockClientWs, mockRequest, 'endpoint-123');
  
  mockClientWs.simulateMessage('test message', false);
  
  expect(mockSessionManager.trackMessage).toHaveBeenCalled();
});
```

This test suite provides comprehensive coverage of the WebSocket proxy service, ensuring reliability and maintainability of the codebase.