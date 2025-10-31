import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testLoginActivity() {
  try {
    console.log('Testing LoginActivity queries...');
    
    // Check if there's any login activity data
    const count = await prisma.LoginActivity.count();
    console.log(`Total LoginActivity records: ${count}`);
    
    if (count > 0) {
      // Test the exact query from the weekly endpoint
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const activities = await prisma.LoginActivity.findMany({
        where: {
          timestamp: {
            gte: weekAgo,
            lte: now
          }
        },
        select: {
          timestamp: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
      
      console.log(`Activities in last 7 days: ${activities.length}`);
      console.log('Sample activity:', activities[0]);
    } else {
      console.log('No LoginActivity records found. Creating some sample data...');
      
      // Create some sample login activities
      const user = await prisma.User.findFirst();
      if (user) {
        await prisma.LoginActivity.create({
          data: {
            userId: user.id,
            timestamp: new Date(),
            activity: 'User logged in'
          }
        });
        console.log('Created sample login activity');
      }
    }
    
  } catch (error) {
    console.error('Error testing LoginActivity:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLoginActivity();