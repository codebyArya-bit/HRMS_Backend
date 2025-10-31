import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const userCount = await prisma.user.count();
    console.log('Total users in database:', userCount);
    
    if (userCount > 0) {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          department: true,
          role: {
            select: {
              name: true
            }
          }
        },
        take: 5
      });
      
      console.log('First 5 users:');
      users.forEach(user => {
        console.log(`- ${user.name} (${user.email}) - ${user.role?.name || 'No role'}`);
      });
    }
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();