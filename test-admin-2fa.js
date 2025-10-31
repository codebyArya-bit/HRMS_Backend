// Test script for admin 2FA enable/disable functionality

const BASE_URL = 'http://localhost:3001/api';

async function testAdmin2FA() {
  try {
    console.log('🔐 Testing Admin 2FA functionality...\n');

    // Step 1: Login as admin
    console.log('1. Logging in as admin...');
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'a@a.com',
        password: '12'
      })
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.text();
      throw new Error(`Login failed: ${loginResponse.status} - ${error}`);
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Login successful');

    // Step 2: Get list of users to find a test user
    console.log('\n2. Getting list of users...');
    const usersResponse = await fetch(`${BASE_URL}/2fa/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!usersResponse.ok) {
      const error = await usersResponse.text();
      throw new Error(`Get users failed: ${usersResponse.status} - ${error}`);
    }

    const usersData = await usersResponse.json();
    console.log(`✅ Found ${usersData.users.length} users`);
    
    // Find a user without 2FA enabled to test enable functionality
    const testUser = usersData.users.find(user => !user.twoFactorEnabled);
    if (!testUser) {
      console.log('❌ No users found without 2FA enabled. Let\'s try to disable 2FA for a user first...');
      
      // Find a user with 2FA enabled to disable it first
      const enabledUser = usersData.users.find(user => user.twoFactorEnabled);
      if (enabledUser) {
        console.log(`\n3a. Disabling 2FA for user: ${enabledUser.name} (${enabledUser.email})`);
        const disableResponse = await fetch(`${BASE_URL}/2fa/admin/disable/${enabledUser.id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!disableResponse.ok) {
          const error = await disableResponse.text();
          console.error(`❌ Disable 2FA failed: ${disableResponse.status} - ${error}`);
        } else {
          const disableData = await disableResponse.json();
          console.log('✅ 2FA disabled successfully:', disableData.message);
        }
      }
    }

    // Step 3: Test enabling 2FA for a user
    const targetUser = testUser || usersData.users[1]; // Use second user if no disabled user found
    console.log(`\n3. Testing enable 2FA for user: ${targetUser.name} (${targetUser.email})`);
    
    const enableResponse = await fetch(`${BASE_URL}/2fa/admin/enable/${targetUser.id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'totp'
      })
    });

    console.log('Response status:', enableResponse.status);
    console.log('Response headers:', Object.fromEntries(enableResponse.headers.entries()));

    if (!enableResponse.ok) {
      const error = await enableResponse.text();
      console.error(`❌ Enable 2FA failed: ${enableResponse.status} - ${error}`);
      return;
    }

    const enableData = await enableResponse.json();
    console.log('✅ 2FA enabled successfully:', enableData);

    // Step 4: Verify the change by getting updated user list
    console.log('\n4. Verifying 2FA was enabled...');
    const verifyResponse = await fetch(`${BASE_URL}/2fa/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      const updatedUser = verifyData.users.find(u => u.id === targetUser.id);
      console.log(`✅ User 2FA status: ${updatedUser.twoFactorEnabled ? 'Enabled' : 'Disabled'}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testAdmin2FA();