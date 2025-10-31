import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testAuditLogs() {
  try {
    console.log('Testing audit logs database connection...');
    
    // Check if we can count audit logs
    const count = await prisma.auditLog.count();
    console.log('✅ Audit logs count:', count);
    
    // Try to fetch a few audit logs
    const logs = await prisma.auditLog.findMany({
      take: 5,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });
    
    console.log('✅ Sample audit logs:', logs.length > 0 ? logs : 'No audit logs found');
    
    // Test creating a sample audit log
    const testLog = await prisma.auditLog.create({
      data: {
        action: 'TEST_ACTION',
        category: 'SYSTEM',
        resource: 'test_resource',
        severity: 'INFO',
        status: 'SUCCESS',
        description: 'Test audit log entry',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent'
      }
    });
    
    console.log('✅ Created test audit log:', testLog.id);
    
  } catch (error) {
    console.error('❌ Error testing audit logs:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuditLogs();