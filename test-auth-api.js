async function testAuthenticatedAPI() {
  try {
    // First, login to get a token
    console.log('Attempting to login...');
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
    console.log('Login response status:', loginResponse.status);
    console.log('Login successful!');
    console.log('Token:', loginData.token ? 'Token received' : 'No token');
    
    const token = loginData.token;
    
    if (!token) {
      console.log('No token received from login');
      console.log('Login response:', loginData);
      return;
    }
    
    // Now test the 2FA users API with the token
    console.log('\nTesting /api/2fa/users with authentication...');
    const usersResponse = await fetch('http://localhost:3001/api/2fa/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const usersData = await usersResponse.json();
    console.log('API Response Status:', usersResponse.status);
    console.log('Users count:', usersData.users ? usersData.users.length : 'No users array');
    console.log('Total users:', usersData.total);
    console.log('First few users:', usersData.users ? usersData.users.slice(0, 3) : 'No users');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAuthenticatedAPI();