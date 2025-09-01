// เช็ค authentication ก่อนโหลดหน้า admin
async function checkAdminAuth() {
  try {
    console.log('🔍 Checking admin authentication...');
    
    const response = await fetch('/api/admin/me', {
      credentials: 'include'
    });
    
    const data = await response.json();
    console.log('Auth check response:', data);
    
    if (!data.success || !data.user) {
      console.log('❌ Authentication failed, redirecting to login...');
      window.location.href = '/admin/login.html';
      return false;
    }
    
    // แสดงข้อมูล admin ใน UI
    console.log('✅ Admin authenticated:', data.user);
    updateAdminUI(data.user);
    return true;
    
  } catch (error) {
    console.error('Auth check failed:', error);
    window.location.href = '/admin/login.html';
    return false;
  }
}

// อัปเดต UI ด้วยข้อมูล admin
function updateAdminUI(user) {
  // แสดงชื่อ admin ใน header (ถ้ามี element)
  const adminNameEl = document.getElementById('admin-name');
  if (adminNameEl) {
    adminNameEl.textContent = user.name || user.email;
  }
  
  // เก็บข้อมูลใน localStorage
  localStorage.setItem('admin_user', JSON.stringify(user));
}

// Logout function
async function adminLogout() {
  try {
    console.log('🚪 Logging out...');
    
    const response = await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include'
    });
    
    const data = await response.json();
    console.log('Logout response:', data);
    
    // ลบข้อมูลใน localStorage
    localStorage.removeItem('admin_user');
    
    // Redirect ไป login
    window.location.href = '/admin/login.html';
    
  } catch (error) {
    console.error('Logout error:', error);
    // Force redirect แม้ logout ไม่สำเร็จ
    localStorage.removeItem('admin_user');
    window.location.href = '/admin/login.html';
  }
}

// ฟังก์ชันเพื่อเพิ่ม logout button
function addLogoutButton() {
  // หา header หรือ navigation area
  const header = document.querySelector('header, .header, .navbar, .top-bar');
  if (header) {
    const logoutBtn = document.createElement('button');
    logoutBtn.innerHTML = '🚪 ออกจากระบบ';
    logoutBtn.className = 'btn btn-outline-danger btn-sm';
    logoutBtn.style.marginLeft = 'auto';
    logoutBtn.onclick = adminLogout;
    
    header.appendChild(logoutBtn);
  }
}

// ตรวจสอบ auth เมื่อโหลดหน้า
document.addEventListener('DOMContentLoaded', async () => {
  // เช็คว่าไม่ใช่หน้า login
  if (!window.location.pathname.includes('login.html')) {
    console.log('📍 Current page:', window.location.pathname);
    
    const isAuthenticated = await checkAdminAuth();
    if (isAuthenticated) {
      console.log('✅ Authentication passed, loading admin panel...');
      addLogoutButton();
    }
  }
});

// Export functions สำหรับใช้ในไฟล์อื่น
window.adminLogout = adminLogout;
window.checkAdminAuth = checkAdminAuth;