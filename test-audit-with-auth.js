import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function testAuditLogsWithAuth() {
    try {
        console.log('🔍 Testing Audit Logs API with Authentication...\n');
        
        // Step 1: Get admin user and create a valid token
        console.log('1️⃣ Getting admin user...');
        const adminUser = await prisma.User.findFirst({
            where: { email: 'a@a.com' },
            include: { role: true }
        });
        
        if (!adminUser) {
            console.log('❌ Admin user not found');
            return;
        }
        
        console.log(`✅ Found admin user: ${adminUser.name} (${adminUser.email})`);
        console.log(`   Role: ${adminUser.role.name}`);
        
        // Step 2: Create a valid JWT token
        console.log('\n2️⃣ Creating JWT token...');
        const token = jwt.sign(
            { 
                id: adminUser.id, 
                email: adminUser.email,
                role: adminUser.role.name 
            },
            process.env.JWT_SECRET || 'supersecretjwtkey',
            { expiresIn: '1h' }
        );
        console.log('✅ JWT token created');
        
        // Step 3: Test different API endpoints and parameters
        const testCases = [
            {
                name: 'Basic audit logs fetch',
                url: 'http://localhost:3001/api/audit-logs',
                params: {}
            },
            {
                name: 'Audit logs with pagination',
                url: 'http://localhost:3001/api/audit-logs?page=1&limit=5',
                params: { page: 1, limit: 5 }
            },
            {
                name: 'Audit logs with category filter',
                url: 'http://localhost:3001/api/audit-logs?category=AUTHENTICATION',
                params: { category: 'AUTHENTICATION' }
            },
            {
                name: 'Audit logs with severity filter',
                url: 'http://localhost:3001/api/audit-logs?severity=INFO',
                params: { severity: 'INFO' }
            },
            {
                name: 'Audit logs statistics',
                url: 'http://localhost:3001/api/audit-logs/stats',
                params: {}
            }
        ];
        
        for (const testCase of testCases) {
            console.log(`\n3️⃣ Testing: ${testCase.name}`);
            console.log(`   URL: ${testCase.url}`);
            
            try {
                const response = await fetch(testCase.url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                console.log(`   Status: ${response.status} ${response.statusText}`);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`   ✅ Success! Response keys: ${Object.keys(data).join(', ')}`);
                    
                    if (data.auditLogs) {
                        console.log(`   📊 Found ${data.auditLogs.length} audit logs`);
                    }
                    if (data.pagination) {
                        console.log(`   📄 Pagination: page ${data.pagination.page}, total ${data.pagination.total}`);
                    }
                    if (data.totalLogs !== undefined) {
                        console.log(`   📈 Stats: ${data.totalLogs} total logs`);
                    }
                } else {
                    const errorText = await response.text();
                    console.log(`   ❌ Error: ${errorText}`);
                }
                
            } catch (error) {
                console.log(`   💥 Request failed: ${error.message}`);
            }
        }
        
        // Step 4: Test invalid parameters
        console.log('\n4️⃣ Testing invalid parameters...');
        const invalidTests = [
            {
                name: 'Invalid page number',
                url: 'http://localhost:3001/api/audit-logs?page=-1'
            },
            {
                name: 'Invalid limit',
                url: 'http://localhost:3001/api/audit-logs?limit=abc'
            },
            {
                name: 'Invalid category',
                url: 'http://localhost:3001/api/audit-logs?category=INVALID_CATEGORY'
            }
        ];
        
        for (const test of invalidTests) {
            console.log(`\n   Testing: ${test.name}`);
            try {
                const response = await fetch(test.url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                console.log(`   Status: ${response.status}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    console.log(`   Response: ${errorText}`);
                }
            } catch (error) {
                console.log(`   Error: ${error.message}`);
            }
        }
        
        console.log('\n🎉 Audit logs API testing completed!');
        
    } catch (error) {
        console.error('💥 Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testAuditLogsWithAuth();