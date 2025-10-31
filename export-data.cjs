const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

// Initialize Prisma client for SQLite
const prisma = new PrismaClient();

async function exportData() {
  try {
    console.log('Exporting data from SQLite database...');
    
    // Export all tables
    const users = await prisma.user.findMany();
    const permissions = await prisma.permission.findMany();
    const roles = await prisma.role.findMany();
    const userRoles = await prisma.userRole.findMany();
    const rolePermissions = await prisma.rolePermission.findMany();
    const jobPostings = await prisma.jobPosting.findMany();
    const candidates = await prisma.candidate.findMany();
    const loginActivity = await prisma.loginActivity.findMany();
    const documentCategories = await prisma.documentCategory.findMany();
    const auditLogs = await prisma.auditLog.findMany();
    const events = await prisma.event.findMany();
    const leaveRequests = await prisma.leaveRequest.findMany();
    
    const exportedData = {
      users,
      permissions,
      roles,
      userRoles,
      rolePermissions,
      jobPostings,
      candidates,
      loginActivity,
      documentCategories,
      auditLogs,
      events,
      leaveRequests
    };
    
    // Write to JSON file
    fs.writeFileSync('./exported-data.json', JSON.stringify(exportedData, null, 2));
    
    console.log('Data exported successfully!');
    console.log(`Users: ${users.length}`);
    console.log(`Permissions: ${permissions.length}`);
    console.log(`Roles: ${roles.length}`);
    console.log(`Job Postings: ${jobPostings.length}`);
    console.log(`Candidates: ${candidates.length}`);
    console.log(`Login Activities: ${loginActivity.length}`);
    console.log(`Audit Logs: ${auditLogs.length}`);
    console.log(`Events: ${events.length}`);
    console.log(`Leave Requests: ${leaveRequests.length}`);
    
  } catch (error) {
    console.error('Error exporting data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportData();