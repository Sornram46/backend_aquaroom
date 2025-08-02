// สร้างไฟล์ใหม่: aquaroom-admin/public/admin/js/alerts-manager.js

class AlertsManager {
  constructor() {
    this.alerts = [];
    this.unreadCount = 0;
    this.isInitialized = false; // เพิ่มตัวแปรนี้
  }

  async initialize() {
    // ป้องกันการ initialize ซ้ำ
    if (this.isInitialized) {
      console.log('⚠️ AlertsManager already initialized');
      return;
    }
    
    console.log('🚨 Initializing Alerts Manager...');
    
    try {
      this.renderAlertsLayout();
      await this.loadAlerts();
      this.startAutoRefresh();
      this.isInitialized = true;
      console.log('✅ Alerts Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Alerts Manager:', error);
      this.showError('ไม่สามารถโหลดระบบแจ้งเตือนได้');
    }
  }

  // เพิ่ม method สำหรับ header notification
  async getUnreadCount() {
    try {
      const response = await fetch('/api/admin/inventory/alerts/summary');
      const data = await response.json();
      
      if (data.success) {
        this.unreadCount = data.data.summary.unread_alerts || 0;
        return this.unreadCount;
      }
      
      return 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // เพิ่ม method สำหรับอัปเดต summary จาก header
  updateSummaryFromHeader(summary) {
    if (this.isInitialized) {
      this.updateSummary(summary);
    }
  }

  // เพิ่ม method สำหรับ refresh จาก header
  async refreshFromHeader() {
    if (this.isInitialized) {
      await this.loadAlerts();
    }
  }

  renderAlertsLayout() {
    const mainContent = document.getElementById('main-content');
    
    mainContent.innerHTML = `
      <div class="alerts-dashboard">
        <!-- Header -->
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">🚨 แจ้งเตือนสต็อกสินค้า</h1>
            <p class="text-gray-600">จัดการแจ้งเตือนและติดตามสถานะสินค้า</p>
          </div>
          
          <div class="flex items-center space-x-3 mt-4 lg:mt-0">
            <button id="generate-alerts-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <i data-lucide="refresh-cw" class="w-4 h-4 inline mr-2"></i>
              สร้างแจ้งเตือน
            </button>
            <button id="mark-all-read-btn" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
              <i data-lucide="check-square" class="w-4 h-4 inline mr-2"></i>
              อ่านทั้งหมด
            </button>
          </div>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center">
              <div class="p-3 rounded-full bg-red-100 mr-4">
                <i data-lucide="alert-circle" class="w-6 h-6 text-red-600"></i>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-500">แจ้งเตือนทั้งหมด</p>
                <p class="text-2xl font-bold text-gray-900" id="total-alerts">-</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center">
              <div class="p-3 rounded-full bg-yellow-100 mr-4">
                <i data-lucide="bell" class="w-6 h-6 text-yellow-600"></i>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-500">ยังไม่ได้อ่าน</p>
                <p class="text-2xl font-bold text-gray-900" id="unread-alerts">-</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center">
              <div class="p-3 rounded-full bg-red-100 mr-4">
                <i data-lucide="x-circle" class="w-6 h-6 text-red-600"></i>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-500">วิกฤต</p>
                <p class="text-2xl font-bold text-gray-900" id="critical-alerts">-</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center">
              <div class="p-3 rounded-full bg-orange-100 mr-4">
                <i data-lucide="alert-triangle" class="w-6 h-6 text-orange-600"></i>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-500">เตือน</p>
                <p class="text-2xl font-bold text-gray-900" id="warning-alerts">-</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Filters -->
        <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex items-center space-x-2">
              <label class="text-sm font-medium text-gray-700">ประเภท:</label>
              <select id="alert-type-filter" class="border border-gray-300 rounded-md px-3 py-1 text-sm">
                <option value="">ทั้งหมด</option>
                <option value="low_stock">สต็อกต่ำ</option>
                <option value="out_of_stock">สินค้าหมด</option>
                <option value="reorder">ควรสั่งซื้อใหม่</option>
              </select>
            </div>
            
            <div class="flex items-center space-x-2">
              <label class="text-sm font-medium text-gray-700">สถานะ:</label>
              <select id="read-status-filter" class="border border-gray-300 rounded-md px-3 py-1 text-sm">
                <option value="">ทั้งหมด</option>
                <option value="false">ยังไม่ได้อ่าน</option>
                <option value="true">อ่านแล้ว</option>
              </select>
            </div>
            
            <button id="apply-filters-btn" class="px-4 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm">
              <i data-lucide="filter" class="w-4 h-4 inline mr-1"></i>
              กรอง
            </button>
          </div>
        </div>

        <!-- Alerts List -->
        <div class="bg-white rounded-lg shadow-sm">
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">รายการแจ้งเตือน</h3>
            <div id="alerts-list" class="space-y-3">
              <div class="text-center py-8 text-gray-500">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                กำลังโหลดแจ้งเตือน...
              </div>
            </div>
          </div>
          
          <!-- Pagination -->
          <div id="alerts-pagination" class="px-6 py-4 border-t border-gray-200">
            <!-- จะแสดงเมื่อมีข้อมูล -->
          </div>
        </div>
      </div>
    `;

    // Event Listeners
    document.getElementById('generate-alerts-btn').addEventListener('click', () => this.generateAlerts());
    document.getElementById('mark-all-read-btn').addEventListener('click', () => this.markAllAsRead());
    document.getElementById('apply-filters-btn').addEventListener('click', () => this.loadAlerts());
    
    // Initialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  async loadAlerts(page = 1) {
    try {
      const alertType = document.getElementById('alert-type-filter')?.value || '';
      const isRead = document.getElementById('read-status-filter')?.value || '';
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      
      if (alertType) params.append('alert_type', alertType);
      if (isRead) params.append('is_read', isRead);
      
      // โหลดข้อมูลแจ้งเตือนและสรุป
      const [alertsResponse, summaryResponse] = await Promise.all([
        fetch(`/api/admin/inventory/alerts?${params}`),
        fetch('/api/admin/inventory/alerts/summary')
      ]);
      
      const alertsData = await alertsResponse.json();
      const summaryData = await summaryResponse.json();
      
      if (alertsData.success) {
        this.alerts = alertsData.data;
        this.renderAlerts();
        this.renderPagination(alertsData.pagination);
      }
      
      if (summaryData.success) {
        this.updateSummary(summaryData.data.summary);
      }
      
    } catch (error) {
      console.error('❌ Error loading alerts:', error);
      this.showError('ไม่สามารถโหลดแจ้งเตือนได้');
    }
  }

  renderAlerts() {
    const container = document.getElementById('alerts-list');
    
    if (!this.alerts || this.alerts.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <i data-lucide="bell-off" class="w-12 h-12 mx-auto mb-4 text-gray-400"></i>
          <p>ไม่มีแจ้งเตือน</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    container.innerHTML = this.alerts.map(alert => `
      <div class="alert-item flex items-start p-4 rounded-lg border ${alert.is_read ? 'bg-gray-50 border-gray-200' : 'bg-yellow-50 border-yellow-200'} ${!alert.is_read ? 'border-l-4 border-l-yellow-500' : ''}">
        
        <!-- Alert Icon -->
        <div class="flex-shrink-0 mr-4">
          <div class="p-2 rounded-full ${this.getAlertColorClass(alert.alert_level)}">
            <i data-lucide="${this.getAlertIcon(alert.alert_type)}" class="w-5 h-5"></i>
          </div>
        </div>
        
        <!-- Alert Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h4 class="text-sm font-semibold text-gray-900 ${!alert.is_read ? 'font-bold' : ''}">
                ${alert.title}
                ${!alert.is_read ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 ml-2">ใหม่</span>' : ''}
              </h4>
              
              <p class="text-sm text-gray-600 mt-1">${alert.message}</p>
              
              <div class="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                <span>สินค้า: ${alert.product?.name || 'ไม่ระบุ'}</span>
                <span>สต็อกปัจจุบัน: ${alert.current_stock || 0} ชิ้น</span>
                <span>${this.formatDate(alert.created_at)}</span>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex items-center space-x-2 ml-4">
              ${!alert.is_read ? `
                <button onclick="alertsManager.markAsRead(${alert.id})" 
                        class="text-indigo-600 hover:text-indigo-800 text-sm">
                  <i data-lucide="check" class="w-4 h-4"></i>
                </button>
              ` : ''}
              
              <button onclick="alertsManager.viewProduct(${alert.product_id})" 
                      class="text-blue-600 hover:text-blue-800 text-sm">
                <i data-lucide="eye" class="w-4 h-4"></i>
              </button>
              
              <button onclick="alertsManager.adjustStock(${alert.product_id})" 
                      class="text-green-600 hover:text-green-800 text-sm">
                <i data-lucide="edit" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    lucide.createIcons();
  }

  updateSummary(summary) {
    document.getElementById('total-alerts').textContent = summary.total_alerts || 0;
    document.getElementById('unread-alerts').textContent = summary.unread_alerts || 0;
    document.getElementById('critical-alerts').textContent = summary.critical_alerts || 0;
    document.getElementById('warning-alerts').textContent = summary.warning_alerts || 0;
    
    this.unreadCount = summary.unread_alerts || 0;
    
    // อัพเดท badge ในเมนู (ถ้ามี)
    this.updateMenuBadge();
  }

  async markAsRead(alertId) {
    try {
      const response = await fetch(`/api/admin/inventory/alerts/${alertId}/read`, {
        method: 'PUT'
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.loadAlerts(); // รีโหลดข้อมูล
        this.showSuccess('อ่านแจ้งเตือนแล้ว');
      } else {
        throw new Error(data.message);
      }
      
    } catch (error) {
      console.error('Error marking alert as read:', error);
      this.showError('ไม่สามารถอัพเดทแจ้งเตือนได้');
    }
  }

  async markAllAsRead() {
    try {
      const unreadAlerts = this.alerts.filter(alert => !alert.is_read);
      
      if (unreadAlerts.length === 0) {
        this.showInfo('ไม่มีแจ้งเตือนที่ยังไม่ได้อ่าน');
        return;
      }
      
      const confirmed = await Swal.fire({
        title: 'ยืนยันการทำงาน',
        text: `อ่านแจ้งเตือน ${unreadAlerts.length} รายการทั้งหมด?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก'
      });
      
      if (!confirmed.isConfirmed) return;
      
      const response = await fetch('/api/admin/inventory/alerts/bulk-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertIds: unreadAlerts.map(alert => alert.id)
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.loadAlerts();
        this.showSuccess(`อ่านแจ้งเตือน ${data.data.updated_count} รายการแล้ว`);
      } else {
        throw new Error(data.message);
      }
      
    } catch (error) {
      console.error('Error marking all alerts as read:', error);
      this.showError('ไม่สามารถอัพเดทแจ้งเตือนได้');
    }
  }

  async generateAlerts() {
    try {
      const confirmed = await Swal.fire({
        title: 'สร้างแจ้งเตือนใหม่',
        text: 'ระบบจะตรวจสอบสินค้าทั้งหมดและสร้างแจ้งเตือนที่จำเป็น',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'สร้าง',
        cancelButtonText: 'ยกเลิก'
      });
      
      if (!confirmed.isConfirmed) return;
      
      // แสดงสถานะโหลด
      Swal.fire({
        title: 'กำลังสร้างแจ้งเตือน...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
      
      const response = await fetch('/api/admin/inventory/alerts/generate', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.loadAlerts();
        Swal.fire({
          title: 'สำเร็จ!',
          text: data.message,
          icon: 'success',
          timer: 3000
        });
      } else {
        throw new Error(data.message);
      }
      
    } catch (error) {
      console.error('Error generating alerts:', error);
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถสร้างแจ้งเตือนได้', 'error');
    }
  }

  // ฟังก์ชันเสริม
  getAlertIcon(alertType) {
    const icons = {
      'low_stock': 'alert-triangle',
      'out_of_stock': 'x-circle',
      'reorder': 'shopping-cart',
      'expired': 'clock'
    };
    return icons[alertType] || 'bell';
  }

  getAlertColorClass(alertLevel) {
    const colors = {
      'critical': 'bg-red-100 text-red-600',
      'warning': 'bg-yellow-100 text-yellow-600',
      'info': 'bg-blue-100 text-blue-600'
    };
    return colors[alertLevel] || 'bg-gray-100 text-gray-600';
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  updateMenuBadge() {
    // อัพเดท badge แจ้งเตือนในเมนู
    const badge = document.querySelector('#alerts-badge');
    if (badge) {
      if (this.unreadCount > 0) {
        badge.textContent = this.unreadCount;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  startAutoRefresh() {
    // รีเฟรชแจ้งเตือนทุก 2 นาที
    setInterval(() => {
      this.loadAlerts();
    }, 2 * 60 * 1000);
  }

  // ฟังก์ชันสำหรับ Actions
  async viewProduct(productId) {
    // เปิดหน้าดูรายละเอียดสินค้า
    window.location.hash = `#products?id=${productId}`;
  }

  async adjustStock(productId) {
    // เปิดฟอร์มปรับสต็อก
    // TODO: เพิ่ม modal สำหรับปรับสต็อก
    const { value: adjustment } = await Swal.fire({
      title: 'ปรับสต็อกสินค้า',
      html: `
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
            <select id="adj-type" class="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="increase">เพิ่ม</option>
              <option value="decrease">ลด</option>
              <option value="set">กำหนดค่า</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">จำนวน</label>
            <input type="number" id="adj-quantity" class="w-full border border-gray-300 rounded-md px-3 py-2" min="0">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">เหตุผล</label>
            <input type="text" id="adj-reason" class="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="เช่น เติมสต็อกใหม่">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'ปรับสต็อก',
      cancelButtonText: 'ยกเลิก',
      preConfirm: () => {
        const type = document.getElementById('adj-type').value;
        const quantity = document.getElementById('adj-quantity').value;
        const reason = document.getElementById('adj-reason').value;
        
        if (!quantity) {
          Swal.showValidationMessage('กรุณาระบุจำนวน');
          return false;
        }
        
        return { type, quantity: parseInt(quantity), reason };
      }
    });
    
    if (adjustment) {
      try {
        const response = await fetch(`/api/admin/inventory/products/${productId}/adjust`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adjustment_type: adjustment.type,
            quantity: adjustment.quantity,
            reason: adjustment.reason || 'ปรับจากแจ้งเตือน'
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          this.loadAlerts(); // รีโหลดแจ้งเตือน
          this.showSuccess('ปรับสต็อกเรียบร้อยแล้ว');
        } else {
          throw new Error(data.message);
        }
        
      } catch (error) {
        console.error('Error adjusting stock:', error);
        this.showError('ไม่สามารถปรับสต็อกได้');
      }
    }
  }

  renderPagination(pagination) {
    const container = document.getElementById('alerts-pagination');
    
    if (!pagination || pagination.total_pages <= 1) {
      container.innerHTML = '';
      return;
    }
    
    const buttons = [];
    
    // Previous button
    if (pagination.has_prev) {
      buttons.push(`
        <button onclick="alertsManager.loadAlerts(${pagination.current_page - 1})" 
                class="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
          ← ก่อนหน้า
        </button>
      `);
    }
    
    // Page numbers (แสดง 5 หน้า)
    const startPage = Math.max(1, pagination.current_page - 2);
    const endPage = Math.min(pagination.total_pages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(`
        <button onclick="alertsManager.loadAlerts(${i})" 
                class="px-3 py-2 text-sm ${i === pagination.current_page ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'}">
          ${i}
        </button>
      `);
    }
    
    // Next button
    if (pagination.has_next) {
      buttons.push(`
        <button onclick="alertsManager.loadAlerts(${pagination.current_page + 1})" 
                class="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
          ถัดไป →
        </button>
      `);
    }
    
    container.innerHTML = `
      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-700">
          แสดง ${((pagination.current_page - 1) * pagination.limit) + 1} - ${Math.min(pagination.current_page * pagination.limit, pagination.total_count)} 
          จาก ${pagination.total_count} รายการ
        </p>
        <div class="flex space-x-1">
          ${buttons.join('')}
        </div>
      </div>
    `;
  }

  // ฟังก์ชันแสดงข้อความ
  showSuccess(message) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'สำเร็จ',
        text: message,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }
  }

  showError(message) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'เกิดข้อผิดพลาด',
        text: message,
        icon: 'error',
        confirmButtonText: 'ตกลง'
      });
    }
  }

  showInfo(message) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'ข้อมูล',
        text: message,
        icon: 'info',
        confirmButtonText: 'ตกลง'
      });
    }
  }
}

// Export to global scope
window.AlertsManager = AlertsManager;
console.log('✅ AlertsManager loaded successfully');