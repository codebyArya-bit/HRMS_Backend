import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Define all permissions your system will have
const allPermissions = [
  { id: 'manage_users', name: 'User Management', category: 'Users', description: 'Create, edit, delete users' },
  { id: 'manage_roles', name: 'Role Management', category: 'System', description: 'Manage roles and permissions' },
  { id: 'manage_jobs', name: 'Job Management', category: 'Jobs', description: 'Create, edit, archive jobs' },
  { id: 'view_reports', name: 'View Reports', category: 'Analytics', description: 'View all reports' },
  { id: 'manage_policies', name: 'Policy Management', category: 'Compliance', description: 'Manage company policies' },
  { id: 'view_audit_logs', name: 'View Audit Logs', category: 'Security', description: 'View system audit logs' },
  { id: 'manage_audit_logs', name: 'Manage Audit Logs', category: 'Security', description: 'Create and manage audit logs' },
  { id: 'view_profile', name: 'View Personal Profile', category: 'Personal', description: 'Access personal profile' },
  { id: 'manage_team', name: 'Manage Team', category: 'Teams', description: 'Manage one\'s own team' },
];

// Department data
const departments = [
  'Human Resources',
  'Engineering',
  'Marketing',
  'Sales',
  'Finance',
  'Operations',
  'Customer Support',
  'Product Management',
  'Quality Assurance',
  'Management'
];

// Sample employee data
const sampleEmployees = [
  // Admin users
  { email: 'a@a.com', employeeId: 'ADMIN001', name: 'Admin User', department: 'Management', role: 'ADMIN', avatar: 'https://i.pravatar.cc/150?u=ADMIN001' },
  
  // HR users
  { email: 'h@h.com', employeeId: 'HR001', name: 'Sarah Johnson', department: 'Human Resources', role: 'HR', avatar: 'https://i.pravatar.cc/150?u=HR001' },
  { email: 'hr.manager@company.com', employeeId: 'HR002', name: 'Michael Chen', department: 'Human Resources', role: 'HR', avatar: 'https://i.pravatar.cc/150?u=HR002' },
  
  // Managers
  { email: 'm@m.com', employeeId: 'MGR001', name: 'David Wilson', department: 'Engineering', role: 'MANAGER', avatar: 'https://i.pravatar.cc/150?u=MGR001' },
  { email: 'marketing.manager@company.com', employeeId: 'MGR002', name: 'Emily Rodriguez', department: 'Marketing', role: 'MANAGER', avatar: 'https://i.pravatar.cc/150?u=MGR002' },
  { email: 'sales.manager@company.com', employeeId: 'MGR003', name: 'James Thompson', department: 'Sales', role: 'MANAGER', avatar: 'https://i.pravatar.cc/150?u=MGR003' },
  { email: 'finance.manager@company.com', employeeId: 'MGR004', name: 'Lisa Anderson', department: 'Finance', role: 'MANAGER', avatar: 'https://i.pravatar.cc/150?u=MGR004' },
  
  // Employees
  { email: 'e@e.com', employeeId: 'EMP001', name: 'John Smith', department: 'Engineering', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP001' },
  { email: 'jane.doe@company.com', employeeId: 'EMP002', name: 'Jane Doe', department: 'Engineering', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP002' },
  { email: 'alex.brown@company.com', employeeId: 'EMP003', name: 'Alex Brown', department: 'Engineering', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP003' },
  { email: 'maria.garcia@company.com', employeeId: 'EMP004', name: 'Maria Garcia', department: 'Marketing', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP004' },
  { email: 'robert.lee@company.com', employeeId: 'EMP005', name: 'Robert Lee', department: 'Marketing', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP005' },
  { email: 'jennifer.white@company.com', employeeId: 'EMP006', name: 'Jennifer White', department: 'Sales', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP006' },
  { email: 'kevin.taylor@company.com', employeeId: 'EMP007', name: 'Kevin Taylor', department: 'Sales', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP007' },
  { email: 'amanda.davis@company.com', employeeId: 'EMP008', name: 'Amanda Davis', department: 'Finance', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP008' },
  { email: 'chris.miller@company.com', employeeId: 'EMP009', name: 'Chris Miller', department: 'Operations', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP009' },
  { email: 'nicole.wilson@company.com', employeeId: 'EMP010', name: 'Nicole Wilson', department: 'Customer Support', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP010' },
  { email: 'daniel.moore@company.com', employeeId: 'EMP011', name: 'Daniel Moore', department: 'Product Management', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP011' },
  { email: 'stephanie.clark@company.com', employeeId: 'EMP012', name: 'Stephanie Clark', department: 'Quality Assurance', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP012' },
  { email: 'ryan.martinez@company.com', employeeId: 'EMP013', name: 'Ryan Martinez', department: 'Engineering', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP013' },
  { email: 'laura.anderson@company.com', employeeId: 'EMP014', name: 'Laura Anderson', department: 'Marketing', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP014' },
  { email: 'brandon.thomas@company.com', employeeId: 'EMP015', name: 'Brandon Thomas', department: 'Sales', role: 'EMPLOYEE', avatar: 'https://i.pravatar.cc/150?u=EMP015' },
];

// Job postings data
const jobPostings = [
  {
    title: 'Senior Software Engineer',
    department: 'Engineering',
    status: 'OPEN',
    openings: 2,
    jobDescription: 'We are looking for a Senior Software Engineer to join our growing engineering team. You will be responsible for designing, developing, and maintaining scalable web applications.',
    requirements: 'Bachelor\'s degree in Computer Science, 5+ years of experience with React, Node.js, and databases. Strong problem-solving skills required.'
  },
  {
    title: 'Marketing Specialist',
    department: 'Marketing',
    status: 'OPEN',
    openings: 1,
    jobDescription: 'Join our marketing team to help drive brand awareness and lead generation through digital marketing campaigns.',
    requirements: 'Bachelor\'s degree in Marketing or related field, 2+ years of experience in digital marketing, proficiency in Google Analytics and social media platforms.'
  },
  {
    title: 'Sales Representative',
    department: 'Sales',
    status: 'OPEN',
    openings: 3,
    jobDescription: 'We are seeking motivated Sales Representatives to join our sales team and help drive revenue growth.',
    requirements: 'High school diploma or equivalent, excellent communication skills, previous sales experience preferred but not required.'
  },
  {
    title: 'HR Coordinator',
    department: 'Human Resources',
    status: 'CLOSED',
    openings: 1,
    jobDescription: 'Support HR operations including recruitment, onboarding, and employee relations.',
    requirements: 'Bachelor\'s degree in HR or related field, 1-2 years of HR experience, knowledge of employment law.'
  },
  {
    title: 'Product Manager',
    department: 'Product Management',
    status: 'OPEN',
    openings: 1,
    jobDescription: 'Lead product strategy and development for our core platform features.',
    requirements: 'Bachelor\'s degree, 3+ years of product management experience, strong analytical and communication skills.'
  }
];

async function main() {
  console.log(`Start seeding ...`);

  // 1. Create all Permissions
  console.log('Creating permissions...');
  for (const perm of allPermissions) {
    await prisma.permission.upsert({
      where: { id: perm.id },
      update: {},
      create: perm,
    });
  }
  console.log('Permissions created.');

  // 2. Create Roles and connect permissions
  console.log('Creating roles...');
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Full system access with all permissions',
      color: 'red',
      permissions: {
        connect: allPermissions.map(p => ({ id: p.id })),
      },
    },
  });

  const hrRole = await prisma.role.upsert({
    where: { name: 'HR' },
    update: {},
    create: {
      name: 'HR',
      description: 'Human resources management and employee operations',
      color: 'blue',
      permissions: {
        connect: [
          { id: 'manage_users' },
          { id: 'manage_jobs' },
          { id: 'view_reports' },
          { id: 'manage_policies' },
          { id: 'view_profile' },
        ],
      },
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: {
      name: 'MANAGER',
      description: 'Team and project management within department',
      color: 'green',
      permissions: {
        connect: [
          { id: 'view_reports' },
          { id: 'view_profile' },
          { id: 'manage_team' },
        ],
      },
    },
  });

  const employeeRole = await prisma.role.upsert({
    where: { name: 'EMPLOYEE' },
    update: {},
    create: {
      name: 'EMPLOYEE',
      description: 'Standard employee access to personal features',
      color: 'gray',
      permissions: {
        connect: [
          { id: 'view_profile' },
        ],
      },
    },
  });
  console.log('Roles created.');

  // 3. Create Users and connect them to Roles
  console.log('Creating users...');
  const commonPassword = '12';
  const hashedPassword = await bcrypt.hash(commonPassword, 10);

  const roleMap = {
    'ADMIN': adminRole.id,
    'HR': hrRole.id,
    'MANAGER': managerRole.id,
    'EMPLOYEE': employeeRole.id
  };

  for (const employee of sampleEmployees) {
    await prisma.user.upsert({
      where: { email: employee.email },
      update: {},
      create: {
        email: employee.email,
        employeeId: employee.employeeId,
        name: employee.name,
        password: hashedPassword,
        department: employee.department,
        roleId: roleMap[employee.role],
        joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random date within last year
      },
    });
  }
  console.log('Users created.');

  // 4. Create Job Postings
  console.log('Creating job postings...');
  for (const job of jobPostings) {
    // Find an admin or HR user to be the poster
    const poster = await prisma.user.findFirst({
      where: {
        OR: [
          { role: { name: 'ADMIN' } },
          { role: { name: 'HR' } }
        ]
      }
    });

    await prisma.job.create({
      data: {
        title: job.title,
        department: job.department,
        status: job.status,
        openings: job.openings,
        jobDescription: job.jobDescription,
        requirements: job.requirements,
        postedById: poster.id,
        datePosted: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
      },
    });
  }
  console.log('Job postings created.');

  // 5. Create some sample login activity
  console.log('Creating login activity...');
  const users = await prisma.user.findMany();
  
  for (let i = 0; i < 50; i++) {
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const randomDate = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Random date within last 7 days
    
    await prisma.loginActivity.create({
      data: {
        userId: randomUser.id,
        timestamp: randomDate,
        activity: 'User logged in'
      }
    });
  }
  console.log('Login activity created.');

  // 6. Create Document Categories
  console.log('Creating document categories...');
  const documentCategories = [
    { name: 'HR Policies', description: 'Human Resources policies and procedures', icon: 'FileText', color: 'blue' },
    { name: 'Employee Handbook', description: 'Company employee handbook and guidelines', icon: 'Book', color: 'green' },
    { name: 'Forms', description: 'Various company forms and templates', icon: 'FileCheck', color: 'yellow' },
    { name: 'Training Materials', description: 'Training documents and resources', icon: 'GraduationCap', color: 'purple' },
    { name: 'Compliance', description: 'Compliance and regulatory documents', icon: 'Shield', color: 'red' }
  ];

  for (const category of documentCategories) {
    await prisma.documentCategory.upsert({
      where: { name: category.name },
      update: {},
      create: category
    });
  }
  console.log('Document categories created.');

  // 7. Create some sample audit logs
  console.log('Creating audit logs...');
  const auditActions = [
    { action: 'User Login', category: 'Authentication', severity: 'info' },
    { action: 'User Created', category: 'User Management', severity: 'info' },
    { action: 'Job Posted', category: 'Job Management', severity: 'info' },
    { action: 'Document Uploaded', category: 'Document Management', severity: 'info' },
    { action: 'Role Updated', category: 'Role Management', severity: 'warning' }
  ];

  for (let i = 0; i < 20; i++) {
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const randomAction = auditActions[Math.floor(Math.random() * auditActions.length)];
    const randomDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    
    await prisma.auditLog.create({
      data: {
        userId: randomUser.id,
        action: randomAction.action,
        category: randomAction.category,
        severity: randomAction.severity,
        timestamp: randomDate,
        description: `${randomAction.action} performed by ${randomUser.name}`,
        status: 'success'
      }
    });
  }
  console.log('Audit logs created.');

  // 8. Create sample events
  console.log('Creating events...');
  const sampleEvents = [
    {
      title: 'Annual Company Retreat',
      description: 'Join us for our annual company retreat featuring team building activities, strategic planning sessions, and networking opportunities.',
      startDate: new Date('2024-12-15T09:00:00Z'),
      endDate: new Date('2024-12-17T17:00:00Z'),
      location: 'Mountain View Resort',
      maxCapacity: 100,
      status: 'OPEN',
      organizer: 'Human Resources',
      image: 'https://picsum.photos/400/200?random=1'
    },
    {
      title: 'Tech Innovation Summit',
      description: 'Explore the latest trends in technology and innovation. Featuring keynote speakers from leading tech companies.',
      startDate: new Date('2024-11-20T10:00:00Z'),
      endDate: new Date('2024-11-20T18:00:00Z'),
      location: 'Tech Conference Center',
      maxCapacity: 200,
      status: 'OPEN',
      organizer: 'Engineering Department',
      image: 'https://picsum.photos/400/200?random=2'
    },
    {
      title: 'Wellness Workshop',
      description: 'Learn about mental health, work-life balance, and wellness strategies to improve your overall well-being.',
      startDate: new Date('2024-11-10T14:00:00Z'),
      endDate: new Date('2024-11-10T16:00:00Z'),
      location: 'Wellness Center',
      maxCapacity: 50,
      status: 'OPEN',
      organizer: 'Human Resources',
      image: 'https://picsum.photos/400/200?random=3'
    },
    {
      title: 'Leadership Development Program',
      description: 'Enhance your leadership skills with this comprehensive program designed for managers and aspiring leaders.',
      startDate: new Date('2024-12-01T09:00:00Z'),
      endDate: new Date('2024-12-03T17:00:00Z'),
      location: 'Leadership Institute',
      maxCapacity: 30,
      status: 'OPEN',
      organizer: 'Management',
      image: 'https://picsum.photos/400/200?random=4'
    },
    {
      title: 'Holiday Party',
      description: 'Celebrate the holiday season with your colleagues. Food, drinks, and entertainment provided.',
      startDate: new Date('2024-12-20T18:00:00Z'),
      endDate: new Date('2024-12-20T23:00:00Z'),
      location: 'Grand Ballroom',
      maxCapacity: 150,
      status: 'OPEN',
      organizer: 'Human Resources',
      image: 'https://picsum.photos/400/200?random=5'
    }
  ];

  for (const eventData of sampleEvents) {
    await prisma.event.create({
      data: eventData
    });
  }
  console.log('Events created.');

  // Create sample candidates
  console.log('Creating candidates...');
  const jobs = await prisma.job.findMany();
  
  const sampleCandidates = [
    {
      name: 'Alice Johnson',
      email: 'alice.johnson@email.com',
      phone: '+1-555-0101',
      status: 'NEW',
      dateApplied: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
    {
      name: 'Bob Smith',
      email: 'bob.smith@email.com',
      phone: '+1-555-0102',
      status: 'INTERVIEW',
      dateApplied: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
    {
      name: 'Carol Davis',
      email: 'carol.davis@email.com',
      phone: '+1-555-0103',
      status: 'HIRED',
      dateApplied: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      dateHired: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    },
    {
      name: 'David Wilson',
      email: 'david.wilson@email.com',
      phone: '+1-555-0104',
      status: 'NEW',
      dateApplied: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    },
    {
      name: 'Eva Brown',
      email: 'eva.brown@email.com',
      phone: '+1-555-0105',
      status: 'INTERVIEW',
      dateApplied: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    },
    {
      name: 'Frank Miller',
      email: 'frank.miller@email.com',
      phone: '+1-555-0106',
      status: 'HIRED',
      dateApplied: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      dateHired: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
    },
    {
      name: 'Grace Taylor',
      email: 'grace.taylor@email.com',
      phone: '+1-555-0107',
      status: 'NEW',
      dateApplied: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    },
    {
      name: 'Henry Anderson',
      email: 'henry.anderson@email.com',
      phone: '+1-555-0108',
      status: 'REJECTED',
      dateApplied: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
    }
  ];

  for (const candidate of sampleCandidates) {
    // Assign to a random job
    const randomJob = jobs[Math.floor(Math.random() * jobs.length)];
    
    await prisma.candidate.create({
      data: {
        ...candidate,
        appliedForJobId: randomJob.id,
      },
    });
  }
  console.log('Candidates created.');

  // Create sample leave requests
  const sampleLeaveRequests = [
    {
      employeeIdRef: 'EMP001',
      startDate: new Date('2024-11-15'),
      endDate: new Date('2024-11-17'),
      reason: 'Family vacation',
      leaveType: 'ANNUAL',
      status: 'PENDING',
      appliedAt: new Date('2024-11-01T10:00:00Z')
    },
    {
      employeeIdRef: 'EMP002',
      startDate: new Date('2024-11-20'),
      endDate: new Date('2024-11-22'),
      reason: 'Medical appointment',
      leaveType: 'SICK',
      status: 'APPROVED',
      appliedAt: new Date('2024-11-02T14:30:00Z'),
      reviewedAt: new Date('2024-11-03T09:15:00Z'),
      managerComments: 'Approved for medical reasons'
    },
    {
      employeeIdRef: 'EMP003',
      startDate: new Date('2024-12-23'),
      endDate: new Date('2024-12-30'),
      reason: 'Christmas holidays',
      leaveType: 'ANNUAL',
      status: 'APPROVED',
      appliedAt: new Date('2024-10-15T16:00:00Z'),
      reviewedAt: new Date('2024-10-16T10:30:00Z'),
      managerComments: 'Approved for holiday season'
    },
    {
      employeeIdRef: 'EMP004',
      startDate: new Date('2024-11-10'),
      endDate: new Date('2024-11-12'),
      reason: 'Personal matters',
      leaveType: 'PERSONAL',
      status: 'REJECTED',
      appliedAt: new Date('2024-11-05T11:20:00Z'),
      reviewedAt: new Date('2024-11-06T13:45:00Z'),
      managerComments: 'Insufficient notice period'
    },
    {
      employeeIdRef: 'EMP005',
      startDate: new Date('2024-11-25'),
      endDate: new Date('2024-11-29'),
      reason: 'Emergency leave',
      leaveType: 'EMERGENCY',
      status: 'PENDING',
      appliedAt: new Date('2024-11-08T08:30:00Z')
    }
  ];

  for (const leaveData of sampleLeaveRequests) {
    // Find the user by employeeId
    const user = await prisma.user.findUnique({
      where: { employeeId: leaveData.employeeIdRef }
    });
    
    if (user) {
      const { employeeIdRef, ...leaveRequestData } = leaveData;
      await prisma.leaveRequest.create({
        data: {
          ...leaveRequestData,
          employeeId: user.id // Use the actual user ID from the database
        }
      });
    }
  }
  console.log('Leave requests created.');

  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
