import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkPermissions() {
  try {
    console.log('Checking admin user permissions...');
    
    // Find admin user
    const adminUser = await prisma.User.findFirst({
      where: {
        role: {
          name: 'ADMIN'
        }
      },
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      }
    });
    
    if (!adminUser) {
      console.log('❌ No admin user found');
      return;
    }
    
    console.log('✅ Admin user found:', {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role.name
    });
    
    console.log('📋 Admin permissions:');
    adminUser.role.permissions.forEach(perm => {
      console.log(`  - ${perm.id}: ${perm.name} (${perm.description})`);
    });
    
    // Check if view_audit_logs permission exists
    const viewAuditLogsPermission = adminUser.role.permissions.find(p => p.id === 'view_audit_logs');
    
    if (viewAuditLogsPermission) {
      console.log('✅ Admin has view_audit_logs permission');
    } else {
      console.log('❌ Admin does NOT have view_audit_logs permission');
      
      // Check if the permission exists in the system
      const permission = await prisma.Permission.findUnique({
        where: { id: 'view_audit_logs' }
      });
      
      if (permission) {
        console.log('📝 view_audit_logs permission exists in system:', permission);
        console.log('🔧 Need to assign this permission to admin role');
      } else {
        console.log('❌ view_audit_logs permission does not exist in system');
        console.log('🔧 Need to create this permission first');
      }
    }
    
    // List all available permissions
    console.log('\n📋 All available permissions in system:');
    const allPermissions = await prisma.Permission.findMany({
      orderBy: { id: 'asc' }
    });
    
    allPermissions.forEach(perm => {
      console.log(`  - ${perm.id}: ${perm.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking permissions:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPermissions();