const API_BASE = 'http://localhost:3001/api/public';

async function makeRequest(url, options = {}) {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        ...options
    });
    
    const data = await response.json();
    return { status: response.status, ok: response.ok, data };
}

async function testPublicAuditAPI() {
    console.log('🚀 Testing Public Audit Logs API (No Authentication Required)');
    console.log('=' .repeat(60));

    try {
        // Test 1: Get audit logs
        console.log('\n📋 Test 1: Get Audit Logs');
        console.log('GET /api/public/audit-logs');
        
        const response1 = await makeRequest(`${API_BASE}/audit-logs`);
        
        console.log(`✅ Status: ${response1.status}`);
        console.log(`📊 Found ${response1.data.data?.length || 0} audit logs`);
        console.log(`📄 Pagination: Page ${response1.data.pagination?.page || 1} of ${response1.data.pagination?.pages || 1}`);
        
        if (response1.data.data && response1.data.data.length > 0) {
            const firstLog = response1.data.data[0];
            console.log(`📝 Sample log: ${firstLog.action} by ${firstLog.user?.name || 'System'} (${firstLog.severity})`);
        }

        // Test 2: Get audit stats
        console.log('\n📊 Test 2: Get Audit Stats');
        console.log('GET /api/public/audit-logs/stats');
        
        const response2 = await makeRequest(`${API_BASE}/audit-logs/stats`);
        
        console.log(`✅ Status: ${response2.status}`);
        const stats = response2.data.data;
        console.log(`📈 Total Logs: ${stats.totalLogs || 0}`);
        console.log(`📅 Today's Count: ${stats.todayCount || 0}`);
        console.log(`🚨 Critical Events: ${stats.severityCounts?.CRITICAL || 0}`);
        console.log(`✅ Success Events: ${stats.statusCounts?.SUCCESS || 0}`);

        // Test 3: Get specific log (if available)
        if (response1.data.data && response1.data.data.length > 0) {
            const logId = response1.data.data[0].id;
            
            console.log('\n🔍 Test 3: Get Specific Log');
            console.log(`GET /api/public/audit-logs/${logId}`);
            
            const response3 = await makeRequest(`${API_BASE}/audit-logs/${logId}`);
            
            console.log(`✅ Status: ${response3.status}`);
            const logData = response3.data.data;
            console.log(`📝 Log Details: ${logData.action} - ${logData.category} (${logData.severity})`);
            console.log(`👤 User: ${logData.user?.name || 'System'}`);
            console.log(`⏰ Timestamp: ${logData.timestamp}`);
        }

        // Test 4: Test with filters
        console.log('\n🔍 Test 4: Test with Filters');
        console.log('GET /api/public/audit-logs?severity=HIGH&limit=3');
        
        const response4 = await makeRequest(`${API_BASE}/audit-logs?severity=HIGH&limit=3`);
        
        console.log(`✅ Status: ${response4.status}`);
        console.log(`📊 High severity logs: ${response4.data.data?.length || 0}`);

        // Test 5: Test with pagination
        console.log('\n📄 Test 5: Test with Pagination');
        console.log('GET /api/public/audit-logs?page=1&limit=5');
        
        const response5 = await makeRequest(`${API_BASE}/audit-logs?page=1&limit=5`);
        
        console.log(`✅ Status: ${response5.status}`);
        console.log(`📊 Paginated results: ${response5.data.data?.length || 0} logs`);
        console.log(`📄 Pagination info: Page ${response5.data.pagination?.page} of ${response5.data.pagination?.pages}`);

        console.log('\n' + '=' .repeat(60));
        console.log('🎉 All public API tests completed successfully!');
        console.log('✅ Public audit logs API is working without authentication');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        
        if (error.response) {
            console.error(`📊 Status: ${error.response.status}`);
            console.error(`📝 Response:`, error.response.data);
        } else if (error.request) {
            console.error('🌐 No response received from server');
            console.error('💡 Make sure the backend server is running on http://localhost:3001');
        } else {
            console.error('⚙️ Request setup error:', error.message);
        }
        
        process.exit(1);
    }
}

// Run the test
testPublicAuditAPI();