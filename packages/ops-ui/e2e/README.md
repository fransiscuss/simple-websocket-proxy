# E2E Test Suite Documentation

This directory contains comprehensive end-to-end tests for the WebSocket Proxy Operations UI using Playwright.

## Test Coverage Overview

### 1. **websocket.spec.ts** - WebSocket Live Functionality
- WebSocket connection establishment and failure handling
- Auto-reconnection logic
- Real-time session and metrics updates
- Message rate limiting and backpressure
- WebSocket control commands (session kill)
- Dashboard WebSocket integration
- Security and validation
- Authentication and connection limits

### 2. **dashboard.comprehensive.spec.ts** - Dashboard Functionality  
- Metrics cards display and real-time updates
- Recent activity and endpoint overview
- Traffic charts and visualizations
- System health indicators
- Alerts and notifications
- Quick actions and shortcuts
- Performance metrics trends
- Error handling and recovery
- Performance optimization

### 3. **traffic.comprehensive.spec.ts** - Traffic Monitoring
- Live session grid and session tiles
- Session details modal with comprehensive information
- Filtering by status, endpoint, and search
- Real-time WebSocket updates
- Session management (kill operations)
- Traffic charts and flow visualization
- Data export functionality
- Time range selection
- Pagination for large datasets
- Auto-refresh functionality

### 4. **audit.comprehensive.spec.ts** - Audit Log Management
- Audit log table with sorting and filtering
- Log details modal with metadata and changes
- Filter by action, resource, user, and date range
- Search functionality with debouncing
- Export to CSV and JSON formats
- Pagination for large log datasets
- Custom date range selection
- Log formatting and accessibility
- Performance with large datasets

### 5. **forms.validation.spec.ts** - Form Validation
- Comprehensive endpoint form validation
- Required field validation
- URL and name constraint validation
- Connection limits and sampling validation
- Form interdependency validation
- Connection testing functionality
- Edit mode validation
- Error recovery and network handling
- Server validation error handling
- Accessibility support

### 6. **responsive.spec.ts** - Responsive Design
- Mobile device optimization (375px, 414px)
- Tablet layouts (768px, 1024px)
- Desktop variations (1280px, 1920px)
- Touch interaction support
- Navigation menu adaptation
- Table and form responsiveness
- Content adaptation across viewports
- Performance on mobile devices
- Cross-device consistency

### 7. **accessibility.spec.ts** - Accessibility Compliance
- WCAG compliance and landmarks
- Keyboard navigation support
- Screen reader compatibility
- ARIA labels and descriptions
- Focus management and indicators
- High contrast mode support
- Reduced motion preferences
- Form accessibility
- Error announcements
- Mobile touch accessibility

### 8. **integration.workflows.spec.ts** - End-to-End User Workflows
- Complete endpoint creation workflow
- Endpoint management lifecycle
- Traffic monitoring workflow
- Audit investigation workflow
- Error recovery workflows
- State consistency across pages
- Session timeout and re-authentication
- Data consistency verification
- Concurrent user actions
- Performance under load

### 9. **performance.spec.ts** - Performance Testing
- Page load time optimization
- Large dataset handling
- User interaction responsiveness
- Real-time update performance
- Memory and resource management
- Network optimization
- WebSocket reconnection efficiency
- DOM update optimization
- Resource cleanup

## Test Structure

### Page Objects
- `pages/dashboard.page.ts` - Dashboard page interactions
- `pages/endpoints.page.ts` - Endpoints list management
- `pages/endpoint-form.page.ts` - Endpoint creation/editing
- `pages/traffic.page.ts` - Traffic monitoring interface
- `pages/audit.page.ts` - Audit log viewing
- `pages/login.page.ts` - Authentication interface

### Fixtures and Mocks
- `fixtures/api-mocks.ts` - Comprehensive API mocking
- `fixtures/test-data.ts` - Test data and mock objects

### Test Categories

#### Functional Tests
- User authentication and authorization
- CRUD operations for endpoints
- Real-time data monitoring
- Search and filtering functionality
- Data export capabilities

#### UI/UX Tests
- Responsive design across devices
- Accessibility compliance (WCAG 2.1)
- Form validation and error handling
- Loading states and user feedback
- Navigation and routing

#### Integration Tests
- Complete user workflows
- Cross-page state management
- API integration testing
- WebSocket functionality
- Error recovery scenarios

#### Performance Tests
- Page load optimization
- Large dataset handling
- Real-time update efficiency
- Memory usage monitoring
- Network request optimization

## Running Tests

### Prerequisites
- Node.js 18+ installed
- Dependencies installed via `pnpm install`
- Backend services running (ws-proxy on port 8080)

### Commands

```bash
# Run all tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e websocket.spec.ts

# Run tests with UI
pnpm test:e2e --ui

# Run tests in debug mode
pnpm test:e2e --debug

# Run tests on specific browser
pnpm test:e2e --project=chromium

# Run tests on mobile
pnpm test:e2e --project="Mobile Chrome"

# Run only unauthenticated tests
pnpm test:e2e --grep="unauthenticated"
```

### Test Configuration

Tests are configured via `playwright.config.ts` with:
- Multiple browser projects (Chrome, Firefox, Safari)
- Mobile device testing (iPhone, Android)
- Authentication state management
- Parallel execution
- Retry logic for CI environments
- Video and screenshot capture
- HTML and JUnit reporting

## Best Practices

### Test Design
- Page Object Model for maintainability
- Comprehensive API mocking
- Independent test scenarios
- Proper cleanup and teardown
- Deterministic test data

### Assertions
- Behavioral assertions over implementation
- Clear error messages
- Timeout handling
- State verification
- Visual regression prevention

### Performance
- Efficient selectors
- Minimal wait times
- Resource cleanup
- Memory management
- Network optimization

## CI/CD Integration

Tests are designed to run in CI environments with:
- Retry logic for flaky tests
- Parallel execution across browsers
- Comprehensive reporting
- Screenshot and video artifacts
- Performance monitoring

## Coverage Goals

- **Functional Coverage**: 95% of user workflows
- **Browser Coverage**: Chrome, Firefox, Safari
- **Device Coverage**: Desktop, tablet, mobile
- **Accessibility Coverage**: WCAG 2.1 AA compliance
- **Performance Coverage**: Core user journeys

## Maintenance

### Adding New Tests
1. Create test file following naming convention
2. Use existing page objects or create new ones
3. Add appropriate API mocks
4. Follow accessibility guidelines
5. Include responsive design checks

### Updating Tests
1. Update page objects for UI changes
2. Modify API mocks for backend changes
3. Adjust assertions for behavior changes
4. Maintain test data consistency
5. Update documentation

### Debugging
1. Use `--debug` flag for step-through debugging
2. Check screenshots and videos in test-results/
3. Review HTML reports for detailed information
4. Use browser dev tools with `--headed` mode
5. Check API mock responses in network tab