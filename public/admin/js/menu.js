// Menu Items Configuration
const menuItems = [
  {
    name: 'แดชบอร์ด',
    href: '/admin',
    icon: 'home',
    id: 'dashboard'
  },
  {
    name: 'จัดการสินค้า',
    href: '/admin/products-list',
    icon: 'shopping-bag',
    id: 'products'
  },
  {
    name: 'หมวดหมู่',
    href: '/admin/categories',
    icon: 'folder',
    id: 'categories'
  },
  {
    name: 'คำสั่งซื้อ',
    href: '/admin/orders',
    icon: 'shopping-cart',
    id: 'orders'
  },
  {
    name: 'ลูกค้า',
    href: '/admin/customers',
    icon: 'users',
    id: 'customers'
  },
  {
    name: 'คูปอง',
    href: '/admin/coupons',
    icon: 'ticket',
    id: 'coupons',
    description: 'สร้างและจัดการรหัสส่วนลดสำหรับลูกค้า'
  },
  {
    name: 'แจ้งเตือน', // เพิ่มเมนูใหม่
    href: '/admin/alerts',
    icon: 'bell',
    id: 'alerts',
    badge: true // เพิ่ม badge indicator
  },
  {
    name: 'รายงาน',
    href: '/admin/reports',
    icon: 'bar-chart-3',
    id: 'reports'
  },
  {
    name: 'ตั้งค่า',
    href: '/admin/settings',
    icon: 'settings',
    id: 'settings'
  },

];

// เก็บสถานะการแสดงเมนูย่อย
let expandedMenus = {};

// Populate sidebar menu
function populateSidebarMenu() {
  const sidebarMenuEl = document.getElementById('sidebar-menu');
  if (!sidebarMenuEl) return;

  const currentPath = window.location.pathname;
  
  // ล้างเมนูเดิมก่อน
  sidebarMenuEl.innerHTML = '';
  
  menuItems.forEach(item => {
    const isActive = currentPath === item.href || 
                   (item.href !== '/admin' && currentPath.startsWith(item.href));
    
    // ตรวจสอบว่าเป็นเมนูที่มีเมนูย่อยหรือไม่
    if (item.submenu && item.submenu.length > 0) {
      // สร้าง Dropdown Menu
      const menuContainer = document.createElement('div');
      menuContainer.className = 'mb-1';
      
      // สร้างปุ่มสำหรับเปิด/ปิดเมนูย่อย
      const menuButton = document.createElement('button');
      menuButton.className = `flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium rounded-md
        ${isActive ? 'sidebar-active' : 'text-gray-700 hover:bg-gray-50'}`;
      
      // กำหนดค่าเริ่มต้นของ expandedMenus[item.name]
      if (expandedMenus[item.name] === undefined) {
        expandedMenus[item.name] = isActive; // เปิดอัตโนมัติถ้าเมนูนี้กำลังใช้งานอยู่
      }
      
      menuButton.innerHTML = `
        <div class="flex items-center">
          <i data-lucide="${item.icon}" class="w-5 h-5 mr-3 ${isActive ? 'icon-active' : 'text-gray-500'}"></i>
          ${item.name}
        </div>
        <i data-lucide="${expandedMenus[item.name] ? 'chevron-down' : 'chevron-right'}" class="w-4 h-4 submenu-icon"></i>
      `;
      
      menuButton.addEventListener('click', () => {
        expandedMenus[item.name] = !expandedMenus[item.name];
        populateSidebarMenu(); // วาดเมนูใหม่เพื่อแสดงผลการเปลี่ยนแปลง
      });
      
      menuContainer.appendChild(menuButton);
      
      // สร้างรายการเมนูย่อย (แสดงเฉพาะเมื่อเปิด)
      if (expandedMenus[item.name]) {
        const submenuContainer = document.createElement('div');
        submenuContainer.className = 'pl-8 mt-1 space-y-1';
        
        item.submenu.forEach(subItem => {
          const isSubActive = currentPath === subItem.path;

          const subLink = document.createElement('a');
          subLink.href = subItem.path;
          subLink.className = `flex items-center px-4 py-2 text-sm rounded-md ${
            isSubActive ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700 hover:bg-gray-50'
          }`;

          // เพิ่ม icon ถ้ามี
          subLink.innerHTML = subItem.icon
            ? `<i data-lucide="${subItem.icon}" class="w-4 h-4 mr-2"></i>${subItem.name}`
            : subItem.name;
          
          submenuContainer.appendChild(subLink);
        });
        
        menuContainer.appendChild(submenuContainer);
      }
      
      sidebarMenuEl.appendChild(menuContainer);
    } else {
      // เมนูปกติไม่มีเมนูย่อย
      const link = document.createElement('a');
      link.href = item.href;
      link.className = `flex items-center px-4 py-2.5 text-sm font-medium rounded-md ${
        isActive ? 'sidebar-active' : 'text-gray-700 hover:bg-gray-50'
      }`;
      
      link.innerHTML = `
        <i data-lucide="${item.icon}" class="w-5 h-5 mr-3 ${isActive ? 'icon-active' : 'text-gray-500'}"></i>
        ${item.name}
      `;
      
      sidebarMenuEl.appendChild(link);
    }
  });
  
  // Re-initialize icons
  lucide.createIcons();
}

// Mobile menu toggle
function setupMobileMenu() {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (!mobileMenuBtn || !sidebar || !overlay) return;
  
  mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
    overlay.classList.toggle('hidden');
  });
  
  overlay.addEventListener('click', () => {
    sidebar.classList.add('hidden');
    overlay.classList.add('hidden');
  });
}

// User dropdown toggle
function setupUserDropdown() {
  const userMenuButton = document.getElementById('userMenuButton');
  const userDropdown = document.getElementById('user-dropdown');
  
  if (!userMenuButton || !userDropdown) return;
  
  userMenuButton.addEventListener('click', () => {
    userDropdown.classList.toggle('hidden');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (event) => {
    if (!userMenuButton.contains(event.target) && !userDropdown.contains(event.target)) {
      userDropdown.classList.add('hidden');
    }
  });
}

// Initialize all components
document.addEventListener('DOMContentLoaded', () => {
  populateSidebarMenu();
  setupMobileMenu();
  setupUserDropdown();
  
  // Re-initialize Lucide icons for dynamically added elements
  lucide.createIcons();
});