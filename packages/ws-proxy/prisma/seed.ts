import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

  const existingAdmin = await prisma.appUser.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    
    await prisma.appUser.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
      },
    });

    console.log(`Created admin user: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  await prisma.endpoint.createMany({
    data: [
      {
        name: 'Echo Server',
        targetUrl: 'wss://echo.websocket.org',
        limits: {
          maxConnections: 100,
          maxMessageSize: 1048576,
          timeoutMs: 30000,
        },
        sampling: {
          enabled: false,
          percentage: 10,
        },
        enabled: true,
      },
      {
        name: 'Test Endpoint',
        targetUrl: 'wss://ws.postman-echo.com/raw',
        limits: {
          maxConnections: 50,
          maxMessageSize: 524288,
          timeoutMs: 15000,
        },
        sampling: {
          enabled: true,
          percentage: 5,
        },
        enabled: false,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Seeded sample endpoints');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });