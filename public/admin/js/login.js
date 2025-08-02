document.getElementById('login-form').onsubmit = async function (e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorDiv = document.getElementById('login-error');
  errorDiv.classList.add('hidden');

  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.success) {
    window.location.href = '/admin/';
  } else {
    errorDiv.textContent = data.message || 'เข้าสู่ระบบไม่สำเร็จ';
    errorDiv.classList.remove('hidden');
  }
};