// สร้างไฟล์ใหม่: customers-manager.js

/**
 * Customer Management System
 * จัดการลูกค้าในระบบ Admin
 */

class CustomersManager {
  constructor() {
    this.currentPage = 1;
    this.limit = 20;
    this.searchQuery = '';
    this.sortBy = 'created_at';
    this.sortOrder = 'desc';
    this.customers = [];
    this.selectedCustomer = null;
    
    this.bindEvents();
  }
  
  bindEvents() {
    console.log('Binding events...'); // Debug log
    
    // ใช้ document.body แทน document เผื่อ timing issue
    document.body.addEventListener('click', (e) => {
      console.log('Click detected:', e.target); // Debug log
      
      if (e.target.matches('[data-action="view-customer"]') || 
          e.target.closest('[data-action="view-customer"]')) {
        e.preventDefault();
        const customerId = e.target.dataset.customerId || 
                          e.target.closest('[data-action="view-customer"]').dataset.customerId;
        console.log('View customer:', customerId);
        this.viewCustomerDetail(parseInt(customerId));
      }
      
      if (e.target.matches('[data-action="toggle-customer-status"]') || 
          e.target.closest('[data-action="toggle-customer-status"]')) {
        e.preventDefault();
        const customerId = e.target.dataset.customerId || 
                          e.target.closest('[data-action="toggle-customer-status"]').dataset.customerId;
        console.log('Toggle status:', customerId);
        this.toggleCustomerStatus(parseInt(customerId));
      }
      
      if (e.target.matches('[data-action="delete-customer"]') || 
          e.target.closest('[data-action="delete-customer"]')) {
        e.preventDefault();
        const customerId = e.target.dataset.customerId || 
                          e.target.closest('[data-action="delete-customer"]').dataset.customerId;
        console.log('Delete customer:', customerId);
        this.deleteCustomer(parseInt(customerId));
      }
      
      if (e.target.matches('[data-action="export-customers"]')) {
        e.preventDefault();
        console.log('Export customers');
        this.exportCustomers();
      }
    });
    
    // Search event
    document.body.addEventListener('input', (e) => {
      if (e.target.matches('#customers-search')) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.searchQuery = e.target.value;
          this.currentPage = 1;
          this.loadCustomers();
        }, 500);
      }
    });
    
    // Sort event
    document.body.addEventListener('change', (e) => {
      if (e.target.matches('#customers-sort')) {
        const [sortBy, sortOrder] = e.target.value.split('-');
        this.sortBy = sortBy;
        this.sortOrder = sortOrder;
        this.currentPage = 1;
        this.loadCustomers();
      }
    });
  }
  
  async initialize() {
    await this.loadCustomers();
    this.renderCustomersView();
  }
  
  async loadCustomers() {
    try {
      const params = new URLSearchParams({
        page: this.currentPage.toString(),
        limit: this.limit.toString(),
        search: this.searchQuery,
        sortBy: this.sortBy,
        sortOrder: this.sortOrder
      });
      
      const response = await fetch(`/api/admin/customers?${params}`);
      if (!response.ok) throw new Error('Failed to load customers');
      
      const result = await response.json();
      this.customers = result.data;
      this.pagination = result.pagination;
      
      return result;
    } catch (error) {
      console.error('Error loading customers:', error);
      this.showError('ไม่สามารถโหลดข้อมูลลูกค้าได้');
      throw error;
    }
  }
  
  renderCustomersView() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    mainContent.innerHTML = `
      <div class="customers-manager">
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">จัดการลูกค้า</h1>
            <p class="text-gray-600">ดูและจัดการข้อมูลลูกค้าทั้งหมด</p>
          </div>
          
          <div class="flex items-center space-x-3 mt-4 md:mt-0">
            <button 
              data-action="export-customers"
              class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <i data-lucide="download" class="w-4 h-4 mr-2"></i>
              ส่งออกข้อมูล
            </button>
          </div>
        </div>
        
        <!-- Filters and Search -->
        <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <!-- Search -->
            <div class="flex-1 max-w-md">
              <div class="relative">
                <input
                  type="text"
                  id="customers-search"
                  placeholder="ค้นหาลูกค้า (ชื่อ, อีเมล, เบอร์โทร)"
                  value="${this.searchQuery}"
                  class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                <i data-lucide="search" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"></i>
              </div>
            </div>
            
            <!-- Sort -->
            <div class="flex items-center space-x-3">
              <label class="text-sm font-medium text-gray-700">เรียงตาม:</label>
              <select id="customers-sort" class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="created_at-desc" ${this.sortBy === 'created_at' && this.sortOrder === 'desc' ? 'selected' : ''}>วันที่สมัครล่าสุด</option>
                <option value="created_at-asc" ${this.sortBy === 'created_at' && this.sortOrder === 'asc' ? 'selected' : ''}>วันที่สมัครเก่าสุด</option>
                <option value="first_name-asc" ${this.sortBy === 'first_name' && this.sortOrder === 'asc' ? 'selected' : ''}>ชื่อ A-Z</option>
                <option value="first_name-desc" ${this.sortBy === 'first_name' && this.sortOrder === 'desc' ? 'selected' : ''}>ชื่อ Z-A</option>
                <option value="email-asc" ${this.sortBy === 'email' && this.sortOrder === 'asc' ? 'selected' : ''}>อีเมล A-Z</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Loading State -->
        <div id="customers-loading" class="hidden">
          <div class="bg-white rounded-lg shadow-sm p-8 text-center">
            <div class="inline-flex items-center">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-3"></div>
              <span class="text-gray-600">กำลังโหลดข้อมูลลูกค้า...</span>
            </div>
          </div>
        </div>
        
        <!-- Customers Table -->
        <div id="customers-table-container" class="bg-white rounded-lg shadow-sm overflow-hidden">
          ${this.renderCustomersTable()}
        </div>
        
        <!-- Pagination -->
        <div id="customers-pagination" class="mt-6">
          ${this.renderPagination()}
        </div>
      </div>
      
      <!-- Customer Detail Modal -->
      <div id="customer-detail-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
          <div id="customer-detail-content">
            <!-- Customer detail content will be loaded here -->
          </div>
        </div>
      </div>
    `;
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
  
  renderCustomersTable() {
    if (this.customers.length === 0) {
      return `
        <div class="p-8 text-center">
          <i data-lucide="users" class="w-12 h-12 text-gray-400 mx-auto mb-4"></i>
          <h3 class="text-lg font-medium text-gray-900 mb-2">ไม่พบข้อมูลลูกค้า</h3>
          <p class="text-gray-500">ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง</p>
        </div>
      `;
    }
    
    return `
      <!-- Mobile Card View -->
      <div class="block md:hidden">
        ${this.customers.map(customer => this.renderCustomerCard(customer)).join('')}
      </div>
      
      <!-- Desktop Table View -->
      <div class="hidden md:block">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ลูกค้า</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ติดต่อ</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถิติ</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่สมัคร</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">การจัดการ</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${this.customers.map(customer => this.renderCustomerRow(customer)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  renderCustomerCard(customer) {
    // แก้ไขการสร้าง initials ให้ปลอดภัย
    const customerName = customer.name || 'No Name';
    const customerInitials = customerName.split(' ')
      .filter(n => n && n.length > 0)  // กรองเฉพาะคำที่ไม่ว่าง
      .map(n => n.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2) || 'NN'; // ใช้ 'NN' ถ้าไม่มีชื่อ
    
    return `
      <div class="p-4 border-b border-gray-200 hover:bg-gray-50">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center mb-2">
              <div class="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                <span class="text-indigo-600 font-semibold text-sm">
                  ${customerInitials}
                </span>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-900">${customerName}</h3>
                <p class="text-xs text-gray-500">${customer.email || 'No Email'}</p>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 text-xs text-gray-600 mb-3">
              <div>
                <span class="font-medium">คำสั่งซื้อ:</span> ${customer.total_orders || 0} ครั้ง
              </div>
              <div>
                <span class="font-medium">ยอดรวม:</span> ฿${(customer.total_spent || 0).toLocaleString()}
              </div>
            </div>
            
            <div class="flex items-center justify-between">
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                customer.is_active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }">
                ${customer.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
              </span>
              
              <div class="flex space-x-2">
                <button 
                  data-action="view-customer" 
                  data-customer-id="${customer.id}"
                  class="text-indigo-600 hover:text-indigo-900 text-xs font-medium"
                >
                  ดูรายละเอียด
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  renderCustomerRow(customer) {
    // แก้ไขการสร้าง initials ให้ปลอดภัย
    const customerName = customer.name || 'No Name';
    const customerInitials = customerName.split(' ')
      .filter(n => n && n.length > 0)  // กรองเฉพาะคำที่ไม่ว่าง
      .map(n => n.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2) || 'NN'; // ใช้ 'NN' ถ้าไม่มีชื่อ
    
    return `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <div class="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-4">
              <span class="text-indigo-600 font-semibold text-sm">
                ${customerInitials}
              </span>
            </div>
            <div>
              <div class="text-sm font-medium text-gray-900">${customerName}</div>
              <div class="text-sm text-gray-500">ID: ${customer.id}</div>
            </div>
          </div>
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm text-gray-900">${customer.email || 'No Email'}</div>
          <div class="text-sm text-gray-500">${customer.default_address?.phone || 'ไม่ระบุ'}</div>
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm text-gray-900">${customer.total_orders || 0} คำสั่งซื้อ</div>
          <div class="text-sm text-gray-500">฿${(customer.total_spent || 0).toLocaleString()}</div>
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            customer.is_active 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }">
            ${customer.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
          </span>
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          ${customer.created_at ? new Date(customer.created_at).toLocaleDateString('th-TH') : '-'}
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div class="flex items-center justify-end space-x-2">
            <button 
              data-action="view-customer" 
              data-customer-id="${customer.id}"
              class="text-indigo-600 hover:text-indigo-900 text-sm"
              title="ดูรายละเอียด"
            >
              <i data-lucide="eye" class="w-4 h-4"></i>
            </button>
            
            <button 
              data-action="toggle-customer-status" 
              data-customer-id="${customer.id}"
              class="text-yellow-600 hover:text-yellow-900 text-sm"
              title="${customer.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}"
            >
              <i data-lucide="${customer.is_active ? 'user-x' : 'user-check'}" class="w-4 h-4"></i>
            </button>
            
            <button 
              data-action="delete-customer" 
              data-customer-id="${customer.id}"
              class="text-red-600 hover:text-red-900 text-sm"
              title="ลบลูกค้า"
            >
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }
  
  renderPagination() {
    if (!this.pagination || this.pagination.total_pages <= 1) {
      return '';
    }
    
    const { current_page, total_pages, has_prev, has_next } = this.pagination;
    
    return `
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-700">
          แสดง ${((current_page - 1) * this.limit) + 1} - ${Math.min(current_page * this.limit, this.pagination.total_count)} 
          จากทั้งหมด ${this.pagination.total_count} รายการ
        </div>
        
        <div class="flex items-center space-x-2">
          <button 
            onclick="customersManager.goToPage(${current_page - 1})"
            ${!has_prev ? 'disabled' : ''}
            class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ก่อนหน้า
          </button>
          
          <span class="px-3 py-2 text-sm text-gray-700">
            หน้า ${current_page} จาก ${total_pages}
          </span>
          
          <button 
            onclick="customersManager.goToPage(${current_page + 1})"
            ${!has_next ? 'disabled' : ''}
            class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ถัดไป
          </button>
        </div>
      </div>
    `;
  }
  
  async goToPage(page) {
    if (page < 1 || (this.pagination && page > this.pagination.total_pages)) return;
    
    this.currentPage = page;
    
    this.showLoading();
    await this.loadCustomers();
    this.updateTable();
    this.hideLoading();
  }
  
  showLoading() {
    const loading = document.getElementById('customers-loading');
    const table = document.getElementById('customers-table-container');
    if (loading && table) {
      loading.classList.remove('hidden');
      table.classList.add('opacity-50');
    }
  }
  
  hideLoading() {
    const loading = document.getElementById('customers-loading');
    const table = document.getElementById('customers-table-container');
    if (loading && table) {
      loading.classList.add('hidden');
      table.classList.remove('opacity-50');
    }
  }
  
  updateTable() {
    const container = document.getElementById('customers-table-container');
    const pagination = document.getElementById('customers-pagination');
    
    if (container) {
      container.innerHTML = this.renderCustomersTable();
    }
    
    if (pagination) {
      pagination.innerHTML = this.renderPagination();
    }
    
    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
  
  async viewCustomerDetail(customerId) {
    try {
      this.showCustomerDetailModal();
      
      const response = await fetch(`/api/admin/customers/${customerId}`);
      if (!response.ok) throw new Error('Failed to load customer details');
      
      const result = await response.json();
      this.selectedCustomer = result.data;
      
      this.renderCustomerDetail();
      
    } catch (error) {
      console.error('Error loading customer details:', error);
      this.showError('ไม่สามารถโหลดรายละเอียดลูกค้าได้');
      this.hideCustomerDetailModal();
    }
  }
  
  showCustomerDetailModal() {
    const modal = document.getElementById('customer-detail-modal');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }
  
  hideCustomerDetailModal() {
    const modal = document.getElementById('customer-detail-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = 'auto';
    }
  }
  
  renderCustomerDetail() {
    const container = document.getElementById('customer-detail-content');
    if (!container || !this.selectedCustomer) return;
    
    const customer = this.selectedCustomer;
    const customerName = customer.name || 'No Name';
    
    container.innerHTML = `
      <div class="customer-detail">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-gray-900">รายละเอียดลูกค้า</h2>
          <button onclick="customersManager.hideCustomerDetailModal()" class="text-gray-400 hover:text-gray-600">
            <i data-lucide="x" class="w-6 h-6"></i>
          </button>
        </div>
        
        <!-- Customer Info -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <!-- Basic Info -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">ข้อมูลพื้นฐาน</h3>
            <div class="space-y-3">
              <div>
                <label class="text-sm font-medium text-gray-500">ชื่อ</label>
                <p class="text-gray-900">${customerName}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-500">อีเมล</label>
                <p class="text-gray-900">${customer.email || 'No Email'}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-500">ประเภทบัญชี</label>
                <p class="text-gray-900">${customer.role || '-'}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-500">ระบบล็อกอิน</label>
                <p class="text-gray-900">${customer.auth_provider || '-'}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-500">ยืนยันอีเมล</label>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  customer.is_email_verified 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }">
                  ${customer.is_email_verified ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}
                </span>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-500">สถานะ</label>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  customer.is_active 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }">
                  ${customer.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                </span>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-500">วันที่สมัคร</label>
                <p class="text-gray-900">${customer.created_at ? new Date(customer.created_at).toLocaleDateString('th-TH') : '-'}</p>
              </div>
              ${customer.last_login ? `
              <div>
                <label class="text-sm font-medium text-gray-500">ล็อกอินครั้งล่าสุด</label>
                <p class="text-gray-900">${new Date(customer.last_login).toLocaleDateString('th-TH')}</p>
              </div>
              ` : ''}
            </div>
          </div>
          
          <!-- Statistics -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">สถิติการซื้อ</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="text-center">
                <div class="text-2xl font-bold text-indigo-600">${customer.statistics?.total_orders || 0}</div>
                <div class="text-sm text-gray-500">คำสั่งซื้อ</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-green-600">฿${(customer.statistics?.total_spent || 0).toLocaleString()}</div>
                <div class="text-sm text-gray-500">ยอดรวม</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-blue-600">฿${(customer.statistics?.average_order_value || 0).toLocaleString()}</div>
                <div class="text-sm text-gray-500">ค่าเฉลี่ย/ครั้ง</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-purple-600">${Object.keys(customer.statistics?.orders_by_status || {}).length}</div>
                <div class="text-sm text-gray-500">สถานะต่างๆ</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Addresses -->
        ${customer.addresses && customer.addresses.length > 0 ? `
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">ที่อยู่</h3>
            <div class="space-y-3">
              ${customer.addresses.map(addr => `
                <div class="bg-gray-50 rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-gray-900">${addr.name || 'ไม่ระบุชื่อ'}</span>
                    ${addr.is_default ? '<span class="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">ที่อยู่หลัก</span>' : ''}
                  </div>
                  <p class="text-gray-600 text-sm">
                    ${addr.full_address || addr.address_line1 || 'ไม่มีที่อยู่'}<br>
                    โทร: ${addr.phone || 'ไม่ระบุ'}
                  </p>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Recent Orders -->
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">ประวัติคำสั่งซื้อล่าสุด</h3>
          <div class="overflow-hidden border border-gray-200 rounded-lg">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">คำสั่งซื้อ</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ยอดรวม</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${customer.orders && customer.orders.length > 0 ? customer.orders.slice(0, 10).map(order => `
                  <tr>
                    <td class="px-4 py-3 text-sm text-gray-900">${order.order_number || `#${order.id}`}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">฿${(order.total_amount || 0).toLocaleString()}</td>
                    <td class="px-4 py-3">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${this.getOrderStatusClass(order.order_status)}">
                        ${this.getOrderStatusText(order.order_status)}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-500">${order.created_at ? new Date(order.created_at).toLocaleDateString('th-TH') : '-'}</td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="4" class="px-4 py-8 text-center text-sm text-gray-500">ยังไม่มีประวัติการสั่งซื้อ</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-end space-x-3">
          <button 
            onclick="customersManager.hideCustomerDetailModal()"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            ปิด
          </button>
          <button 
            data-action="toggle-customer-status" 
            data-customer-id="${customer.id}"
            class="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
          >
            ${customer.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
          </button>
        </div>
      </div>
    `;
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
  
  getOrderStatusClass(status) {
    const statusClasses = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'processing': 'bg-blue-100 text-blue-800',
      'shipped': 'bg-indigo-100 text-indigo-800',
      'delivered': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    return statusClasses[status] || 'bg-gray-100 text-gray-800';
  }
  
  getOrderStatusText(status) {
    const statusText = {
      'pending': 'รอดำเนินการ',
      'processing': 'กำลังจัดเตรียม',
      'shipped': 'จัดส่งแล้ว',
      'delivered': 'ส่งมอบแล้ว',
      'cancelled': 'ยกเลิก'
    };
    return statusText[status] || status;
  }
  
  async toggleCustomerStatus(customerId) {
    const customer = this.customers.find(c => c.id === customerId) || this.selectedCustomer;
    if (!customer) return;
    
    const customerName = customer.name || 'ลูกค้า';
    const newStatus = !customer.is_active;
    const action = newStatus ? 'เปิดใช้งาน' : 'ปิดใช้งาน';
    
    const result = await Swal.fire({
      title: `ยืนยัน${action}ลูกค้า?`,
      text: `คุณต้องการ${action}ลูกค้า "${customerName}" หรือไม่?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: newStatus ? '#10B981' : '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: `ใช่, ${action}`,
      cancelButtonText: 'ยกเลิก'
    });
    
    if (!result.isConfirmed) return;
    
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: newStatus })
      });
      
      if (!response.ok) throw new Error('Failed to update customer status');
      
      const updateResult = await response.json();
      
      // อัพ เดทข้อมูลในตาราง
      const customerIndex = this.customers.findIndex(c => c.id === customerId);
      if (customerIndex >= 0) {
        this.customers[customerIndex].is_active = newStatus;
      }
      
      // อัพเดทข้อมูลใน modal ถ้าเปิดอยู่
      if (this.selectedCustomer && this.selectedCustomer.id === customerId) {
        this.selectedCustomer.is_active = newStatus;
        this.renderCustomerDetail();
      }
      
      this.updateTable();
      
      Swal.fire({
        title: 'สำเร็จ!',
        text: `${action}ลูกค้าเรียบร้อยแล้ว`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
      
    } catch (error) {
      console.error('Error updating customer status:', error);
      Swal.fire({
        title: 'เกิดข้อผิดพลาด!',
        text: `ไม่สามารถ${action}ลูกค้าได้`,
        icon: 'error'
      });
    }
  }
  
  async deleteCustomer(customerId) {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return;
    
    const customerName = customer.name || 'ลูกค้า';
    
    const result = await Swal.fire({
      title: 'ยืนยันลบลูกค้า?',
      html: `
        <p>คุณต้องการลบลูกค้า "<strong>${customerName}</strong>" หรือไม่?</p>
        <p class="text-sm text-gray-500 mt-2">
          ${(customer.total_orders || 0) > 0 
            ? '⚠️ ลูกค้าคนนี้มีประวัติการสั่งซื้อ ระบบจะปิดใช้งานแทนการลบ' 
            : '⚠️ การลบจะไม่สามารถยกเลิกได้'
          }
        </p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ใช่, ลบ',
      cancelButtonText: 'ยกเลิก'
    });
    
    if (!result.isConfirmed) return;
    
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete customer');
      
      const deleteResult = await response.json();
      
      if (deleteResult.type === 'deleted') {
        // ลบออกจากตาราง
        this.customers = this.customers.filter(c => c.id !== customerId);
      } else {
        // อัพเดทสถานะ
        const customerIndex = this.customers.findIndex(c => c.id === customerId);
        if (customerIndex >= 0) {
          this.customers[customerIndex].is_active = false;
        }
      }
      
      this.updateTable();
      
      Swal.fire({
        title: 'สำเร็จ!',
        text: deleteResult.message,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
      
    } catch (error) {
      console.error('Error deleting customer:', error);
      Swal.fire({
        title: 'เกิดข้อผิดพลาด!',
        text: 'ไม่สามารถลบลูกค้าได้',
        icon: 'error'
      });
    }
  }
  
  async exportCustomers() {
    try {
      // สร้าง CSV data
      const csvData = this.customers.map(customer => ({
        'ID': customer.id,
        'ชื่อ': customer.name || 'No Name',
        'อีเมล': customer.email || 'No Email',
        'เบอร์โทร': customer.default_address?.phone || '',
        'จำนวนคำสั่งซื้อ': customer.total_orders || 0,
        'ยอดรวม': customer.total_spent || 0,
        'สถานะ': customer.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน',
        'วันที่สมัคร': customer.created_at ? new Date(customer.created_at).toLocaleDateString('th-TH') : '-'
      }));
      
      // แปลงเป็น CSV
      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => headers.map(header => `"${row[header]}"`).join(','))
      ].join('\n');
      
      // สร้างไฟล์และดาวน์โหลด
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `customers-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.showSuccess('ส่งออกข้อมูลลูกค้าเรียบร้อยแล้ว');
      
    } catch (error) {
      console.error('Error exporting customers:', error);
      this.showError('ไม่สามารถส่งออกข้อมูลได้');
    }
  }
  
  showSuccess(message) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'สำเร็จ!',
        text: message,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      alert(message);
    }
  }
  
  showError(message) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'เกิดข้อผิดพลาด!',
        text: message,
        icon: 'error'
      });
    } else {
      alert(message);
    }
  }
}

// 🔥 เพิ่มส่วนนี้ในท้ายไฟล์ - ส่วนที่ขาดหายไป! 🔥
console.log('customers-manager.js loading...');

// Export class ให้ global scope
window.CustomersManager = CustomersManager;

// สร้าง instance global
console.log('Creating global customersManager instance...');
if (!window.customersManager) {
  window.customersManager = new CustomersManager();
}

console.log('customers-manager.js loaded successfully');
console.log('CustomersManager class:', window.CustomersManager);
console.log('customersManager instance:', window.customersManager);