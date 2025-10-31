import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEmployees() {
  try {
    console.log('Checking users with EMPLOYEE role...\n');
    
    const employees = await prisma.user.findMany({
      where: {
        role: {
          name: 'EMPLOYEE'
        }
      },
      include: {
        role: true
      }
    });

    console.log(`Found ${employees.length} employees:`);
    employees.forEach((emp, index) => {
      console.log(`${index + 1}. ${emp.name} (${emp.email}) - ${emp.role.name}`);
      console.log(`   Employee ID: ${emp.employeeId || 'Not set'}`);
      console.log(`   Department: ${emp.department || 'Not set'}`);
      console.log(`   Phone: ${emp.phone || 'Not set'}`);
      console.log('');
    });

    // Also check all roles in the system
    console.log('\nAll roles in the system:');
    const roles = await prisma.role.findMany();
    roles.forEach(role => {
      console.log(`- ${role.name}: ${role.description}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEmployees();