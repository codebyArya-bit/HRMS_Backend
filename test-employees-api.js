import fetch from 'node-fetch';

async function testEmployeesAPI() {
  try {
    // First, login to get a token
    console.log('🔐 Logging in...');
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
    console.log('✅ Login response status:', loginResponse.status);
    
    if (!loginData.token) {
      console.error('❌ No token received');
      console.log('Login response:', loginData);
      return;
    }
    
    const token = loginData.token;
    console.log('🎫 Token received, length:', token.length);
    
    // Test employees API endpoint with role filter
    console.log('\n🔍 Testing employees API with role=EMPLOYEE...');
    const employeesResponse = await fetch('http://localhost:3001/api/employees?role=EMPLOYEE', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Employees API response status:', employeesResponse.status);
    
    if (employeesResponse.ok) {
      const employeesData = await employeesResponse.json();
      console.log('📈 Employees count:', employeesData.employees ? employeesData.employees.length : 'No employees array');
      console.log('📋 Total employees:', employeesData.total || employeesData.pagination?.total);
      console.log('📄 Pagination:', employeesData.pagination);
      
      if (employeesData.employees && employeesData.employees.length > 0) {
        console.log('\n👥 First few employees:');
        employeesData.employees.slice(0, 3).forEach((emp, index) => {
          console.log(`${index + 1}. ${emp.name} (${emp.email}) - Role: ${emp.role?.name || emp.role} - Dept: ${emp.department}`);
        });
      } else {
        console.log('❌ No employees found in response');
      }
      
      // Also test without role filter
      console.log('\n🔍 Testing employees API without role filter...');
      const allEmployeesResponse = await fetch('http://localhost:3001/api/employees', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (allEmployeesResponse.ok) {
        const allEmployeesData = await allEmployeesResponse.json();
        console.log('📊 All employees count:', allEmployeesData.employees ? allEmployeesData.employees.length : 'No employees array');
        console.log('📋 Total all employees:', allEmployeesData.total || allEmployeesData.pagination?.total);
        
        if (allEmployeesData.employees && allEmployeesData.employees.length > 0) {
          console.log('\n👥 All employees roles:');
          const roleCounts = {};
          allEmployeesData.employees.forEach(emp => {
            const role = emp.role?.name || emp.role || 'UNKNOWN';
            roleCounts[role] = (roleCounts[role] || 0) + 1;
          });
          console.log('🏷️ Role distribution:', roleCounts);
        }
      }
      
    } else {
      const errorData = await employeesResponse.text();
      console.log('❌ Employees API error:', errorData);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testEmployeesAPI();