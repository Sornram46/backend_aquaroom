document.getElementById('login-form').onsubmit = async function (e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorDiv = document.getElementById('login-error');
  
  // ซ่อน error message
  errorDiv.classList.add('hidden');
  
  // เช็ค input
  if (!username || !password) {
    errorDiv.textContent = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน';
    errorDiv.classList.remove('hidden');
    return;
  }

  try {
    console.log('🔐 Attempting login...');
    
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // ✅ เพื่อให้ส่ง cookie
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    console.log('Login response:', data);
    
    if (data.success) {
      console.log('✅ Login successful:', data.user);
      
      // ✅ เก็บข้อมูล user ใน localStorage
      if (data.user) {
        localStorage.setItem('admin_user', JSON.stringify(data.user));
      }
      
      // แสดงข้อความสำเร็จ
      errorDiv.style.backgroundColor = '#d4edda';
      errorDiv.style.color = '#155724';
      errorDiv.style.borderColor = '#c3e6cb';
      errorDiv.textContent = 'เข้าสู่ระบบสำเร็จ กำลังเปลี่ยนหน้า...';
      errorDiv.classList.remove('hidden');
      
      // Redirect หลังจาก 1 วินาที
      setTimeout(() => {
        window.location.href = '/admin/';
      }, 1000);
      
    } else {
      errorDiv.textContent = data.message || 'เข้าสู่ระบบไม่สำเร็จ';
      errorDiv.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Login error:', error);
    errorDiv.textContent = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
    errorDiv.classList.remove('hidden');
  }
};