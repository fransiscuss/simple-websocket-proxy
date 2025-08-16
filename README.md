# Simple WebSocket Proxy

[![Build Status](https://github.com/your-org/simple-websocket-proxy/workflows/CI/badge.svg)](https://github.com/your-org/simple-websocket-proxy/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.17.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

A professional, enterprise-grade WebSocket proxy server with real-time monitoring, administration UI, and comprehensive observability features. Built for production environments requiring low-latency bidirectional WebSocket relaying with advanced traffic management and audit capabilities.

## 🚀 Features

### Core Proxy Functionality
- **Low-latency bidirectional WebSocket relay** with strict backpressure handling
- **Dynamic endpoint configuration** with per-endpoint limits and sampling
- **Text and binary frame support** with fragmentation handling
- **Connection pooling and timeout management**
- **Health checks and graceful shutdown**

### Operations & Monitoring
- **Real-time traffic monitoring** dashboard with live session visualization
- **Professional admin UI** built with Next.js, Tailwind CSS, and shadcn/ui
- **Comprehensive audit logging** with detailed change tracking
- **Live telemetry WebSocket** for real-time ops data streaming
- **Session management** with manual session termination capabilities

### Enterprise Features
- **PostgreSQL-backed configuration** with Prisma ORM integration
- **JWT-based authentication** with default admin seeding
- **Structured logging** with configurable levels using Pino
- **Docker deployment** with health checks and multi-stage builds
- **Comprehensive testing** (unit, integration, and E2E)
- **Performance metrics** and observability hooks

## 📋 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Development Guide](#-development-guide)
- [Deployment](#-deployment)
- [Monitoring & Observability](#-monitoring--observability)
- [Security](#-security)
- [Performance Tuning](#-performance-tuning)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   Ops UI (3000) │    │  PostgreSQL DB │
│                 │    │   Next.js + UI   │    │   Config/Audit │
└─────────┬───────┘    └─────────┬────────┘    └─────────┬───────┘
          │                      │                       │
          │ WebSocket            │ HTTP API              │ Prisma
          │ /ws/:endpointId      │ /api/*                │ ORM
          │                      │                       │
          └──────────────────────┼───────────────────────┼─────────┐
                                 │                       │         │
                              ┌──▼───────────────────────▼─────────▼──┐
                              │        WS-Proxy Server (8080)         │
                              │  ┌─────────────┐  ┌─────────────────┐  │
                              │  │ WebSocket   │  │ REST API        │  │
                              │  │ Relay       │  │ /api/endpoints  │  │
                              │  │ Engine      │  │ /api/sessions   │  │
                              │  │             │  │ /api/audit      │  │
                              │  └─────────────┘  └─────────────────┘  │
                              │  ┌─────────────┐  ┌─────────────────┐  │
                              │  │ Session     │  │ Ops WebSocket   │  │
                              │  │ Manager     │  │ /ops (telemetry)│  │
                              │  │             │  │                 │  │
                              │  └─────────────┘  └─────────────────┘  │
                              └────────────────────────────────────────┘
                                                 │
                                                 │ WebSocket Relay
                                                 │
                                        ┌────────▼────────┐
                                        │  Target Server  │
                                        │ (Configurable)  │
                                        └─────────────────┘
```

### Components

#### 🔌 WS-Proxy Server (`packages/ws-proxy`)
- **Technology**: Node.js 20+, TypeScript, Express, WebSocket (ws)
- **Database**: PostgreSQL with Prisma ORM
- **Logging**: Structured logging with Pino
- **Testing**: Vitest (unit), Supertest (integration)

#### 🖥️ Ops UI (`packages/ops-ui`)
- **Technology**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Testing**: Vitest (unit), Playwright (E2E)
- **Features**: Real-time dashboards, responsive design, accessibility

## 🚀 Quick Start

Get up and running in under 5 minutes:

### Prerequisites
- **Node.js** 18.17.0 or higher
- **pnpm** 8.0.0 or higher
- **Docker** and Docker Compose (for development)

### 1. Clone and Install
```bash
git clone https://github.com/your-org/simple-websocket-proxy.git
cd simple-websocket-proxy
pnpm install
```

### 2. Start Development Environment
```bash
# Starts PostgreSQL, ws-proxy, and ops-ui with hot reload
pnpm dev
```

### 3. Access the Application
- **Ops UI**: http://localhost:3000
- **WebSocket Proxy**: ws://localhost:8080/ws/:endpointId
- **API Documentation**: http://localhost:8080/api (see API section)

### 4. Default Admin Login
- **Email**: `admin@example.com`
- **Password**: `admin123`

### 5. Create Your First Endpoint
1. Log in to the Ops UI
2. Navigate to "Endpoints" → "New Endpoint"
3. Configure your target WebSocket server
4. Test the connection using: `ws://localhost:8080/ws/your-endpoint-id`

## 📦 Installation

### Development Setup

#### Using Docker (Recommended)
```bash
# Clone repository
git clone https://github.com/your-org/simple-websocket-proxy.git
cd simple-websocket-proxy

# Install dependencies
pnpm install

# Start development environment
pnpm dev
```

#### Local Development (Advanced)
```bash
# 1. Start PostgreSQL (adjust connection details as needed)
docker run --name postgres-dev -e POSTGRES_DB=websocket_proxy \
  -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=dev123 \
  -p 5432:5432 -d postgres:15-alpine

# 2. Install dependencies
pnpm install

# 3. Set up database
cd packages/ws-proxy
pnpm db:migrate
pnpm db:seed

# 4. Start services separately
cd packages/ws-proxy
pnpm dev  # Terminal 1

cd packages/ops-ui
pnpm dev  # Terminal 2
```

### Production Deployment

#### Docker Compose (Production)
```bash
# Create production docker-compose.yml
cp docker/docker-compose.dev.yml docker-compose.prod.yml

# Update environment variables for production
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d
```

#### Manual Deployment
```bash
# Build all packages
pnpm build

# Deploy ws-proxy
cd packages/ws-proxy
NODE_ENV=production \
DATABASE_URL=postgresql://user:pass@host:5432/db \
DEFAULT_ADMIN_EMAIL=admin@yourcompany.com \
DEFAULT_ADMIN_PASSWORD=secure_password \
pnpm start

# Deploy ops-ui
cd packages/ops-ui
NODE_ENV=production \
API_BASE_URL=https://your-api.com/api \
NEXT_PUBLIC_WS_OPS_URL=wss://your-api.com/ops \
pnpm start
```

## ⚙️ Configuration

### Environment Variables

#### WS-Proxy Server
```bash
# Core Configuration
NODE_ENV=development                # development | production
PORT=8080                          # Server port
LOG_LEVEL=info                     # debug | info | warn | error

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Authentication
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=admin123
JWT_SECRET=your-secret-key         # Auto-generated if not provided

# Default Limits (JSON)
LIMITS_DEFAULT={"maxConnections":100,"maxMessageSize":1048576,"timeoutMs":30000}
SAMPLING_DEFAULT=false             # Enable traffic sampling by default

# Performance Tuning
WS_PING_INTERVAL=30000            # WebSocket ping interval (ms)
WS_PONG_TIMEOUT=5000              # WebSocket pong timeout (ms)
SESSION_CLEANUP_INTERVAL=60000    # Session cleanup interval (ms)
```

#### Ops UI
```bash
# Core Configuration
NODE_ENV=development
PORT=3000

# API Integration
API_BASE_URL=http://ws-proxy:8080/api
NEXT_PUBLIC_WS_OPS_URL=ws://localhost:8080/ops

# Authentication
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000
```

### Database Schema

The system uses PostgreSQL with the following core entities:

```sql
-- Admin users
app_user (id, email, password_hash, role, created_at)

-- Proxy endpoints configuration
endpoint (id, name, target_url, limits, sampling, enabled, created_at, updated_at)

-- Active WebSocket sessions
live_session (id, endpoint_id, started_at, last_seen, msgs_in, msgs_out, bytes_in, bytes_out, state)

-- Traffic sampling (optional)
traffic_sample (id, session_id, endpoint_id, direction, timestamp, size_bytes, content)

-- Audit trail
audit_log (id, action, entity_type, entity_id, details, timestamp)
```

## 📚 API Documentation

### REST API Endpoints

#### Authentication
```http
POST /api/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin123"
}

Response: 200 OK
{
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "email": "admin@example.com",
    "role": "ADMIN"
  }
}
```

#### Endpoints Management
```http
# List all endpoints
GET /api/endpoints
Authorization: Bearer jwt-token

# Create endpoint
POST /api/endpoints
Authorization: Bearer jwt-token
Content-Type: application/json

{
  "name": "My WebSocket Server",
  "targetUrl": "ws://target-server:8080",
  "limits": {
    "maxConnections": 100,
    "maxMessageSize": 1048576,
    "timeoutMs": 30000
  },
  "sampling": {
    "enabled": true,
    "percentage": 10,
    "maxSamples": 1000
  }
}

# Get endpoint details
GET /api/endpoints/:id
Authorization: Bearer jwt-token

# Update endpoint
PATCH /api/endpoints/:id
Authorization: Bearer jwt-token

# Delete endpoint
DELETE /api/endpoints/:id
Authorization: Bearer jwt-token
```

#### Session Management
```http
# List active sessions
GET /api/sessions
Authorization: Bearer jwt-token

# Get sessions for specific endpoint
GET /api/endpoints/:id/sessions
Authorization: Bearer jwt-token

# Get session statistics
GET /api/endpoints/:id/stats
Authorization: Bearer jwt-token
```

#### Audit Logs
```http
# List audit logs with pagination
GET /api/audit?page=1&limit=50&action=CREATE&entityType=endpoint
Authorization: Bearer jwt-token

# Export audit logs
GET /api/audit/export?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer jwt-token
```

### WebSocket Endpoints

#### Public Proxy Endpoint
```javascript
// Connect to proxied WebSocket
const ws = new WebSocket('ws://localhost:8080/ws/endpoint-id');

ws.onopen = () => {
  console.log('Connected to proxy');
  ws.send('Hello target server!');
};

ws.onmessage = (event) => {
  console.log('Received:', event.data);
};

ws.onclose = (event) => {
  console.log('Connection closed:', event.code, event.reason);
};
```

#### Ops Telemetry Endpoint
```javascript
// Connect to live telemetry (admin only)
const opsWs = new WebSocket('ws://localhost:8080/ops');

opsWs.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'sessionStarted':
      console.log('New session:', data.session);
      break;
    case 'sessionUpdated':
      console.log('Session updated:', data.session);
      break;
    case 'sessionEnded':
      console.log('Session ended:', data.session);
      break;
    case 'messageMeta':
      console.log('Message metadata:', data.meta);
      break;
    case 'sampledPayload':
      console.log('Sampled content:', data.sample);
      break;
  }
};

// Send control commands
opsWs.send(JSON.stringify({
  type: 'session.kill',
  sessionId: 'session-id-to-terminate'
}));
```

## 🛠️ Development Guide

### Project Structure
```
simple-websocket-proxy/
├── packages/
│   ├── ws-proxy/           # WebSocket proxy server
│   │   ├── src/
│   │   │   ├── index.ts    # Server entry point
│   │   │   ├── proxy/      # WebSocket proxy logic
│   │   │   ├── routes/     # REST API routes
│   │   │   ├── services/   # Business logic services
│   │   │   ├── middleware/ # Express middleware
│   │   │   └── types/      # TypeScript definitions
│   │   ├── prisma/         # Database schema & migrations
│   │   └── __tests__/      # Test suites
│   │
│   └── ops-ui/             # Admin operations UI
│       ├── app/            # Next.js 14 app router
│       ├── components/     # React components
│       ├── lib/            # Utilities and hooks
│       └── e2e/            # Playwright E2E tests
│
├── docker/                 # Docker configurations
└── docs/                   # Additional documentation
```

### Development Commands

#### Root Level Commands
```bash
# Start full development environment
pnpm dev

# Run all tests across packages
pnpm test

# Build all packages
pnpm build

# Lint all packages
pnpm lint

# Type check all packages
pnpm typecheck
```

#### WS-Proxy Specific
```bash
cd packages/ws-proxy

# Development with hot reload
pnpm dev

# Run unit tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Database operations
pnpm db:migrate     # Apply migrations
pnpm db:generate    # Generate Prisma client
pnpm db:seed        # Seed default data

# Build for production
pnpm build
```

#### Ops UI Specific
```bash
cd packages/ops-ui

# Development server
pnpm dev

# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e
pnpm test:e2e:ui    # With Playwright UI
pnpm test:e2e:debug # Debug mode

# Build for production
pnpm build
```

### Testing Strategy

#### Unit Tests (ws-proxy)
- **Framework**: Vitest
- **Coverage**: 88% (144/163 tests passing)
- **Focus**: Services, utilities, middleware

```bash
# Run specific test suites
pnpm test database          # Database service tests
pnpm test session-manager   # Session management tests
pnpm test auth              # Authentication tests
```

#### Integration Tests (ws-proxy)
- **Framework**: Supertest + Vitest
- **Coverage**: HTTP endpoints, WebSocket connections
- **Authentication**: JWT token-based testing

```bash
# Run integration test suite
pnpm test integration/
```

#### End-to-End Tests (ops-ui)
- **Framework**: Playwright
- **Coverage**: Complete user workflows
- **Browsers**: Chromium, Firefox, WebKit

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test categories
pnpm test:e2e auth.*        # Authentication flows
pnpm test:e2e endpoints.*   # Endpoint management
pnpm test:e2e traffic.*     # Traffic monitoring
```

### Code Quality

#### TypeScript Configuration
- Strict mode enabled
- Path mapping for clean imports
- Consistent compiler options across packages

#### ESLint Rules
- TypeScript-specific rules
- Import/export consistency
- Code formatting with Prettier integration

#### Pre-commit Hooks
```bash
# Install husky for git hooks
npx husky install

# Add pre-commit validation
npx husky add .husky/pre-commit "pnpm lint && pnpm typecheck && pnpm test"
```

## 🚀 Deployment

### Production Deployment Checklist

#### Security Configuration
- [ ] Change default admin credentials
- [ ] Set strong JWT secret
- [ ] Configure HTTPS/WSS with valid certificates
- [ ] Set up database connection with SSL
- [ ] Configure CORS policies
- [ ] Enable rate limiting

#### Environment Setup
- [ ] Set `NODE_ENV=production`
- [ ] Configure production database URL
- [ ] Set appropriate log levels
- [ ] Configure monitoring endpoints
- [ ] Set up backup strategies

#### Infrastructure
- [ ] Set up load balancing for WebSocket connections
- [ ] Configure health checks
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Set up database backups

### Docker Production Setup

#### 1. Production Docker Compose
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: websocket_proxy
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped

  ws-proxy:
    image: your-registry/ws-proxy:latest
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/websocket_proxy
      DEFAULT_ADMIN_EMAIL: ${ADMIN_EMAIL}
      DEFAULT_ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "8080:8080"
    depends_on:
      - postgres
    restart: unless-stopped

  ops-ui:
    image: your-registry/ops-ui:latest
    environment:
      NODE_ENV: production
      API_BASE_URL: http://ws-proxy:8080/api
      NEXT_PUBLIC_WS_OPS_URL: wss://your-domain.com/ops
    ports:
      - "3000:3000"
    depends_on:
      - ws-proxy
    restart: unless-stopped

volumes:
  postgres_data:
```

#### 2. Build and Push Images
```bash
# Build production images
docker build -t your-registry/ws-proxy:latest packages/ws-proxy/
docker build -t your-registry/ops-ui:latest packages/ops-ui/

# Push to registry
docker push your-registry/ws-proxy:latest
docker push your-registry/ops-ui:latest
```

### Kubernetes Deployment

#### Example Kubernetes manifests:

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ws-proxy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ws-proxy
  template:
    metadata:
      labels:
        app: ws-proxy
    spec:
      containers:
      - name: ws-proxy
        image: your-registry/ws-proxy:latest
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Cloud Platform Deployment

#### AWS ECS/Fargate
- Use Application Load Balancer with WebSocket support
- Configure target groups with health checks
- Set up CloudWatch logging and monitoring
- Use RDS PostgreSQL for database

#### Google Cloud Run
- Enable WebSocket support in service configuration
- Use Cloud SQL for PostgreSQL
- Configure Cloud Logging
- Set up load balancing

#### Azure Container Instances
- Configure WebSocket support
- Use Azure Database for PostgreSQL
- Set up Application Insights monitoring
- Configure Azure Load Balancer

## 📊 Monitoring & Observability

### Health Checks

#### Built-in Health Endpoints
```bash
# Basic health check
curl http://localhost:8080/healthz

# Response
{
  "status": "healthy",
  "timestamp": "2024-08-16T10:30:00.000Z",
  "uptime": 3600.123,
  "version": "1.0.0",
  "checks": {
    "database": "healthy",
    "memory": "healthy",
    "disk": "healthy"
  }
}
```

#### Database Health
```bash
# Extended health check with database connection
curl http://localhost:8080/healthz?detailed=true

# Response includes database connection status, query performance, etc.
```

### Metrics and Logging

#### Structured Logging Format
```json
{
  "level": "info",
  "time": "2024-08-16T10:30:00.000Z",
  "msg": "WebSocket connection established",
  "endpointId": "endpoint-123",
  "sessionId": "session-456",
  "clientIp": "192.168.1.100",
  "targetUrl": "ws://target-server:8080",
  "duration": 150
}
```

#### Key Metrics to Monitor
- **Connection Metrics**: Active connections, connection rate, connection duration
- **Message Metrics**: Messages per second, message size distribution, error rates
- **Performance Metrics**: Latency percentiles, throughput, backpressure events
- **System Metrics**: Memory usage, CPU usage, disk I/O

#### Prometheus Integration
```bash
# Example prometheus.yml configuration
- job_name: 'websocket-proxy'
  static_configs:
    - targets: ['localhost:8080']
  scrape_interval: 15s
  metrics_path: /metrics
```

### Log Aggregation

#### ELK Stack Integration
```yaml
# logstash.conf
input {
  beats {
    port => 5044
  }
}

filter {
  if [fields][service] == "websocket-proxy" {
    json {
      source => "message"
    }
    
    date {
      match => [ "time", "ISO8601" ]
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "websocket-proxy-%{+YYYY.MM.dd}"
  }
}
```

#### Grafana Dashboard
Key visualizations:
- Real-time connection count
- Message throughput over time
- Error rate trends
- Latency percentiles
- System resource usage

### Alerting Rules

#### Critical Alerts
```yaml
# prometheus-alerts.yml
groups:
- name: websocket-proxy
  rules:
  - alert: HighErrorRate
    expr: rate(websocket_errors_total[5m]) > 0.1
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      
  - alert: HighLatency
    expr: histogram_quantile(0.95, rate(websocket_duration_seconds_bucket[5m])) > 1.0
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High latency detected"
```

## 🔒 Security

### Authentication & Authorization

#### JWT Token Security
- **Algorithm**: RS256 (RSA with SHA-256)
- **Expiration**: Configurable (default: 24 hours)
- **Refresh**: Implement refresh token rotation
- **Validation**: Signature verification on every request

#### Password Security
- **Hashing**: bcrypt with salt rounds ≥ 12
- **Complexity**: Enforce strong password policies
- **Storage**: Never store plaintext passwords

### Network Security

#### HTTPS/WSS Configuration
```nginx
# nginx.conf for SSL termination
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /ws/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

#### CORS Configuration
```typescript
// Secure CORS setup
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
```

### Input Validation & Sanitization

#### Request Validation
```typescript
// Example endpoint validation schema
const createEndpointSchema = z.object({
  name: z.string().min(1).max(100),
  targetUrl: z.string().url().refine(url => url.startsWith('ws://') || url.startsWith('wss://')),
  limits: z.object({
    maxConnections: z.number().int().min(1).max(10000),
    maxMessageSize: z.number().int().min(1024).max(10485760),
    timeoutMs: z.number().int().min(1000).max(300000)
  }),
  sampling: z.object({
    enabled: z.boolean(),
    percentage: z.number().min(0).max(100).optional(),
    maxSamples: z.number().int().min(0).max(100000).optional()
  })
});
```

#### WebSocket Message Validation
- **Size Limits**: Configurable maximum message size
- **Rate Limiting**: Per-connection message rate limits
- **Content Filtering**: Optional content scanning for malicious payloads

### Security Best Practices

#### Environment Security
- **Secrets Management**: Use environment variables, never commit secrets
- **Principle of Least Privilege**: Minimal database permissions
- **Regular Updates**: Keep dependencies updated
- **Security Scanning**: Regular vulnerability assessments

#### Audit Trail
- **Comprehensive Logging**: All admin actions logged
- **Immutable Logs**: Append-only audit log design
- **Retention Policies**: Configurable log retention
- **Export Capabilities**: Audit log export for compliance

### Security Headers
```typescript
// Express security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});
```

## ⚡ Performance Tuning

### WebSocket Optimization

#### Connection Management
```typescript
// Optimized WebSocket server configuration
const wsServer = new WebSocketServer({
  port: 8080,
  perMessageDeflate: {
    zlibDeflateOptions: {
      level: 3, // Balanced compression
      windowBits: 15,
      memLevel: 8
    },
    threshold: 1024, // Only compress messages > 1KB
    concurrencyLimit: 10,
    clientMaxWindowBits: 15,
    serverMaxWindowBits: 15
  },
  maxPayload: 10 * 1024 * 1024, // 10MB max message size
  backlog: 511, // TCP backlog
  verifyClient: verifyClientFunction
});
```

#### Backpressure Handling
```typescript
// Example backpressure management
class ProxyConnection {
  private sendQueue: Buffer[] = [];
  private draining = false;
  
  async send(data: Buffer): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Connection not open');
    }
    
    if (this.ws.bufferedAmount > this.maxBufferedAmount) {
      // Wait for drain or timeout
      await this.waitForDrain();
    }
    
    this.ws.send(data);
  }
  
  private async waitForDrain(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Drain timeout')), timeout);
      
      const checkDrain = () => {
        if (this.ws.bufferedAmount === 0) {
          clearTimeout(timer);
          resolve();
        } else {
          setTimeout(checkDrain, 10);
        }
      };
      
      checkDrain();
    });
  }
}
```

### Database Optimization

#### Connection Pooling
```typescript
// Prisma connection pool configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // Connection pool settings
  __internal: {
    engine: {
      connection_limit: 20,
      pool_timeout: 10,
      schema_path: './prisma/schema.prisma'
    }
  }
});
```

#### Query Optimization
```sql
-- Useful database indexes
CREATE INDEX CONCURRENTLY idx_live_session_endpoint_id ON live_session(endpoint_id);
CREATE INDEX CONCURRENTLY idx_live_session_state ON live_session(state);
CREATE INDEX CONCURRENTLY idx_traffic_sample_session_id ON traffic_sample(session_id);
CREATE INDEX CONCURRENTLY idx_traffic_sample_timestamp ON traffic_sample(timestamp);
CREATE INDEX CONCURRENTLY idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX CONCURRENTLY idx_audit_log_entity ON audit_log(entity_type, entity_id);
```

### Memory Management

#### Session Cleanup
```typescript
// Automated session cleanup
class SessionManager {
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, 60000); // Cleanup every minute
  }
  
  private async cleanupStaleSessions(): Promise<void> {
    const staleTimeout = 5 * 60 * 1000; // 5 minutes
    const cutoff = new Date(Date.now() - staleTimeout);
    
    const staleSessions = await this.db.liveSession.findMany({
      where: {
        lastSeen: { lt: cutoff },
        state: 'ACTIVE'
      }
    });
    
    for (const session of staleSessions) {
      await this.closeSession(session.id, 'timeout');
    }
  }
}
```

#### Memory Monitoring
```typescript
// Memory usage monitoring
const checkMemoryUsage = () => {
  const usage = process.memoryUsage();
  const threshold = 500 * 1024 * 1024; // 500MB
  
  if (usage.heapUsed > threshold) {
    logger.warn('High memory usage detected', {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      threshold
    });
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
};

setInterval(checkMemoryUsage, 30000); // Check every 30 seconds
```

### Load Testing

#### Artillery Configuration
```yaml
# artillery-config.yml
config:
  target: 'ws://localhost:8080'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Steady load"
    - duration: 120
      arrivalRate: 100
      name: "Peak load"

scenarios:
  - name: "WebSocket proxy test"
    weight: 100
    engine: ws
    flow:
      - connect:
          url: "/ws/test-endpoint"
      - think: 1
      - send: "Hello from client"
      - think: 2
      - send: "Another message"
      - think: 5
```

## 🔧 Troubleshooting

### Common Issues

#### 1. WebSocket Connection Failures

**Problem**: Clients cannot connect to WebSocket proxy
```bash
# Check if service is running
curl http://localhost:8080/healthz

# Check WebSocket endpoint
wscat -c ws://localhost:8080/ws/your-endpoint-id
```

**Solutions**:
- Verify endpoint exists and is enabled
- Check target server connectivity
- Validate endpoint configuration
- Review firewall/proxy settings

#### 2. Database Connection Issues

**Problem**: Database connection errors
```bash
# Test database connectivity
docker exec -it postgres-container psql -U dev -d websocket_proxy -c "SELECT 1;"
```

**Solutions**:
- Verify DATABASE_URL format
- Check PostgreSQL server status
- Validate credentials and permissions
- Review connection pool settings

#### 3. Authentication Problems

**Problem**: JWT token validation failures
```bash
# Decode JWT token (debugging only)
echo "your-jwt-token" | cut -d. -f2 | base64 -d | jq
```

**Solutions**:
- Verify JWT_SECRET matches between services
- Check token expiration
- Validate token format and signature
- Review CORS configuration

#### 4. High Memory Usage

**Problem**: Memory consumption growing over time
```bash
# Monitor memory usage
docker stats container-name

# Check for memory leaks
curl http://localhost:8080/healthz?detailed=true
```

**Solutions**:
- Enable session cleanup
- Adjust connection limits
- Review traffic sampling settings
- Monitor for connection leaks

#### 5. Performance Issues

**Problem**: High latency or connection timeouts
```bash
# Check connection metrics
curl http://localhost:8080/api/sessions | jq '.[] | {id, msgsIn, msgsOut, lastSeen}'
```

**Solutions**:
- Optimize database queries
- Adjust timeout settings
- Review target server performance
- Scale horizontally if needed

### Debug Mode

#### Enable Debug Logging
```bash
# Set debug log level
LOG_LEVEL=debug pnpm dev

# Or in production
LOG_LEVEL=debug docker-compose up -d ws-proxy
```

#### WebSocket Debug Tools
```bash
# Install wscat for testing
npm install -g wscat

# Test WebSocket connection
wscat -c ws://localhost:8080/ws/endpoint-id

# Test with headers
wscat -c ws://localhost:8080/ws/endpoint-id -H "Authorization: Bearer token"
```

#### Database Debug Queries
```sql
-- Check active sessions
SELECT e.name, ls.* FROM live_session ls 
JOIN endpoint e ON ls.endpoint_id = e.id 
WHERE ls.state = 'ACTIVE';

-- Check recent audit logs
SELECT * FROM audit_log 
ORDER BY timestamp DESC 
LIMIT 20;

-- Check endpoint statistics
SELECT 
  e.name,
  COUNT(ls.id) as active_sessions,
  SUM(ls.msgs_in) as total_msgs_in,
  SUM(ls.msgs_out) as total_msgs_out
FROM endpoint e
LEFT JOIN live_session ls ON e.id = ls.endpoint_id AND ls.state = 'ACTIVE'
GROUP BY e.id, e.name;
```

### Log Analysis

#### Common Log Patterns
```bash
# Find connection errors
grep "connection.*error" logs/ws-proxy.log

# Find authentication failures
grep "auth.*failed" logs/ws-proxy.log

# Find high latency requests
grep "duration.*[0-9]{4,}" logs/ws-proxy.log

# Find memory warnings
grep "memory.*high" logs/ws-proxy.log
```

#### Performance Analysis
```bash
# Analyze response times
cat logs/ws-proxy.log | jq -r 'select(.msg == "Request completed") | .duration' | sort -n

# Count requests by endpoint
cat logs/ws-proxy.log | jq -r 'select(.endpointId) | .endpointId' | sort | uniq -c
```

## 🤝 Contributing

We welcome contributions to improve the WebSocket proxy system! Please follow these guidelines:

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/simple-websocket-proxy.git
   cd simple-websocket-proxy
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Start Development Environment**
   ```bash
   pnpm dev
   ```

### Code Standards

#### TypeScript Guidelines
- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Use meaningful variable and function names
- Document complex logic with comments

#### Testing Requirements
- Write unit tests for new functions
- Add integration tests for API endpoints
- Include E2E tests for UI features
- Maintain minimum 85% test coverage

#### Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

Examples:
```
feat(proxy): add WebSocket compression support
fix(ui): resolve session list pagination issue
docs(readme): update deployment instructions
test(api): add endpoint validation tests
```

### Pull Request Process

1. **Before Submitting**
   ```bash
   # Run full test suite
   pnpm test
   
   # Check types
   pnpm typecheck
   
   # Lint code
   pnpm lint
   
   # Build packages
   pnpm build
   ```

2. **PR Description Template**
   ```markdown
   ## Description
   Brief description of changes
   
   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update
   
   ## Testing
   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] E2E tests pass
   - [ ] Manual testing completed
   
   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] No breaking changes (or properly documented)
   ```

3. **Review Process**
   - Automated CI checks must pass
   - At least one maintainer review required
   - All feedback addressed
   - Squash commits before merge

### Issue Reporting

#### Bug Reports
Use the bug report template:
```markdown
**Describe the bug**
A clear description of the bug

**To Reproduce**
Steps to reproduce the behavior

**Expected behavior**
What you expected to happen

**Environment**
- OS: [e.g., Ubuntu 20.04]
- Node.js: [e.g., 18.17.0]
- Package version: [e.g., 1.0.0]

**Additional context**
Any other context about the problem
```

#### Feature Requests
Use the feature request template:
```markdown
**Is your feature request related to a problem?**
Description of the problem

**Describe the solution you'd like**
Clear description of desired solution

**Describe alternatives you've considered**
Alternative solutions considered

**Additional context**
Any other context or screenshots
```

### Documentation

#### Code Documentation
- Use JSDoc for function documentation
- Include parameter and return type descriptions
- Document complex algorithms and business logic

#### API Documentation
- Update OpenAPI specifications for API changes
- Include request/response examples
- Document error scenarios

### Release Process

#### Version Numbering
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

#### Release Checklist
1. Update version numbers in package.json files
2. Update CHANGELOG.md
3. Create release notes
4. Tag release in git
5. Build and publish Docker images
6. Deploy to staging environment
7. Run full test suite
8. Deploy to production

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **WebSocket Libraries**: Built on the excellent `ws` library
- **UI Components**: Powered by [shadcn/ui](https://ui.shadcn.com/) and [Radix UI](https://www.radix-ui.com/)
- **Database**: [Prisma ORM](https://www.prisma.io/) for type-safe database access
- **Testing**: [Vitest](https://vitest.dev/) and [Playwright](https://playwright.dev/) for comprehensive testing
- **Logging**: [Pino](https://getpino.io/) for high-performance structured logging

## 📞 Support

- **Documentation**: [GitHub Wiki](https://github.com/your-org/simple-websocket-proxy/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-org/simple-websocket-proxy/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/simple-websocket-proxy/discussions)
- **Security**: Report security issues to security@your-org.com

---

**Built with ❤️ for the WebSocket community**

*For more information, visit our [documentation site](https://your-org.github.io/simple-websocket-proxy/) or check out the [getting started guide](https://github.com/your-org/simple-websocket-proxy/wiki/Getting-Started).*