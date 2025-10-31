import fetch from 'node-fetch';

async function testAuditLogsAPI() {
    try {
        console.log('Testing audit logs API endpoint...');
        
        // First, let's test if the server is running
        const healthCheck = await fetch('http://localhost:3001/', {
            method: 'GET'
        });
        
        console.log('Health check status:', healthCheck.status);
        const healthText = await healthCheck.text();
        console.log('Health check response:', healthText);
        
        // Test the audit logs endpoint without authentication
        const response = await fetch('http://localhost:3001/api/audit-logs', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Audit logs API status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers));
        
        const responseText = await response.text();
        console.log('Response body:', responseText);
        
        if (!response.ok) {
            console.log('API call failed with status:', response.status);
            console.log('Status text:', response.statusText);
        }
        
    } catch (error) {
        console.error('Error testing API:', error.message);
        console.error('Full error:', error);
    }
}

testAuditLogsAPI();