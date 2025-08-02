/**
 * 🎫 Coupons Management System
 * จัดการคูปอง/รหัสส่วนลดในระบบ Admin
 */

class CouponsManager {
  constructor() {
    this.coupons = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.itemsPerPage = 10;
    this.searchQuery = '';
    this.filterStatus = 'all';
    this.filterType = 'all';
    this.sortBy = 'created_at';
    this.sortOrder = 'desc';
    
    console.log('🎫 CouponsManager initialized');
  }

  async initialize() {
    console.log('🎫 Initializing Coupons Manager...');
    
    try {
      await this.renderCouponsInterface();
      await this.loadCoupons();
      this.setupEventListeners();
      
      console.log('✅ Coupons Manager initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Coupons Manager:', error);
      this.showError('เกิดข้อผิดพลาดในการเริ่มต้นระบบจัดการคูปอง');
    }
  }

  async renderCouponsInterface() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
      throw new Error('Main content element not found');
    }

    mainContent.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">🎫 จัดการคูปอง</h1>
            <p class="text-sm text-gray-600 mt-1">สร้าง แก้ไข และจัดการรหัสส่วนลดสำหรับลูกค้า</p>
          </div>
          
          <div class="flex items-center gap-3">
            <button 
              id="btn-refresh-coupons" 
              class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              title="รีเฟรช"
            >
              <i data-lucide="refresh-cw" class="w-4 h-4"></i>
              รีเฟรช
            </button>
            
            <button 
              id="btn-create-coupon" 
              class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <i data-lucide="plus" class="w-4 h-4"></i>
              สร้างคูปองใหม่
            </button>
          </div>
        </div>

        <!-- Filters & Search -->
        <div class="bg-white rounded-lg shadow-sm border p-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <!-- Search -->
            <div class="lg:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">ค้นหาคูปอง</label>
              <div class="relative">
                <input 
                  type="text" 
                  id="coupon-search"
                  placeholder="ค้นหาโดยรหัสหรือชื่อคูปอง..."
                  class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                <i data-lucide="search" class="absolute left-3 top-2.5 w-4 h-4 text-gray-400"></i>
              </div>
            </div>

            <!-- Status Filter -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
              <select id="filter-status" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                <option value="all">ทั้งหมด</option>
                <option value="active">เปิดใช้งาน</option>
                <option value="inactive">ปิดใช้งาน</option>
                <option value="expired">หมดอายุ</option>
              </select>
            </div>

            <!-- Type Filter -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
              <select id="filter-type" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                <option value="all">ทั้งหมด</option>
                <option value="percentage">เปอร์เซ็นต์</option>
                <option value="fixed_amount">จำนวนคงที่</option>
              </select>
            </div>

            <!-- Sort -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">เรียงโดย</label>
              <select id="sort-by" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                <option value="created_at">วันที่สร้าง</option>
                <option value="code">รหัสคูปอง</option>
                <option value="discount_value">มูลค่าส่วนลด</option>
                <option value="usage_count">จำนวนการใช้งาน</option>
                <option value="end_date">วันหมดอายุ</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="coupon-stats">
          <!-- จะถูกเติมโดย JavaScript -->
        </div>

        <!-- Coupons Table -->
        <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
          <!-- Table Header -->
          <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900">รายการคูปอง</h3>
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <span id="coupon-count">กำลังโหลด...</span>
              </div>
            </div>
          </div>

          <!-- Table Content -->
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    รหัสคูปอง
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ชื่อ/คำอธิบาย
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ส่วนลด
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    เงื่อนไข
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    การใช้งาน
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    วันหมดอายุ
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    สถานะ
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody id="coupons-table-body" class="bg-white divide-y divide-gray-200">
                <!-- จะถูกเติมโดย JavaScript -->
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div id="coupon-pagination" class="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <!-- จะถูกเติมโดย JavaScript -->
          </div>
        </div>
      </div>

      <!-- Create/Edit Coupon Modal -->
      <div id="coupon-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden z-50">
        <div class="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/5 xl:w-1/2 shadow-lg rounded-lg bg-white">
          <div class="mt-3">
            <!-- Modal Header -->
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-xl font-bold text-gray-900" id="modal-title">สร้างคูปองใหม่</h3>
              <button class="text-gray-400 hover:text-gray-600" onclick="window.closeCouponModal()">
                <i data-lucide="x" class="w-6 h-6"></i>
              </button>
            </div>

            <!-- Modal Body -->
            <form id="coupon-form" class="space-y-6">
              <input type="hidden" id="coupon-id" value="">
              
              <!-- Basic Information -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">รหัสคูปอง *</label>
                  <input 
                    type="text" 
                    id="coupon-code" 
                    name="code" 
                    required 
                    placeholder="เช่น SAVE20, WELCOME10"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase"
                    maxlength="50"
                  >
                  <p class="text-xs text-gray-500 mt-1">ใช้ตัวอักษรและตัวเลขเท่านั้น (สูงสุด 50 ตัวอักษร)</p>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">ชื่อคูปอง *</label>
                  <input 
                    type="text" 
                    id="coupon-name" 
                    name="name" 
                    required 
                    placeholder="เช่น ส่วนลดต้อนรับสมาชิกใหม่"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    maxlength="255"
                  >
                </div>
              </div>

              <!-- Description -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">คำอธิบาย</label>
                <textarea 
                  id="coupon-description" 
                  name="description" 
                  rows="3"
                  placeholder="อธิบายรายละเอียดของคูปอง เงื่อนไขการใช้งาน ฯลฯ"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                ></textarea>
              </div>

              <!-- Discount Settings -->
              <div class="border rounded-lg p-4 bg-gray-50">
                <h4 class="font-semibold text-gray-900 mb-4">🎯 การตั้งค่าส่วนลด</h4>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">ประเภทส่วนลด *</label>
                    <select 
                      id="discount-type" 
                      name="discount_type" 
                      required 
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      onchange="window.toggleDiscountType()"
                    >
                      <option value="percentage">เปอร์เซ็นต์ (%)</option>
                      <option value="fixed_amount">จำนวนเงินคงที่ (บาท)</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      <span id="discount-value-label">ค่าส่วนลด (%) *</span>
                    </label>
                    <input 
                      type="number" 
                      id="discount-value" 
                      name="discount_value" 
                      required 
                      min="0"
                      step="0.01"
                      placeholder="10"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                  </div>
                </div>

                <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">ยอดสั่งซื้อขั้นต่ำ (บาท)</label>
                    <input 
                      type="number" 
                      id="min-order-amount" 
                      name="min_order_amount" 
                      min="0"
                      step="0.01"
                      placeholder="500"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                  </div>

                  <div id="max-discount-container">
                    <label class="block text-sm font-medium text-gray-700 mb-2">ส่วนลดสูงสุด (บาท)</label>
                    <input 
                      type="number" 
                      id="max-discount-amount" 
                      name="max_discount_amount" 
                      min="0"
                      step="0.01"
                      placeholder="1000"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                    <p class="text-xs text-gray-500 mt-1">เฉพาะคูปองแบบเปอร์เซ็นต์</p>
                  </div>
                </div>
              </div>

              <!-- Usage Limits -->
              <div class="border rounded-lg p-4 bg-gray-50">
                <h4 class="font-semibold text-gray-900 mb-4">📊 การจำกัดการใช้งาน</h4>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">จำนวนการใช้งานทั้งหมด</label>
                    <input 
                      type="number" 
                      id="usage-limit" 
                      name="usage_limit" 
                      min="1"
                      placeholder="100 (เว้นว่างเพื่อไม่จำกัด)"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">จำกัดการใช้ต่อผู้ใช้</label>
                    <input 
                      type="number" 
                      id="usage-limit-per-user" 
                      name="usage_limit_per_user" 
                      min="1"
                      placeholder="1 (เว้นว่างเพื่อไม่จำกัด)"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                  </div>
                </div>
              </div>

              <!-- Date Range -->
              <div class="border rounded-lg p-4 bg-gray-50">
                <h4 class="font-semibold text-gray-900 mb-4">📅 ระยะเวลาใช้งาน</h4>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">วันที่เริ่มใช้งาน *</label>
                    <input 
                      type="datetime-local" 
                      id="start-date" 
                      name="start_date" 
                      required 
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">วันที่หมดอายุ *</label>
                    <input 
                      type="datetime-local" 
                      id="end-date" 
                      name="end_date" 
                      required 
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                  </div>
                </div>
              </div>

              <!-- Advanced Options -->
              <div class="border rounded-lg p-4 bg-gray-50">
                <h4 class="font-semibold text-gray-900 mb-4">⚙️ ตัวเลือกขั้นสูง</h4>
                
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">จำนวนสินค้าขั้นต่ำ</label>
                    <input 
                      type="number" 
                      id="minimum-quantity" 
                      name="minimum_quantity" 
                      min="1"
                      placeholder="1 (เว้นว่างเพื่อไม่จำกัด)"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                  </div>

                  <div class="flex items-center">
                    <input 
                      type="checkbox" 
                      id="is-active" 
                      name="is_active" 
                      checked 
                      class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    >
                    <label for="is-active" class="ml-2 block text-sm text-gray-900">
                      เปิดใช้งานคูปองทันที
                    </label>
                  </div>
                </div>
              </div>

              <!-- Modal Footer -->
              <div class="flex justify-end space-x-3 pt-4 border-t">
                <button 
                  type="button" 
                  onclick="window.closeCouponModal()" 
                  class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  id="coupon-submit-btn" 
                  class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <span id="coupon-submit-text">บันทึกคูปอง</span>
                  <div id="coupon-submit-loading" class="hidden">
                    <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  setupEventListeners() {
    console.log('🎯 Setting up event listeners...');
    
    // รอให้ DOM พร้อม
    setTimeout(() => {
      // Create button
      const createBtn = document.getElementById('btn-create-coupon');
      if (createBtn) {
        console.log('✅ Create button found, attaching listener');
        createBtn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('🔔 Create button clicked');
          this.openCouponModal();
        });
      } else {
        console.warn('⚠️ Create button not found');
      }

      // Refresh button
      const refreshBtn = document.getElementById('btn-refresh-coupons');
      if (refreshBtn) {
        console.log('✅ Refresh button found, attaching listener');
        refreshBtn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('🔔 Refresh button clicked');
          this.loadCoupons();
        });
      } else {
        console.warn('⚠️ Refresh button not found');
      }

      // Search input
      const searchInput = document.getElementById('coupon-search');
      if (searchInput) {
        console.log('✅ Search input found, attaching listener');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            console.log('🔍 Search query:', e.target.value);
            this.searchQuery = e.target.value;
            this.currentPage = 1;
            this.loadCoupons();
          }, 500);
        });
      } else {
        console.warn('⚠️ Search input not found');
      }

      // Filter dropdowns
      const statusFilter = document.getElementById('filter-status');
      if (statusFilter) {
        console.log('✅ Status filter found, attaching listener');
        statusFilter.addEventListener('change', (e) => {
          console.log('🔧 Status filter changed:', e.target.value);
          this.filterStatus = e.target.value;
          this.currentPage = 1;
          this.loadCoupons();
        });
      }

      const typeFilter = document.getElementById('filter-type');
      if (typeFilter) {
        console.log('✅ Type filter found, attaching listener');
        typeFilter.addEventListener('change', (e) => {
          console.log('🔧 Type filter changed:', e.target.value);
          this.filterType = e.target.value;
          this.currentPage = 1;
          this.loadCoupons();
        });
      }

      const sortBy = document.getElementById('sort-by');
      if (sortBy) {
        console.log('✅ Sort by found, attaching listener');
        sortBy.addEventListener('change', (e) => {
          console.log('🔧 Sort changed:', e.target.value);
          this.sortBy = e.target.value;
          this.loadCoupons();
        });
      }

      // Form submission
      const couponForm = document.getElementById('coupon-form');
      if (couponForm) {
        console.log('✅ Coupon form found, attaching listener');
        couponForm.addEventListener('submit', (e) => {
          e.preventDefault();
          console.log('📝 Form submitted');
          this.saveCoupon();
        });
      }

      // Set default dates
      this.setDefaultDates();
      
      console.log('✅ All event listeners set up');
    }, 500); // รอ 500ms ให้ DOM render เสร็จ
  }

  async loadCoupons() {
  console.log('📥 Loading coupons...');
  console.log('Current params:', {
    page: this.currentPage,
    limit: this.itemsPerPage,
    search: this.searchQuery,
    status: this.filterStatus,
    type: this.filterType,
    sort: this.sortBy,
    order: this.sortOrder
  });
  
  try {
    this.showTableLoading();
    
    // Build query parameters
    const params = new URLSearchParams({
      page: this.currentPage.toString(),
      limit: this.itemsPerPage.toString(),
      sort: this.sortBy,
      order: this.sortOrder
    });

    if (this.searchQuery) params.append('search', this.searchQuery);
    if (this.filterStatus !== 'all') params.append('status', this.filterStatus);
    if (this.filterType !== 'all') params.append('type', this.filterType);

    const url = `/api/admin/coupons?${params}`;
    console.log('🔗 API URL:', url);

    const response = await fetch(url);
    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('📊 API Response:', data);

    if (data.success) {
      this.coupons = data.data || [];
      this.totalPages = data.pagination?.total_pages || 1;
      
      console.log(`✅ Loaded ${this.coupons.length} coupons`);
      
      this.renderCouponsTable();
      this.renderPagination();
      this.updateCouponCount(data.pagination?.total_count || 0);
      
      // Load statistics
      await this.loadCouponStats();
    } else {
      throw new Error(data.message || 'API returned success: false');
    }

  } catch (error) {
    console.error('❌ Error loading coupons:', error);
    this.showTableError(`ไม่สามารถโหลดข้อมูลคูปองได้: ${error.message}`);
  }
}

  async loadCouponStats() {
    try {
      const response = await fetch('/api/admin/coupons/stats');
      const data = await response.json();

      if (data.success) {
        this.renderCouponStats(data.data);
      }
    } catch (error) {
      console.error('Error loading coupon stats:', error);
    }
  }

  renderCouponStats(stats) {
    const statsContainer = document.getElementById('coupon-stats');
    if (!statsContainer) return;

    const statsCards = [
      {
        title: 'คูปองทั้งหมด',
        value: stats.total_coupons || 0,
        icon: 'ticket',
        color: 'blue'
      },
      {
        title: 'กำลังใช้งาน',
        value: stats.active_coupons || 0,
        icon: 'check-circle',
        color: 'green'
      },
      {
        title: 'หมดอายุ',
        value: stats.expired_coupons || 0,
        icon: 'clock',
        color: 'orange'
      },
      {
        title: 'ถูกใช้งานแล้ว',
        value: stats.used_count || 0,
        icon: 'shopping-cart',
        color: 'purple'
      }
    ];

    statsContainer.innerHTML = statsCards.map(stat => `
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-${stat.color}-100 mr-4">
            <i data-lucide="${stat.icon}" class="w-6 h-6 text-${stat.color}-600"></i>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-600">${stat.title}</p>
            <p class="text-2xl font-bold text-gray-900">${stat.value.toLocaleString()}</p>
          </div>
        </div>
      </div>
    `).join('');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }


renderCouponsTable() {
  console.log('🎨 Rendering coupons table...');
  
  const tableBody = document.getElementById('coupons-table-body');
  if (!tableBody) {
    console.error('❌ Table body not found');
    return;
  }

  if (!this.coupons || this.coupons.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="px-6 py-8 text-center text-gray-500">
          <div class="flex flex-col items-center">
            <i data-lucide="inbox" class="w-12 h-12 mb-2 text-gray-400"></i>
            <span class="text-lg font-medium">ไม่มีข้อมูลคูปอง</span>
            <span class="text-sm">เริ่มต้นด้วยการสร้างคูปองใหม่</span>
          </div>
        </td>
      </tr>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const now = new Date();
  
  tableBody.innerHTML = this.coupons.map((coupon, index) => {
    const startNum = (this.currentPage - 1) * this.itemsPerPage + index + 1;
    
    // ตรวจสอบสถานะ
    const isActive = coupon.is_active;
    const isExpired = new Date(coupon.end_date) < now;
    const isNotStarted = new Date(coupon.start_date) > now;
    
    let statusBadge, statusText;
    if (!isActive) {
      statusBadge = 'bg-gray-100 text-gray-800';
      statusText = 'ปิดใช้งาน';
    } else if (isExpired) {
      statusBadge = 'bg-red-100 text-red-800';
      statusText = 'หมดอายุ';
    } else if (isNotStarted) {
      statusBadge = 'bg-yellow-100 text-yellow-800';
      statusText = 'ยังไม่เริ่ม';
    } else {
      statusBadge = 'bg-green-100 text-green-800';
      statusText = 'ใช้งานได้';
    }

    // Format discount
    const discountText = coupon.discount_type === 'percentage' 
      ? `${coupon.discount_value}%` 
      : `${Number(coupon.discount_value).toLocaleString('th-TH')} บาท`;

    // Usage info
    const usageText = coupon.usage_limit 
      ? `${coupon.usage_count || 0}/${coupon.usage_limit}`
      : `${coupon.usage_count || 0}`;

    return `
      <tr class="hover:bg-gray-50 border-b border-gray-200">
        <td class="px-6 py-4 text-sm text-gray-900">${startNum}</td>
        <td class="px-6 py-4">
          <div>
            <div class="font-semibold text-gray-900">${this.escapeHtml(coupon.code)}</div>
            <div class="text-sm text-gray-500">${this.escapeHtml(coupon.name)}</div>
          </div>
        </td>
        <td class="px-6 py-4 text-sm text-gray-900">${discountText}</td>
        <td class="px-6 py-4 text-sm text-gray-900">
          ${coupon.min_order_amount ? Number(coupon.min_order_amount).toLocaleString('th-TH') + ' บาท' : '-'}
        </td>
        <td class="px-6 py-4 text-sm text-gray-900">${usageText}</td>
        <td class="px-6 py-4">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge}">
            ${statusText}
          </span>
        </td>
        <td class="px-6 py-4 text-sm text-gray-500">
          ${new Date(coupon.start_date).toLocaleDateString('th-TH')} - 
          ${new Date(coupon.end_date).toLocaleDateString('th-TH')}
        </td>
        <td class="px-6 py-4 text-sm font-medium">
          <div class="flex items-center space-x-2">
            <!-- ปุ่มดู -->
            <button 
              onclick="window.couponsManager.viewCoupon(${coupon.id})" 
              class="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
              title="ดูรายละเอียด"
            >
              <i data-lucide="eye" class="w-4 h-4"></i>
            </button>
            
            <!-- ปุ่มแก้ไข -->
            <button 
              onclick="window.couponsManager.editCoupon(${coupon.id})" 
              class="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50"
              title="แก้ไข"
            >
              <i data-lucide="edit" class="w-4 h-4"></i>
            </button>
            
            <!-- ปุ่มเปิด/ปิดใช้งาน -->
            <button 
              onclick="window.couponsManager.toggleCouponStatus(${coupon.id}, ${!coupon.is_active})" 
              class="${isActive ? 'text-red-600 hover:text-red-900 hover:bg-red-50' : 'text-green-600 hover:text-green-900 hover:bg-green-50'} p-1 rounded"
              title="${isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}"
            >
              <i data-lucide="${isActive ? 'toggle-right' : 'toggle-left'}" class="w-4 h-4"></i>
            </button>
            
            <!-- ปุ่มลบ -->
            <button 
              onclick="window.couponsManager.deleteCoupon(${coupon.id}, '${this.escapeHtml(coupon.code)}')" 
              class="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
              title="ลบ"
            >
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Initialize Lucide icons สำหรับปุ่มที่สร้างใหม่
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  
  console.log(`✅ Rendered ${this.coupons.length} coupons in table`);
}

  getCouponStatus(coupon) {
    const now = new Date();
    const startDate = new Date(coupon.start_date);
    const endDate = new Date(coupon.end_date);

    if (!coupon.is_active) return 'ปิดใช้งาน';
    if (now < startDate) return 'ยังไม่เริ่ม';
    if (now > endDate) return 'หมดอายุ';
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) return 'ใช้หมดแล้ว';
    
    return 'ใช้งานได้';
  }

  getStatusClass(status) {
    const classes = {
      'ใช้งานได้': 'bg-green-100 text-green-800',
      'ยังไม่เริ่ม': 'bg-blue-100 text-blue-800',
      'หมดอายุ': 'bg-red-100 text-red-800',
      'ใช้หมดแล้ว': 'bg-orange-100 text-orange-800',
      'ปิดใช้งาน': 'bg-gray-100 text-gray-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  }

  renderPagination() {
    const paginationContainer = document.getElementById('coupon-pagination');
    if (!paginationContainer || this.totalPages <= 1) {
      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
    const endItem = Math.min(this.currentPage * this.itemsPerPage, this.coupons.length);

    paginationContainer.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-700">
          แสดง ${startItem} ถึง ${endItem} จากทั้งหมด ${this.coupons.length} รายการ
        </div>
        <div class="flex space-x-2">
          <button 
            onclick="couponsManager.goToPage(${this.currentPage - 1})" 
            class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 ${this.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
            ${this.currentPage === 1 ? 'disabled' : ''}
          >
            ก่อนหน้า
          </button>
          
          ${this.renderPageNumbers()}
          
          <button 
            onclick="couponsManager.goToPage(${this.currentPage + 1})" 
            class="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 ${this.currentPage === this.totalPages ? 'opacity-50 cursor-not-allowed' : ''}"
            ${this.currentPage === this.totalPages ? 'disabled' : ''}
          >
            ถัดไป
          </button>
        </div>
      </div>
    `;
  }

  renderPageNumbers() {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(`
        <button 
          onclick="couponsManager.goToPage(${i})" 
          class="px-3 py-2 text-sm font-medium rounded-md ${
            i === this.currentPage 
              ? 'bg-indigo-600 text-white' 
              : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
          }"
        >
          ${i}
        </button>
      `);
    }

    return pages.join('');
  }

  goToPage(page) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadCoupons();
    }
  }

  updateCouponCount(total) {
    const countElement = document.getElementById('coupon-count');
    if (countElement) {
      countElement.textContent = `${total.toLocaleString()} รายการ`;
    }
  }

  showTableLoading() {
    const tableBody = document.getElementById('coupons-table-body');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="px-6 py-12 text-center">
            <div class="flex items-center justify-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
              <span class="text-gray-600">กำลังโหลดข้อมูลคูปอง...</span>
            </div>
          </td>
        </tr>
      `;
    }
  }

  showTableError(message) {
    const tableBody = document.getElementById('coupons-table-body');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="px-6 py-12 text-center">
            <div class="text-red-500">
              <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-4"></i>
              <h3 class="text-lg font-medium mb-2">เกิดข้อผิดพลาด</h3>
              <p class="text-sm">${message}</p>
              <button 
                onclick="couponsManager.loadCoupons()" 
                class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                ลองใหม่
              </button>
            </div>
          </td>
        </tr>
      `;
      
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }

 openCouponModal(couponData = null) {
  console.log('🎫 Opening coupon modal...', couponData ? 'Edit mode' : 'Create mode');
  
  const modal = document.getElementById('coupon-modal');
  const modalTitle = document.getElementById('modal-title');
  const form = document.getElementById('coupon-form');
  
  if (!modal) {
    console.error('❌ Modal not found');
    return;
  }
  
  if (!modalTitle) {
    console.error('❌ Modal title not found');
    return;
  }
  
  if (!form) {
    console.error('❌ Form not found');
    return;
  }

  // Reset form
  form.reset();
  document.getElementById('coupon-id').value = '';

  if (couponData) {
    // Edit mode
    modalTitle.textContent = 'แก้ไขคูปอง';
    this.populateForm(couponData);
  } else {
    // Create mode
    modalTitle.textContent = 'สร้างคูปองใหม่';
    this.setDefaultDates();
  }

  // แสดง modal
  modal.classList.remove('hidden');
  
  // Focus ที่ input แรก
  setTimeout(() => {
    const firstInput = document.getElementById('coupon-code');
    if (firstInput) {
      firstInput.focus();
    }
  }, 100);
  
  console.log('✅ Modal opened successfully');
}

closeCouponModal() {
  console.log('🎫 Closing coupon modal...');
  
  const modal = document.getElementById('coupon-modal');
  if (modal) {
    modal.classList.add('hidden');
    console.log('✅ Modal closed');
  } else {
    console.error('❌ Modal not found');
  }
}

  populateForm(coupon) {
    document.getElementById('coupon-id').value = coupon.id;
    document.getElementById('coupon-code').value = coupon.code;
    document.getElementById('coupon-name').value = coupon.name;
    document.getElementById('coupon-description').value = coupon.description || '';
    document.getElementById('discount-type').value = coupon.discount_type;
    document.getElementById('discount-value').value = coupon.discount_value;
    document.getElementById('min-order-amount').value = coupon.min_order_amount || '';
    document.getElementById('max-discount-amount').value = coupon.max_discount_amount || '';
    document.getElementById('usage-limit').value = coupon.usage_limit || '';
    document.getElementById('usage-limit-per-user').value = coupon.usage_limit_per_user || '';
    document.getElementById('minimum-quantity').value = coupon.minimum_quantity || '';
    document.getElementById('is-active').checked = coupon.is_active;

    // Set dates
    if (coupon.start_date) {
      document.getElementById('start-date').value = new Date(coupon.start_date).toISOString().slice(0, 16);
    }
    if (coupon.end_date) {
      document.getElementById('end-date').value = new Date(coupon.end_date).toISOString().slice(0, 16);
    }

    this.toggleDiscountType();
  }

  setDefaultDates() {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    document.getElementById('start-date').value = now.toISOString().slice(0, 16);
    document.getElementById('end-date').value = nextWeek.toISOString().slice(0, 16);
  }

  toggleDiscountType() {
    const discountType = document.getElementById('discount-type').value;
    const valueLabel = document.getElementById('discount-value-label');
    const valueInput = document.getElementById('discount-value');
    const maxDiscountContainer = document.getElementById('max-discount-container');

    if (discountType === 'percentage') {
      valueLabel.textContent = 'ค่าส่วนลด (%) *';
      valueInput.placeholder = '10';
      valueInput.max = '100';
      maxDiscountContainer.style.display = 'block';
    } else {
      valueLabel.textContent = 'จำนวนเงิน (บาท) *';
      valueInput.placeholder = '100';
      valueInput.removeAttribute('max');
      maxDiscountContainer.style.display = 'none';
    }
  }

  async saveCoupon() {
    const submitBtn = document.getElementById('coupon-submit-btn');
    const submitText = document.getElementById('coupon-submit-text');
    const submitLoading = document.getElementById('coupon-submit-loading');
    
    // Show loading state
    submitBtn.disabled = true;
    submitText.textContent = 'กำลังบันทึก...';
    submitLoading.classList.remove('hidden');

    try {
      const formData = new FormData(document.getElementById('coupon-form'));
      const couponId = document.getElementById('coupon-id').value;
      const isEdit = !!couponId;

      const couponData = {
        code: formData.get('code')?.toUpperCase(),
        name: formData.get('name'),
        description: formData.get('description') || null,
        discount_type: formData.get('discount_type'),
        discount_value: parseFloat(formData.get('discount_value')),
        min_order_amount: formData.get('min_order_amount') ? parseFloat(formData.get('min_order_amount')) : null,
        max_discount_amount: formData.get('max_discount_amount') ? parseFloat(formData.get('max_discount_amount')) : null,
        usage_limit: formData.get('usage_limit') ? parseInt(formData.get('usage_limit')) : null,
        usage_limit_per_user: formData.get('usage_limit_per_user') ? parseInt(formData.get('usage_limit_per_user')) : null,
        minimum_quantity: formData.get('minimum_quantity') ? parseInt(formData.get('minimum_quantity')) : null,
        start_date: formData.get('start_date'),
        end_date: formData.get('end_date'),
        is_active: document.getElementById('is-active').checked
      };

      // Validation
      if (!this.validateCouponData(couponData)) {
        return;
      }

      const url = isEdit ? `/api/admin/coupons/${couponId}` : '/api/admin/coupons';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(couponData)
      });

      const result = await response.json();

      if (result.success) {
        await Swal.fire({
          title: 'สำเร็จ!',
          text: `${isEdit ? 'อัพเดท' : 'สร้าง'}คูปองเรียบร้อยแล้ว`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });

        this.closeCouponModal();
        await this.loadCoupons();
      } else {
        throw new Error(result.message || 'ไม่สามารถบันทึกคูปองได้');
      }

    } catch (error) {
      console.error('Error saving coupon:', error);
      await Swal.fire({
        title: 'เกิดข้อผิดพลาด!',
        text: error.message,
        icon: 'error'
      });
    } finally {
      // Reset button state
      submitBtn.disabled = false;
      submitText.textContent = 'บันทึกคูปอง';
      submitLoading.classList.add('hidden');
    }
  }

  validateCouponData(data) {
    if (!data.code || data.code.length < 3) {
      Swal.fire('ข้อมูลไม่ถูกต้อง', 'รหัสคูปองต้องมีอย่างน้อย 3 ตัวอักษร', 'warning');
      return false;
    }

    if (!data.name) {
      Swal.fire('ข้อมูลไม่ถูกต้อง', 'กรุณาระบุชื่อคูปอง', 'warning');
      return false;
    }

    if (!data.discount_value || data.discount_value <= 0) {
      Swal.fire('ข้อมูลไม่ถูกต้อง', 'ค่าส่วนลดต้องมากกว่า 0', 'warning');
      return false;
    }

    if (data.discount_type === 'percentage' && data.discount_value > 100) {
      Swal.fire('ข้อมูลไม่ถูกต้อง', 'ส่วนลดแบบเปอร์เซ็นต์ต้องไม่เกิน 100%', 'warning');
      return false;
    }

    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);

    if (endDate <= startDate) {
      Swal.fire('ข้อมูลไม่ถูกต้อง', 'วันหมดอายุต้องหลังจากวันเริ่มใช้งาน', 'warning');
      return false;
    }

    return true;
  }

  async viewCoupon(couponId) {
    console.log('👁️ Viewing coupon:', couponId);
    
    try {
      const response = await fetch(`/api/admin/coupons/${couponId}`);
      const data = await response.json();
      
      if (data.success) {
        this.showCouponDetails(data.data);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('❌ Error viewing coupon:', error);
      this.showNotification('ไม่สามารถดูรายละเอียดคูปองได้', 'error');
    }
  }

  async editCoupon(couponId) {
    console.log('✏️ Editing coupon:', couponId);
    
    try {
      const response = await fetch(`/api/admin/coupons/${couponId}`);
      const data = await response.json();
      
      if (data.success) {
        this.openCouponModal(data.data);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('❌ Error loading coupon for edit:', error);
      this.showNotification('ไม่สามารถโหลดข้อมูลคูปองสำหรับแก้ไขได้', 'error');
    }
  }

  async toggleCouponStatus(couponId, newStatus) {
    console.log(`🔄 Toggling coupon ${couponId} status to:`, newStatus);
    
    // แสดง confirmation
    const action = newStatus ? 'เปิดใช้งาน' : 'ปิดใช้งาน';
    const confirmed = await this.showConfirm(
      `ยืนยันการ${action}คูปอง`,
      `คุณต้องการ${action}คูปองนี้หรือไม่?`,
      newStatus ? 'เปิดใช้งาน' : 'ปิดใช้งาน'
    );
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/admin/coupons/${couponId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: newStatus })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showNotification(data.message, 'success');
        await this.loadCoupons(); // รีโหลดตาราง
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('❌ Error toggling coupon status:', error);
      this.showNotification('ไม่สามารถเปลี่ยนสถานะคูปองได้', 'error');
    }
  }

  async deleteCoupon(couponId, couponCode) {
    console.log('🗑️ Deleting coupon:', couponId, couponCode);
    
    // แสดง confirmation
    const confirmed = await this.showConfirm(
      'ยืนยันการลบคูปอง',
      `คุณต้องการลบคูปอง "<strong>${couponCode}</strong>" หรือไม่?<br><br>
      <span class="text-red-600 text-sm">⚠️ การดำเนินการนี้ไม่สามารถยกเลิกได้</span>`,
      'ลบคูปอง',
      'destructive'
    );
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/admin/coupons/${couponId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showNotification(data.message, 'success');
        await this.loadCoupons(); // รีโหลดตาราง
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('❌ Error deleting coupon:', error);
      this.showNotification('ไม่สามารถลบคูปองได้: ' + error.message, 'error');
    }
  }

  showCouponDetails(coupon) {
    console.log('📋 Showing coupon details:', coupon);
    
    const modal = document.getElementById('coupon-details-modal');
    if (!modal) {
      // สร้าง modal ใหม่ถ้าไม่มี
      this.createDetailsModal();
    }
    
    // Format ข้อมูล
    const discountText = coupon.discount_type === 'percentage' 
      ? `${coupon.discount_value}% ส่วนลด`
      : `ส่วนลด ${Number(coupon.discount_value).toLocaleString('th-TH')} บาท`;
      
    const now = new Date();
    const isActive = coupon.is_active;
    const isExpired = new Date(coupon.end_date) < now;
    const isNotStarted = new Date(coupon.start_date) > now;
    
    let statusBadge, statusText;
    if (!isActive) {
      statusBadge = 'bg-gray-100 text-gray-800';
      statusText = 'ปิดใช้งาน';
    } else if (isExpired) {
      statusBadge = 'bg-red-100 text-red-800';
      statusText = 'หมดอายุ';
    } else if (isNotStarted) {
      statusBadge = 'bg-yellow-100 text-yellow-800';
      statusText = 'ยังไม่เริ่มใช้งาน';
    } else {
      statusBadge = 'bg-green-100 text-green-800';
      statusText = 'ใช้งานได้';
    }

    // เติมข้อมูลในรายละเอียด
    const detailsContent = `
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">รหัสคูปอง</label>
          <div class="text-lg font-semibold text-gray-900">${this.escapeHtml(coupon.code)}</div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge}">
            ${statusText}
          </span>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">ชื่อคูปอง</label>
          <div class="text-gray-900">${this.escapeHtml(coupon.name)}</div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">ประเภทส่วนลด</label>
          <div class="text-gray-900">${discountText}</div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">ยอดขั้นต่ำ</label>
          <div class="text-gray-900">
            ${coupon.min_order_amount ? Number(coupon.min_order_amount).toLocaleString('th-TH') + ' บาท' : 'ไม่กำหนด'}
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">ส่วนลดสูงสุด</label>
          <div class="text-gray-900">
            ${coupon.max_discount_amount ? Number(coupon.max_discount_amount).toLocaleString('th-TH') + ' บาท' : 'ไม่กำหนด'}
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">จำกัดการใช้งาน</label>
          <div class="text-gray-900">
            ${coupon.usage_limit ? coupon.usage_limit.toLocaleString('th-TH') + ' ครั้ง' : 'ไม่จำกัด'}
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">ใช้งานแล้ว</label>
          <div class="text-gray-900">${(coupon.usage_count || 0).toLocaleString('th-TH')} ครั้ง</div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">วันที่เริ่มใช้งาน</label>
          <div class="text-gray-900">${new Date(coupon.start_date).toLocaleDateString('th-TH')}</div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">วันที่หมดอายุ</label>
          <div class="text-gray-900">${new Date(coupon.end_date).toLocaleDateString('th-TH')}</div>
        </div>
      </div>
      
      ${coupon.description ? `
        <div class="mt-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
          <div class="text-gray-900 bg-gray-50 p-3 rounded-md">${this.escapeHtml(coupon.description)}</div>
        </div>
      ` : ''}
    `;
    
    // แสดงใน modal
    const detailsBody = document.getElementById('coupon-details-body');
    if (detailsBody) {
      detailsBody.innerHTML = detailsContent;
    }
    
    const detailsModal = document.getElementById('coupon-details-modal');
    if (detailsModal) {
      detailsModal.classList.remove('hidden');
    }
}

  createDetailsModal() {
    const modalHTML = `
      <!-- Coupon Details Modal -->
      <div id="coupon-details-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900">รายละเอียดคูปอง</h3>
            <button onclick="document.getElementById('coupon-details-modal').classList.add('hidden')" 
                    class="text-gray-400 hover:text-gray-600">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          
          <div id="coupon-details-body" class="mb-6">
            <!-- Content will be filled by showCouponDetails -->
          </div>
          
          <div class="flex justify-end">
            <button onclick="document.getElementById('coupon-details-modal').classList.add('hidden')" 
                    class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
              ปิด
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  async showConfirm(title, message, confirmText = 'ยืนยัน', type = 'default') {
    return new Promise((resolve) => {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: title,
          html: message,
          icon: type === 'destructive' ? 'warning' : 'question',
          showCancelButton: true,
          confirmButtonColor: type === 'destructive' ? '#dc2626' : '#3b82f6',
          cancelButtonColor: '#6b7280',
          confirmButtonText: confirmText,
          cancelButtonText: 'ยกเลิก'
        }).then((result) => {
          resolve(result.isConfirmed);
        });
      } else {
        const confirmed = confirm(`${title}\n\n${message.replace(/<[^>]*>/g, '')}`);
        resolve(confirmed);
      }
    });
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 🎯 Export CouponsManager to global window
window.CouponsManager = CouponsManager;

// ✅ สร้าง global instance
window.couponsManager = null;

// สำหรับการเรียกใช้จากระบบเมนู
window.showCouponsPage = async function() {
  console.log('🎫 Loading coupons page...');
  
  try {
    // ✅ สร้าง instance และเก็บไว้ใน global scope
    if (!window.couponsManager) {
      window.couponsManager = new CouponsManager();
    }
    await window.couponsManager.initialize();
    
    console.log('✅ CouponsManager instance available globally:', !!window.couponsManager);
    
  } catch (error) {
    console.error('❌ Error showing coupons page:', error);
    if (typeof Swal !== 'undefined') {
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดหน้าจัดการคูปองได้', 'error');
    } else {
      alert('เกิดข้อผิดพลาด: ไม่สามารถโหลดหน้าจัดการคูปองได้');
    }
  }
};

// ✅ Export methods to global scope สำหรับ onclick handlers
window.closeCouponModal = function() {
  if (window.couponsManager) {
    window.couponsManager.closeCouponModal();
  } else {
    console.error('❌ CouponsManager instance not found');
    // Fallback - ปิด modal โดยตรง
    const modal = document.getElementById('coupon-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }
};

window.openCouponModal = function(couponData = null) {
  if (window.couponsManager) {
    window.couponsManager.openCouponModal(couponData);
  } else {
    console.error('❌ CouponsManager instance not found');
  }
};

window.viewCoupon = function(couponId) {
  if (window.couponsManager) {
    window.couponsManager.viewCoupon(couponId);
  } else {
    console.error('❌ CouponsManager instance not found');
  }
};

window.editCoupon = function(couponId) {
  if (window.couponsManager) {
    window.couponsManager.editCoupon(couponId);
  } else {
    console.error('❌ CouponsManager instance not found');
  }
};

window.toggleCouponStatus = function(couponId, newStatus) {
  if (window.couponsManager) {
    window.couponsManager.toggleCouponStatus(couponId, newStatus);
  } else {
    console.error('❌ CouponsManager instance not found');
  }
};

window.deleteCoupon = function(couponId, couponCode) {
  if (window.couponsManager) {
    window.couponsManager.deleteCoupon(couponId, couponCode);
  } else {
    console.error('❌ CouponsManager instance not found');
  }
};

window.toggleDiscountType = function() {
  if (window.couponsManager) {
    window.couponsManager.toggleDiscountType();
  } else {
    console.error('❌ CouponsManager instance not found');
  }
};

// Auto-initialize หากมี element ที่ต้องการ
document.addEventListener('DOMContentLoaded', function() {
  console.log('🎫 Coupons manager script loaded');
  console.log('CouponsManager available:', !!window.CouponsManager);
  console.log('Global functions exported:', {
    closeCouponModal: !!window.closeCouponModal,
    openCouponModal: !!window.openCouponModal,
    viewCoupon: !!window.viewCoupon,
    editCoupon: !!window.editCoupon,
    toggleCouponStatus: !!window.toggleCouponStatus,
    deleteCoupon: !!window.deleteCoupon
  });
});

// สำหรับ debugging
window.testCouponsManager = function() {
  console.log('🧪 Testing CouponsManager...');
  console.log('CouponsManager class:', window.CouponsManager);
  console.log('Current instance:', window.couponsManager);
  console.log('Is constructor?', typeof window.CouponsManager === 'function');
  
  if (window.CouponsManager) {
    try {
      const testInstance = new window.CouponsManager();
      console.log('✅ CouponsManager instance created successfully');
      return true;
    } catch (error) {
      console.error('❌ Error creating CouponsManager instance:', error);
      return false;
    }
  } else {
    console.error('❌ CouponsManager class not found');
    return false;
  }
};

// Enhanced debug function
window.debugCouponsManager = function() {
  console.log('🔍 === COUPONS MANAGER DEBUG ===');
  console.log('CouponsManager Class:', window.CouponsManager);
  console.log('Current Instance:', window.couponsManager);
  console.log('showCouponsPage:', window.showCouponsPage);
  
  // ทดสอบ global functions
  console.log('Global Functions:');
  [
    'closeCouponModal',
    'openCouponModal', 
    'viewCoupon',
    'editCoupon',
    'toggleCouponStatus',
    'deleteCoupon'
  ].forEach(func => {
    console.log(`  ${func}:`, typeof window[func] === 'function' ? '✅ Available' : '❌ Missing');
  });
  
  // ทดสอบ DOM elements
  const elements = [
    'btn-create-coupon',
    'btn-refresh-coupons',
    'coupon-search',
    'filter-status',
    'filter-type',
    'coupon-modal',
    'coupon-form'
  ];
  
  console.log('DOM Elements:');
  elements.forEach(id => {
    const element = document.getElementById(id);
    console.log(`  ${id}:`, element ? '✅ Found' : '❌ Not Found');
  });
  
  // ทดสอบ API
  console.log('Testing API...');
  fetch('/api/admin/coupons/stats')
    .then(r => r.json())
    .then(data => console.log('API Test Result:', data))
    .catch(err => console.error('API Test Error:', err));
};

// Auto debug เมื่อโหลดหน้า
setTimeout(() => {
  if (window.location.pathname.includes('coupons') || window.location.hash.includes('coupons')) {
    window.debugCouponsManager();
  }
}, 2000);

console.log('✅ Coupons Manager script loaded with global functions');