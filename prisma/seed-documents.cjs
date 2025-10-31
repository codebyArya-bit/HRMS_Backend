const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedDocuments() {
  try {
    // Create document categories
    const categories = await Promise.all([
      prisma.documentCategory.create({
        data: {
          name: 'Policies',
          description: 'Company policies and procedures',
          icon: '🛡️',
          color: 'blue'
        }
      }),
      prisma.documentCategory.create({
        data: {
          name: 'Training',
          description: 'Training materials and guides',
          icon: '📚',
          color: 'green'
        }
      }),
      prisma.documentCategory.create({
        data: {
          name: 'Forms',
          description: 'Employee forms and templates',
          icon: '📄',
          color: 'yellow'
        }
      }),
      prisma.documentCategory.create({
        data: {
          name: 'Benefits',
          description: 'Benefits and compensation information',
          icon: '💼',
          color: 'purple'
        }
      }),
      prisma.documentCategory.create({
        data: {
          name: 'Safety',
          description: 'Safety protocols and guidelines',
          icon: '⚠️',
          color: 'red'
        }
      })
    ]);

    // Get the first user (assuming there's at least one user)
    const firstUser = await prisma.user.findFirst();
    if (!firstUser) {
      console.log('No users found. Please create a user first.');
      return;
    }

    // Create sample documents
    const documents = await Promise.all([
      prisma.document.create({
        data: {
          title: 'Employee Handbook 2024',
          description: 'Complete guide to company policies, procedures, and benefits',
          fileName: 'employee-handbook-2024.pdf',
          filePath: '/documents/policies/employee-handbook-2024.pdf',
          fileSize: 2516582, // 2.4 MB in bytes
          mimeType: 'application/pdf',
          format: 'PDF',
          isRequired: true,
          downloadCount: 1250,
          tags: JSON.stringify(['policies', 'onboarding', 'benefits']),
          categoryId: categories[0].id, // Policies
          uploadedById: firstUser.id
        }
      }),
      prisma.document.create({
        data: {
          title: 'Code of Conduct',
          description: 'Professional standards and ethical guidelines',
          fileName: 'code-of-conduct.pdf',
          filePath: '/documents/policies/code-of-conduct.pdf',
          fileSize: 870400, // 850 KB in bytes
          mimeType: 'application/pdf',
          format: 'PDF',
          isRequired: true,
          downloadCount: 980,
          tags: JSON.stringify(['ethics', 'conduct', 'compliance']),
          categoryId: categories[0].id, // Policies
          uploadedById: firstUser.id
        }
      }),
      prisma.document.create({
        data: {
          title: 'IT Security Guidelines',
          description: 'Cybersecurity best practices and protocols',
          fileName: 'it-security-guidelines.pdf',
          filePath: '/documents/training/it-security-guidelines.pdf',
          fileSize: 1258291, // 1.2 MB in bytes
          mimeType: 'application/pdf',
          format: 'PDF',
          isRequired: true,
          downloadCount: 756,
          tags: JSON.stringify(['security', 'IT', 'compliance']),
          categoryId: categories[1].id, // Training
          uploadedById: firstUser.id
        }
      }),
      prisma.document.create({
        data: {
          title: 'Performance Review Template',
          description: 'Annual performance evaluation form and guidelines',
          fileName: 'performance-review-template.docx',
          filePath: '/documents/forms/performance-review-template.docx',
          fileSize: 460800, // 450 KB in bytes
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          format: 'DOCX',
          isRequired: false,
          downloadCount: 432,
          tags: JSON.stringify(['performance', 'review', 'template']),
          categoryId: categories[2].id, // Forms
          uploadedById: firstUser.id
        }
      }),
      prisma.document.create({
        data: {
          title: 'Remote Work Policy',
          description: 'Guidelines for working from home and hybrid arrangements',
          fileName: 'remote-work-policy.pdf',
          filePath: '/documents/policies/remote-work-policy.pdf',
          fileSize: 696320, // 680 KB in bytes
          mimeType: 'application/pdf',
          format: 'PDF',
          isRequired: false,
          downloadCount: 892,
          tags: JSON.stringify(['remote', 'policy', 'flexibility']),
          categoryId: categories[0].id, // Policies
          uploadedById: firstUser.id
        }
      }),
      prisma.document.create({
        data: {
          title: 'Emergency Procedures',
          description: 'Safety protocols and emergency response procedures',
          fileName: 'emergency-procedures.pdf',
          filePath: '/documents/safety/emergency-procedures.pdf',
          fileSize: 1048576, // 1 MB in bytes
          mimeType: 'application/pdf',
          format: 'PDF',
          isRequired: true,
          downloadCount: 1100,
          tags: JSON.stringify(['safety', 'emergency', 'procedures']),
          categoryId: categories[4].id, // Safety
          uploadedById: firstUser.id
        }
      }),
      prisma.document.create({
        data: {
          title: 'Benefits Enrollment Guide',
          description: 'Step-by-step guide for enrolling in company benefits',
          fileName: 'benefits-enrollment-guide.pdf',
          filePath: '/documents/benefits/benefits-enrollment-guide.pdf',
          fileSize: 1887437, // 1.8 MB in bytes
          mimeType: 'application/pdf',
          format: 'PDF',
          isRequired: false,
          downloadCount: 1100,
          tags: JSON.stringify(['benefits', 'insurance', 'enrollment']),
          categoryId: categories[3].id, // Benefits
          uploadedById: firstUser.id
        }
      }),
      prisma.document.create({
        data: {
          title: 'Professional Development Plan',
          description: 'Career growth opportunities and training programs',
          fileName: 'professional-development-plan.pdf',
          filePath: '/documents/training/professional-development-plan.pdf',
          fileSize: 942080, // 920 KB in bytes
          mimeType: 'application/pdf',
          format: 'PDF',
          isRequired: false,
          downloadCount: 634,
          tags: JSON.stringify(['development', 'career', 'training']),
          categoryId: categories[1].id, // Training
          uploadedById: firstUser.id
        }
      })
    ]);

    console.log('Document seeding completed successfully!');
    console.log(`Created ${categories.length} document categories`);
    console.log(`Created ${documents.length} documents`);

  } catch (error) {
    console.error('Error seeding documents:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function if this file is executed directly
if (require.main === module) {
  seedDocuments();
}

module.exports = { seedDocuments };