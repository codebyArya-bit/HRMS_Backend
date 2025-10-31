import fetch from 'node-fetch';

async function testEndpoints() {
  try {
    // First, login to get a token
    console.log('Logging in...');
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'a@a.com',
        password: '12'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (!loginData.token) {
      console.error('No token received');
      return;
    }
    
    const token = loginData.token;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Test daily activity endpoint
    console.log('\nTesting daily activity endpoint...');
    const dailyResponse = await fetch('http://localhost:3001/api/admin/activity/daily', { headers });
    console.log('Daily response status:', dailyResponse.status);
    
    if (dailyResponse.ok) {
      const dailyData = await dailyResponse.json();
      console.log('Daily data:', JSON.stringify(dailyData, null, 2));
    } else {
      const dailyError = await dailyResponse.text();
      console.log('Daily error:', dailyError);
    }
    
    // Test weekly activity endpoint
    console.log('\nTesting weekly activity endpoint...');
    const weeklyResponse = await fetch('http://localhost:3001/api/admin/activity/weekly', { headers });
    console.log('Weekly response status:', weeklyResponse.status);
    
    if (weeklyResponse.ok) {
      const weeklyData = await weeklyResponse.json();
      console.log('Weekly data:', JSON.stringify(weeklyData, null, 2));
    } else {
      const weeklyError = await weeklyResponse.text();
      console.log('Weekly error:', weeklyError);
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testEndpoints();