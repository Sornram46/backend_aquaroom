// สร้างไฟล์ใหม่: aquaroom-admin/public/admin/js/reports-manager.js

/**
 * Reports & Analytics Management System
 * ระบบรายงานและการวิเคราะห์ข้อมูล
 */

console.log('🔄 reports-manager.js starting to load...');

class ReportsManager {
  constructor() {
    console.log('🏗️ ReportsManager constructor called');
    this.dateRange = 7; // วันล่าสุด
    this.currentStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    this.currentEndDate = new Date();
    this.charts = {};
    console.log('✅ ReportsManager constructor completed');
  }

  async initialize() {
    console.log('🚀 ReportsManager initializing...');
    
    try {
      this.renderReportsLayout();
      await this.loadAllData();
      console.log('✅ ReportsManager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize ReportsManager:', error);
      this.showError('ไม่สามารถโหลดข้อมูลรายงานได้');
    }
  }

  renderReportsLayout() {
    console.log('🎨 Rendering reports layout...');
    
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
      throw new Error('main-content element not found');
    }

    mainContent.innerHTML = `
      <div class="reports-dashboard">
        <!-- Header with Date Range Selector -->
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">รายงานและสถิติ</h1>
            <p class="text-gray-600">ภาพรวมการดำเนินงานและการวิเคราะห์ข้อมูล</p>
          </div>
          
          <div class="flex items-center space-x-2 mt-4 lg:mt-0">
            <span class="text-sm text-gray-700 mr-2">ช่วงเวลา:</span>
            <button data-range="7" class="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white">7 วัน</button>
            <button data-range="30" class="px-3 py-2 text-sm rounded-md bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">30 วัน</button>
            <button data-range="90" class="px-3 py-2 text-sm rounded-md bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">3 เดือน</button>
            <button data-range="365" class="px-3 py-2 text-sm rounded-md bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">1 ปี</button>
          </div>
        </div>

        <!-- Loading State -->
        <div id="reports-loading" class="hidden">
          <div class="bg-white rounded-lg shadow-sm p-8 text-center">
            <div class="inline-flex items-center">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-3"></div>
              <span class="text-gray-600">กำลังโหลดข้อมูลรายงาน...</span>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div id="reports-content">
          <!-- Overview Stats -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <!-- Total Orders -->
            <div class="bg-white rounded-lg shadow-sm p-6">
              <div class="flex items-center">
                <div class="p-3 rounded-full bg-blue-100 mr-4">
                  <i data-lucide="shopping-cart" class="w-6 h-6 text-blue-600"></i>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-500">คำสั่งซื้อทั้งหมด</p>
                  <p class="text-2xl font-bold text-gray-900" id="total-orders">-</p>
                  <p class="text-sm" id="orders-growth">-</p>
                </div>
              </div>
            </div>

            <!-- Total Revenue -->
            <div class="bg-white rounded-lg shadow-sm p-6">
              <div class="flex items-center">
                <div class="p-3 rounded-full bg-green-100 mr-4">
                  <i data-lucide="dollar-sign" class="w-6 h-6 text-green-600"></i>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-500">รายได้รวม</p>
                  <p class="text-2xl font-bold text-gray-900" id="total-revenue">-</p>
                  <p class="text-sm" id="revenue-growth">-</p>
                </div>
              </div>
            </div>

            <!-- Total Customers -->
            <div class="bg-white rounded-lg shadow-sm p-6">
              <div class="flex items-center">
                <div class="p-3 rounded-full bg-purple-100 mr-4">
                  <i data-lucide="users" class="w-6 h-6 text-purple-600"></i>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-500">ลูกค้าทั้งหมด</p>
                  <p class="text-2xl font-bold text-gray-900" id="total-customers">-</p>
                </div>
              </div>
            </div>

            <!-- Total Products -->
            <div class="bg-white rounded-lg shadow-sm p-6">
              <div class="flex items-center">
                <div class="p-3 rounded-full bg-orange-100 mr-4">
                  <i data-lucide="package" class="w-6 h-6 text-orange-600"></i>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-500">สินค้าทั้งหมด</p>
                  <p class="text-2xl font-bold text-gray-900" id="total-products">-</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Sales Chart -->
          <div class="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">กราฟยอดขายรายวัน</h3>
            <div class="relative h-80">
              <canvas id="salesChart"></canvas>
            </div>
          </div>

          <!-- Top Products and Customer Stats -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- Top Products -->
            <div class="bg-white rounded-lg shadow-sm p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">สินค้าขายดี</h3>
              <div id="top-products-list" class="space-y-3">
                <div class="text-center text-gray-500 py-4">กำลังโหลดข้อมูล...</div>
              </div>
            </div>

            <!-- Customer Stats -->
            <div class="bg-white rounded-lg shadow-sm p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">สถิติลูกค้า</h3>
              <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="text-center">
                  <div class="text-2xl font-bold text-blue-600" id="new-customers">-</div>
                  <div class="text-sm text-gray-500">ลูกค้าใหม่</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-green-600" id="returning-customers">-</div>
                  <div class="text-sm text-gray-500">ลูกค้าซื้อซ้ำ</div>
                </div>
              </div>
              <div id="top-customers-list" class="space-y-3">
                <div class="text-center text-gray-500 py-4">กำลังโหลดข้อมูล...</div>
              </div>
            </div>
          </div>

          <!-- Inventory Report -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">รายงานสต็อกสินค้า</h3>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Low Stock Products -->
              <div>
                <div class="flex items-center justify-between mb-3">
                  <h4 class="font-medium text-gray-900">สินค้าใกล้หมด</h4>
                  <span class="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded-full" id="low-stock-count">0</span>
                </div>
                <div id="low-stock-products" class="space-y-2 max-h-48 overflow-y-auto">
                  <div class="text-center text-gray-500 py-4">กำลังโหลดข้อมูล...</div>
                </div>
              </div>

              <!-- Out of Stock Products -->
              <div>
                <div class="flex items-center justify-between mb-3">
                  <h4 class="font-medium text-gray-900">สินค้าหมด</h4>
                  <span class="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded-full" id="out-of-stock-count">0</span>
                </div>
                <div id="out-of-stock-products" class="space-y-2 max-h-48 overflow-y-auto">
                  <div class="text-center text-gray-500 py-4">กำลังโหลดข้อมูล...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // เพิ่ม Event Listeners สำหรับ Date Range Buttons
    document.querySelectorAll('[data-range]').forEach(button => {
      button.addEventListener('click', (e) => {
        const days = parseInt(e.target.dataset.range);
        this.changeDateRange(days);
      });
    });

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
      console.log('✅ Lucide icons initialized');
    }

    console.log('✅ Reports layout rendered successfully');
  }

  async loadAllData() {
    console.log('📊 Loading all analytics data...');
    this.showLoading();
    
    try {
      // โหลดข้อมูลทั้งหมดพร้อมกัน
      const [
        overview,
        salesChart,
        topProducts,
        customersStats,
        inventoryReport
      ] = await Promise.all([
        this.fetchAPI('/api/admin/analytics/overview'),
        this.fetchAPI('/api/admin/analytics/sales-chart'),
        this.fetchAPI('/api/admin/analytics/top-products'),
        this.fetchAPI('/api/admin/analytics/customers-stats'),
        this.fetchAPI('/api/admin/analytics/inventory-report')
      ]);

      // อัพเดท UI
      this.updateOverview(overview);
      this.updateSalesChart(salesChart);
      this.updateTopProducts(topProducts);
      this.updateCustomersStats(customersStats);
      this.updateInventoryReport(inventoryReport);
      
      console.log('✅ All analytics data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading analytics data:', error);
      this.showError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      this.hideLoading();
    }
  }

  async fetchAPI(url) {
    const params = new URLSearchParams({
      startDate: this.currentStartDate.toISOString(),
      endDate: this.currentEndDate.toISOString()
    });
    
    console.log(`🔗 Fetching: ${url}?${params}`);
    
    const response = await fetch(`${url}?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'API Error');
    }
    
    return result.data;
  }

  updateOverview(data) {
    console.log('📈 Updating overview data:', data);
    
    const elements = {
      'total-orders': data.totalOrders,
      'total-revenue': this.formatCurrency(data.totalRevenue),
      'total-customers': data.totalCustomers,
      'total-products': data.totalProducts
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });
    
    // อัพเดท growth indicators
    const ordersGrowth = document.getElementById('orders-growth');
    const revenueGrowth = document.getElementById('revenue-growth');
    
    if (ordersGrowth && data.growth) {
      ordersGrowth.textContent = `${data.growth.orders > 0 ? '+' : ''}${data.growth.orders.toFixed(1)}%`;
      ordersGrowth.className = `text-sm ${data.growth.orders >= 0 ? 'text-green-600' : 'text-red-600'}`;
    }
    
    if (revenueGrowth && data.growth) {
      revenueGrowth.textContent = `${data.growth.revenue > 0 ? '+' : ''}${data.growth.revenue.toFixed(1)}%`;
      revenueGrowth.className = `text-sm ${data.growth.revenue >= 0 ? 'text-green-600' : 'text-red-600'}`;
    }
  }

  updateSalesChart(data) {
    console.log('📊 Updating sales chart:', data);
    
    const ctx = document.getElementById('salesChart');
    if (!ctx) {
      console.warn('Sales chart canvas not found');
      return;
    }

    // ทำลายกราฟเก่า
    if (this.charts.sales) {
      this.charts.sales.destroy();
    }

    // สร้างกราฟใหม่
    this.charts.sales = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(item => this.formatDate(item.date)),
        datasets: [{
          label: 'ยอดขาย (บาท)',
          data: data.map(item => item.total_sales),
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '฿' + value.toLocaleString();
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'ยอดขาย: ฿' + context.parsed.y.toLocaleString();
              }
            }
          }
        }
      }
    });
  }

  updateTopProducts(data) {
    console.log('🏆 Updating top products:', data);
    
    const container = document.getElementById('top-products-list');
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="text-center text-gray-500 py-4">ไม่มีข้อมูลสินค้าขายดี</div>';
      return;
    }

    container.innerHTML = data.map((product, index) => `
      <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div class="flex items-center">
          <div class="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
            <span class="text-indigo-600 font-semibold text-sm">${index + 1}</span>
          </div>
          <div>
            <h4 class="font-medium text-gray-900">${product.name}</h4>
            <p class="text-sm text-gray-500">ขายแล้ว ${product.total_quantity} ชิ้น</p>
          </div>
        </div>
        <div class="text-right">
          <p class="font-semibold text-gray-900">${this.formatCurrency(product.total_revenue)}</p>
          <p class="text-sm text-gray-500">${product.order_count} คำสั่งซื้อ</p>
        </div>
      </div>
    `).join('');
  }

  updateCustomersStats(data) {
    console.log('👥 Updating customer stats:', data);
    
    document.getElementById('new-customers').textContent = this.formatNumber(data.newCustomers);
    document.getElementById('returning-customers').textContent = this.formatNumber(data.returningCustomers);
    
    const container = document.getElementById('top-customers-list');
    if (!container) return;

    if (!data.topCustomers || data.topCustomers.length === 0) {
      container.innerHTML = '<div class="text-center text-gray-500 py-4">ไม่มีข้อมูลลูกค้า</div>';
      return;
    }

    container.innerHTML = data.topCustomers.map((customer, index) => `
      <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div class="flex items-center">
          <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
            <span class="text-green-600 font-semibold text-sm">${index + 1}</span>
          </div>
          <div>
            <h4 class="font-medium text-gray-900">${customer.name || 'ไม่ระบุชื่อ'}</h4>
            <p class="text-sm text-gray-500">${customer.email}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="font-semibold text-gray-900">${this.formatCurrency(customer.total_spent)}</p>
          <p class="text-sm text-gray-500">${customer.total_orders} คำสั่งซื้อ</p>
        </div>
      </div>
    `).join('');
  }

  updateInventoryReport(data) {
    console.log('📦 Updating inventory report:', data);
    
    document.getElementById('low-stock-count').textContent = data.lowStockCount;
    document.getElementById('out-of-stock-count').textContent = data.outOfStockCount;
    
    const lowStockContainer = document.getElementById('low-stock-products');
    const outOfStockContainer = document.getElementById('out-of-stock-products');
    
    if (lowStockContainer) {
      if (!data.lowStockProducts || data.lowStockProducts.length === 0) {
        lowStockContainer.innerHTML = '<div class="text-center text-gray-500 py-4">ไม่มีสินค้าใกล้หมด</div>';
      } else {
        lowStockContainer.innerHTML = data.lowStockProducts.map(product => `
          <div class="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
            <div>
              <h4 class="font-medium text-gray-900">${product.name}</h4>
              <p class="text-sm text-gray-500">เหลือ ${product.stock_quantity} ชิ้น</p>
            </div>
            <div class="text-right">
              <p class="font-semibold text-gray-900">${this.formatCurrency(product.price)}</p>
            </div>
          </div>
        `).join('');
      }
    }
    
    if (outOfStockContainer) {
      if (!data.outOfStockProducts || data.outOfStockProducts.length === 0) {
        outOfStockContainer.innerHTML = '<div class="text-center text-gray-500 py-4">ไม่มีสินค้าหมด</div>';
      } else {
        outOfStockContainer.innerHTML = data.outOfStockProducts.map(product => `
          <div class="flex items-center justify-between p-3 bg-red-50 rounded-lg">
            <div>
              <h4 class="font-medium text-gray-900">${product.name}</h4>
              <p class="text-sm text-red-600">สินค้าหมด</p>
            </div>
            <div class="text-right">
              <p class="font-semibold text-gray-900">${this.formatCurrency(product.price)}</p>
            </div>
          </div>
        `).join('');
      }
    }
  }

  // ฟังก์ชันเปลี่ยนช่วงเวลา
  changeDateRange(days) {
    console.log(`📅 Changing date range to ${days} days`);
    
    this.dateRange = days;
    this.currentStartDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    this.currentEndDate = new Date();
    
    // อัพเดทปุ่ม active
    document.querySelectorAll('[data-range]').forEach(btn => {
      btn.classList.remove('bg-indigo-600', 'text-white');
      btn.classList.add('bg-white', 'text-gray-700', 'border', 'border-gray-300', 'hover:bg-gray-50');
    });
    
    const activeButton = document.querySelector(`[data-range="${days}"]`);
    if (activeButton) {
      activeButton.classList.remove('bg-white', 'text-gray-700', 'border', 'border-gray-300', 'hover:bg-gray-50');
      activeButton.classList.add('bg-indigo-600', 'text-white');
    }
    
    // โหลดข้อมูลใหม่
    this.loadAllData();
  }

  showLoading() {
    const loadingElement = document.getElementById('reports-loading');
    const contentElement = document.getElementById('reports-content');
    
    if (loadingElement) {
      loadingElement.classList.remove('hidden');
    }
    if (contentElement) {
      contentElement.classList.add('opacity-50');
    }
  }

  hideLoading() {
    const loadingElement = document.getElementById('reports-loading');
    const contentElement = document.getElementById('reports-content');
    
    if (loadingElement) {
      loadingElement.classList.add('hidden');
    }
    if (contentElement) {
      contentElement.classList.remove('opacity-50');
    }
  }

  showError(message) {
    console.error('Reports Error:', message);
    
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'เกิดข้อผิดพลาด',
        text: message,
        icon: 'error',
        confirmButtonText: 'ตกลง'
      });
    } else {
      alert(`เกิดข้อผิดพลาด: ${message}`);
    }
  }

  showSuccess(message) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'สำเร็จ',
        text: message,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      alert(`สำเร็จ: ${message}`);
    }
  }

  formatDate(dateString) {
    try {
      return new Date(dateString).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short'
      });
    } catch (error) {
      return dateString;
    }
  }

  formatNumber(number) {
    return new Intl.NumberFormat('th-TH').format(number || 0);
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(amount || 0);
  }
}

// Export class to global scope
console.log('📝 Assigning ReportsManager to window...');
window.ReportsManager = ReportsManager;

console.log('✅ reports-manager.js loaded successfully');
console.log('🔧 ReportsManager class:', window.ReportsManager);