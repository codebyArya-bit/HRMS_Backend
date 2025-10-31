import fetch from 'node-fetch';

async function testAPI() {
  try {
    console.log('Testing 2FA API endpoint...');
    
    // First, let's test if the server is running
    const response = await fetch('http://localhost:3001/api/2fa/users', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // We'll test without auth first to see what happens
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response body:', text);
    
    if (response.status === 401) {
      console.log('API requires authentication - this is expected');
    }
    
  } catch (error) {
    console.error('Error testing API:', error.message);
  }
}

testAPI();