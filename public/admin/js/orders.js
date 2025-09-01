class OrdersManager {
  constructor() {
    this.currentPage = 1;
    this.currentStatus = 'all';
    this.currentSearch = '';
    this.limit = 10;
  }

  async initialize() {
    this.renderOrdersLayout();
    await this.loadOrders();
  }

  async loadOrders() {
    try {
      const params = new URLSearchParams({
        page: this.currentPage.toString(),
        limit: this.limit.toString(),
        status: this.currentStatus
      });
      
      if (this.currentSearch) {
        params.append('search', this.currentSearch);
        console.log('Searching for:', this.currentSearch); // เพิ่ม debug
      }
      
      console.log('API URL:', `/api/admin/orders?${params}`); // เพิ่ม debug
      
      const response = await fetch(`/api/admin/orders?${params}`);
      const data = await response.json();
      
      console.log('API Response:', data); // เพิ่ม debug
      
      if (data.success) {
        this.renderOrdersTable(data.orders);
        this.renderPagination(data.pagination);
        this.updateStats(data.orders);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      this.showError('เกิดข้อผิดพลาดในการโหลดข้อมูลคำสั่งซื้อ');
    }
  }

  renderOrdersLayout() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">จัดการคำสั่งซื้อ</h1>
        <p class="text-sm text-gray-600">ดูและจัดการคำสั่งซื้อทั้งหมดในระบบ</p>
      </div>

      <!-- Stats Cards -->
      <div id="order-stats" class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <!-- Stats จะถูกแทรกที่นี่ -->
      </div>

      <!-- Filters -->
      <div class="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div class="flex flex-wrap gap-2">
          <button onclick="ordersManager.filterByStatus('all')" class="status-filter px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white" data-status="all">
            ทั้งหมด
          </button>
          <button onclick="ordersManager.filterByStatus('pending')" class="status-filter px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-700 border hover:bg-gray-50" data-status="pending">
            รอดำเนินการ
          </button>
          <button onclick="ordersManager.filterByStatus('confirmed')" class="status-filter px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-700 border hover:bg-gray-50" data-status="confirmed">
            ยืนยันแล้ว
          </button>
          <button onclick="ordersManager.filterByStatus('shipped')" class="status-filter px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-700 border hover:bg-gray-50" data-status="shipped">
            จัดส่งแล้ว
          </button>
          <button onclick="ordersManager.filterByStatus('delivered')" class="status-filter px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-700 border hover:bg-gray-50" data-status="delivered">
            ส่งถึงแล้ว
          </button>
        </div>
        
        <div class="flex gap-3">
          <div class="relative">
            <input 
              id="order-search" 
              type="text" 
              placeholder="ค้นหาคำสั่งซื้อ, ลูกค้า..." 
              class="w-64 px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              onkeypress="if(event.key==='Enter') ordersManager.searchOrders()"
            >
            <span class="absolute inset-y-0 left-0 flex items-center pl-3">
              <i data-lucide="search" class="w-4 h-4 text-gray-400"></i>
            </span>
          </div>
          <button onclick="ordersManager.searchOrders()" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            ค้นหา
          </button>
          <button onclick="ordersManager.exportOrders()" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500">
            <i data-lucide="download" class="w-4 h-4 inline mr-2"></i>
            Export
          </button>
        </div>
      </div>

      <!-- Orders Table -->
      <div class="bg-white rounded-xl shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  คำสั่งซื้อ
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ลูกค้า
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ยอดรวม
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  การชำระเงิน
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สถานะคำสั่งซื้อ
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  เลขพัสดุ
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody id="orders-table-body" class="bg-white divide-y divide-gray-200">
              <tr>
                <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                  <div class="flex items-center justify-center">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <span class="ml-2">กำลังโหลดข้อมูล...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div id="orders-pagination" class="bg-white px-4 py-3 border-t border-gray-200">
          <!-- Pagination จะถูกแทรกที่นี่ -->
        </div>
      </div>
    `;

    lucide.createIcons();
  }

  renderOrdersTable(orders) {
    const tableBody = document.getElementById('orders-table-body');
    
    if (orders.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-4 text-center text-gray-500">
            <div class="flex flex-col items-center py-8">
              <i data-lucide="package" class="w-12 h-12 text-gray-300 mb-2"></i>
              <p class="text-gray-500">ไม่พบข้อมูลคำสั่งซื้อ</p>
              <p class="text-sm text-gray-400">ลองเปลี่ยนเงื่อนไขการค้นหา</p>
            </div>
          </td>
        </tr>
      `;
      lucide.createIcons();
      return;
    }
    
    tableBody.innerHTML = orders.map(order => `
      <tr class="hover:bg-gray-50 transition-colors duration-150">
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900">#${order.orderNumber}</div>
          <div class="text-xs text-gray-500">${this.formatDate(order.createdAt)}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <div class="flex-shrink-0 h-8 w-8">
              <div class="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <span class="text-sm font-medium text-indigo-600">
                  ${(order.customer.name || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div class="ml-3">
              <div class="text-sm font-medium text-gray-900">${order.customer.name || 'ไม่ระบุ'}</div>
              <div class="text-xs text-gray-500">${order.customer.email || 'ไม่ระบุ'}</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900">฿${order.totalAmount.toLocaleString()}</div>
          <div class="text-xs text-gray-500">${this.translatePaymentMethod(order.paymentMethod)}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${this.getPaymentStatusColor(order.paymentStatus)}">
            <span class="w-1.5 h-1.5 rounded-full ${this.getPaymentStatusDotColor(order.paymentStatus)} mr-1.5"></span>
            ${this.translatePaymentStatus(order.paymentStatus)}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${this.getOrderStatusColor(order.orderStatus)}">
            <span class="w-1.5 h-1.5 rounded-full ${this.getOrderStatusDotColor(order.orderStatus)} mr-1.5"></span>
            ${this.translateOrderStatus(order.orderStatus)}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${order.trackingNumber ? 
            `<div class="font-mono text-xs bg-gray-100 px-2 py-1 rounded">${order.trackingNumber}</div>` : 
            '<span class="text-gray-400">-</span>'
          }
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div class="flex items-center justify-end space-x-2">
            <button 
              onclick="ordersManager.viewOrderDetail(${order.id})" 
              class="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 p-1 rounded transition-colors duration-150" 
              title="ดูรายละเอียด"
            >
              <i data-lucide="eye" class="w-4 h-4"></i>
            </button>
            <button 
              onclick="ordersManager.showUpdateStatusModal(${order.id}, '${order.orderStatus}', '${order.paymentStatus}', '${order.trackingNumber || ''}', '${order.shippingCompany || ''}')" 
              class="text-green-600 hover:text-green-900 hover:bg-green-50 p-1 rounded transition-colors duration-150" 
              title="อัพเดทสถานะ"
            >
              <i data-lucide="edit" class="w-4 h-4"></i>
            </button>
            <button 
              onclick="ordersManager.printOrder(${order.id})" 
              class="text-blue-600 hover:text-blue-900 hover:bg-blue-50 p-1 rounded transition-colors duration-150" 
              title="พิมพ์ใบสั่งซื้อ"
            >
              <i data-lucide="printer" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
    
    lucide.createIcons();
  }

  renderPagination(pagination) {
    const paginationContainer = document.getElementById('orders-pagination');
    const { page, totalPages, total } = pagination;
    
    let paginationHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center text-sm text-gray-700">
          <span>แสดง ${((page - 1) * this.limit) + 1} ถึง ${Math.min(page * this.limit, total)} จาก ${total} รายการ</span>
        </div>
        <div class="flex items-center space-x-2">
    `;
    
    // Previous button
    if (page > 1) {
      paginationHTML += `
        <button 
          onclick="ordersManager.goToPage(${page - 1})" 
          class="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors duration-150"
        >
          ก่อนหน้า
        </button>
      `;
    }
    
    // Page numbers
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);
    
    if (startPage > 1) {
      paginationHTML += `
        <button onclick="ordersManager.goToPage(1)" class="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">1</button>
        ${startPage > 2 ? '<span class="px-2 text-gray-500">...</span>' : ''}
      `;
    }
    
    for (let i = startPage; i <= endPage; i++) {
      paginationHTML += `
        <button 
          onclick="ordersManager.goToPage(${i})" 
          class="px-3 py-1 border rounded text-sm transition-colors duration-150 ${
            i === page 
              ? 'bg-indigo-600 text-white border-indigo-600' 
              : 'border-gray-300 hover:bg-gray-50'
          }"
        >
          ${i}
        </button>
      `;
    }
    
    if (endPage < totalPages) {
      paginationHTML += `
        ${endPage < totalPages - 1 ? '<span class="px-2 text-gray-500">...</span>' : ''}
        <button onclick="ordersManager.goToPage(${totalPages})" class="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">${totalPages}</button>
      `;
    }
    
    // Next button
    if (page < totalPages) {
      paginationHTML += `
        <button 
          onclick="ordersManager.goToPage(${page + 1})" 
          class="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors duration-150"
        >
          ถัดไป
        </button>
      `;
    }
    
    paginationHTML += '</div></div>';
    paginationContainer.innerHTML = paginationHTML;
  }

  updateStats(orders) {
    const stats = {
      total: orders.length,
      pending: orders.filter(o => o.orderStatus === 'pending').length,
      confirmed: orders.filter(o => o.orderStatus === 'confirmed').length,
      shipped: orders.filter(o => o.orderStatus === 'shipped').length,
      delivered: orders.filter(o => o.orderStatus === 'delivered').length
    };

    const statsContainer = document.getElementById('order-stats');
    statsContainer.innerHTML = `
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <i data-lucide="package" class="h-6 w-6 text-gray-400"></i>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">ทั้งหมด</dt>
                <dd class="text-lg font-medium text-gray-900">${stats.total}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <i data-lucide="clock" class="h-6 w-6 text-yellow-400"></i>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">รอดำเนินการ</dt>
                <dd class="text-lg font-medium text-gray-900">${stats.pending}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <i data-lucide="check-circle" class="h-6 w-6 text-blue-400"></i>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">ยืนยันแล้ว</dt>
                <dd class="text-lg font-medium text-gray-900">${stats.confirmed}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <i data-lucide="truck" class="h-6 w-6 text-purple-400"></i>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">จัดส่งแล้ว</dt>
                <dd class="text-lg font-medium text-gray-900">${stats.shipped}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <i data-lucide="check-circle-2" class="h-6 w-6 text-green-400"></i>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">ส่งถึงแล้ว</dt>
                <dd class="text-lg font-medium text-gray-900">${stats.delivered}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    `;
    
    lucide.createIcons();
  }

  // Filter and search methods
  filterByStatus(status) {
    this.currentStatus = status;
    this.currentPage = 1;
    this.loadOrders();
    
    // Update active filter button
    document.querySelectorAll('.status-filter').forEach(btn => {
      btn.classList.remove('bg-indigo-600', 'text-white');
      btn.classList.add('bg-white', 'text-gray-700', 'border');
    });
    
    const activeBtn = document.querySelector(`[data-status="${status}"]`);
    if (activeBtn) {
      activeBtn.classList.remove('bg-white', 'text-gray-700', 'border');
      activeBtn.classList.add('bg-indigo-600', 'text-white');
    }
  }

  searchOrders() {
    this.currentSearch = document.getElementById('order-search').value;
    this.currentPage = 1;
    this.loadOrders();
  }

  goToPage(page) {
    this.currentPage = page;
    this.loadOrders();
  }

  // Utility methods
  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: '2-digit',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  translatePaymentMethod(method) {
    const methods = {
      'bank_transfer': 'โอนผ่านธนาคาร',
      'cod': 'เก็บเงินปลายทาง',
      'credit_card': 'บัตรเครดิต',
      'qr_code': 'QR Code'
    };
    return methods[method] || method;
  }

  translatePaymentStatus(status) {
    const statuses = {
      'pending': 'รอการชำระเงิน',
      'paid': 'ชำระเงินแล้ว',
      'failed': 'การชำระเงินล้มเหลว',
      'refunded': 'คืนเงินแล้ว'
    };
    return statuses[status] || status;
  }

  translateOrderStatus(status) {
    const statuses = {
      'pending': 'รอดำเนินการ',
      'confirmed': 'ยืนยันแล้ว',
      'shipped': 'จัดส่งแล้ว',
      'delivered': 'ส่งถึงแล้ว',
      'cancelled': 'ยกเลิก',
      'returned': 'ส่งคืน'
    };
    return statuses[status] || status;
  }

  getPaymentStatusColor(status) {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'paid': 'bg-green-100 text-green-800',
      'failed': 'bg-red-100 text-red-800',
      'refunded': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  getPaymentStatusDotColor(status) {
    const colors = {
      'pending': 'bg-yellow-400',
      'paid': 'bg-green-400',
      'failed': 'bg-red-400',
      'refunded': 'bg-gray-400'
    };
    return colors[status] || 'bg-gray-400';
  }

  getOrderStatusColor(status) {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'confirmed': 'bg-blue-100 text-blue-800',
      'shipped': 'bg-purple-100 text-purple-800',
      'delivered': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'returned': 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  getOrderStatusDotColor(status) {
    const colors = {
      'pending': 'bg-yellow-400',
      'confirmed': 'bg-blue-400',
      'shipped': 'bg-purple-400',
      'delivered': 'bg-green-400',
      'cancelled': 'bg-red-400',
      'returned': 'bg-orange-400'
    };
    return colors[status] || 'bg-gray-400';
  }

  showError(message) {
    const tableBody = document.getElementById('orders-table-body');
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-4 text-center">
          <div class="flex flex-col items-center py-8">
            <i data-lucide="alert-circle" class="w-12 h-12 text-red-300 mb-2"></i>
            <p class="text-red-500">${message}</p>
            <button onclick="ordersManager.loadOrders()" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800">
              ลองใหม่อีกครั้ง
            </button>
          </div>
        </td>
      </tr>
    `;
    lucide.createIcons();
  }

  // Export functionality
  async exportOrders() {
    try {
      const params = new URLSearchParams({
        status: this.currentStatus,
        search: this.currentSearch,
        export: 'true'
      });
      
      const response = await fetch(`/api/admin/orders/export?${params}`);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting orders:', error);
      Swal.fire({
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถ Export ข้อมูลได้',
        icon: 'error'
      });
    }
  }

  // Print functionality
  async printOrder(orderId) {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      // สร้างหน้าต่างใหม่สำหรับพิมพ์
      const printWindow = window.open('', '_blank');
      printWindow.document.write(this.generatePrintHTML(data.order));
      printWindow.document.close();
      printWindow.print();
      
    } catch (error) {
      console.error('Error printing order:', error);
      Swal.fire({
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถพิมพ์ใบสั่งซื้อได้',
        icon: 'error'
      });
    }
  }

  generatePrintHTML(order) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>ใบสั่งซื้อ #${order.order_number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .order-info { margin-bottom: 20px; }
          .customer-info { margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
          th { background-color: #f5f5f5; }
          .total { font-weight: bold; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ใบสั่งซื้อ</h1>
          <h2>#${order.order_number}</h2>
        </div>
        
        <div class="order-info">
          <p><strong>วันที่สั่ง:</strong> ${this.formatDate(order.created_at)}</p>
          <p><strong>สถานะ:</strong> ${this.translateOrderStatus(order.order_status)}</p>
          <p><strong>การชำระเงิน:</strong> ${this.translatePaymentStatus(order.payment_status)}</p>
        </div>
        
        <div class="customer-info">
          <h3>ข้อมูลลูกค้า</h3>
          <p><strong>ชื่อ:</strong> ${order.users?.name || 'ไม่ระบุ'}</p>
          <p><strong>อีเมล:</strong> ${order.users?.email || 'ไม่ระบุ'}</p>
          <p><strong>ที่อยู่:</strong> ${order.user_addresses ? `${order.user_addresses.address_line1}, ${order.user_addresses.city}, ${order.user_addresses.province} ${order.user_addresses.postal_code}` : 'ไม่ระบุ'}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>สินค้า</th>
              <th>จำนวน</th>
              <th>ราคาต่อหน่วย</th>
              <th>ราคารวม</th>
            </tr>
          </thead>
          <tbody>
            ${order.order_items.map(item => `
              <tr>
                <td>${item.products?.name || 'ไม่ระบุ'}</td>
                <td>${item.quantity}</td>
                <td>฿${Number(item.price).toLocaleString()}</td>
                <td>฿${Number(item.total).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <table style="width: 300px; margin-left: auto;">
          <tr>
            <td>ยอดรวม:</td>
            <td class="text-right">฿${Number(order.subtotal).toLocaleString()}</td>
          </tr>
          <tr>
            <td>ค่าจัดส่ง:</td>
            <td class="text-right">฿${Number(order.shipping_fee).toLocaleString()}</td>
          </tr>
          <tr>
            <td>ส่วนลด:</td>
            <td class="text-right">-฿${Number(order.discount).toLocaleString()}</td>
          </tr>
          <tr class="total">
            <td>ยอดรวมทั้งหมด:</td>
            <td class="text-right">฿${Number(order.total_amount).toLocaleString()}</td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}

// สร้าง instance
const ordersManager = new OrdersManager();

// View Order Detail
ordersManager.viewOrderDetail = async function(orderId) {
  try {
    const response = await fetch(`/api/admin/orders/${orderId}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error);
    }
    
    const order = data.order;
    
    Swal.fire({
      title: `คำสั่งซื้อ #${order.order_number}`,
      html: `
        <div class="text-left space-y-6 max-h-96 overflow-y-auto">
          <!-- Customer Info -->
          <div class="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 class="font-semibold text-gray-900 mb-2">ข้อมูลลูกค้า</h4>
              <p class="text-sm"><strong>ชื่อ:</strong> ${order.users?.name || 'ไม่ระบุ'}</p>
              <p class="text-sm"><strong>อีเมล:</strong> ${order.users?.email || 'ไม่ระบุ'}</p>
              <p class="text-sm"><strong>สมัครเมื่อ:</strong> ${this.formatDate(order.users?.created_at)}</p>
            </div>
            <div>
              <h4 class="font-semibold text-gray-900 mb-2">ข้อมูลคำสั่งซื้อ</h4>
              <p class="text-sm"><strong>วันที่สั่ง:</strong> ${this.formatDate(order.created_at)}</p>
              <p class="text-sm"><strong>การชำระเงิน:</strong> ${this.translatePaymentMethod(order.payment_method)}</p>
              <p class="text-sm"><strong>สถานะ:</strong> 
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${this.getOrderStatusColor(order.order_status)}">
                  ${this.translateOrderStatus(order.order_status)}
                </span>
              </p>
            </div>
          </div>
          
          <!-- Shipping Address -->
          <div class="p-4 bg-blue-50 rounded-lg">
            <h4 class="font-semibold text-gray-900 mb-2">ที่อยู่จัดส่ง</h4>
            ${order.user_addresses ? `
              <p class="text-sm"><strong>ชื่อผู้รับ:</strong> ${order.user_addresses.name}</p>
              <p class="text-sm"><strong>โทรศัพท์:</strong> ${order.user_addresses.phone}</p>
              <p class="text-sm"><strong>ที่อยู่:</strong> ${order.user_addresses.address_line1}</p>
              ${order.user_addresses.address_line2 ? `<p class="text-sm">${order.user_addresses.address_line2}</p>` : ''}
              <p class="text-sm">${order.user_addresses.district} ${order.user_addresses.city} ${order.user_addresses.province} ${order.user_addresses.postal_code}</p>
            ` : '<p class="text-sm text-gray-500">ไม่ระบุที่อยู่</p>'}
          </div>
          
          <!-- Shipping Info -->
          ${order.tracking_number || order.shipping_company ? `
            <div class="p-4 bg-purple-50 rounded-lg">
              <h4 class="font-semibold text-gray-900 mb-2">ข้อมูลการจัดส่ง</h4>
              ${order.tracking_number ? `<p class="text-sm"><strong>เลขพัสดุ:</strong> <span class="font-mono bg-white px-2 py-1 rounded">${order.tracking_number}</span></p>` : ''}
              ${order.shipping_company ? `<p class="text-sm"><strong>บริษัทขนส่ง:</strong> ${order.shipping_company}</p>` : ''}
              ${order.estimated_delivery ? `<p class="text-sm"><strong>วันที่คาดว่าจะส่งถึง:</strong> ${this.formatDate(order.estimated_delivery)}</p>` : ''}
            </div>
          ` : ''}
          
          <!-- Order Items -->
          <div>
            <h4 class="font-semibold text-gray-900 mb-3">รายการสินค้า</h4>
            <div class="border rounded-lg overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="text-left py-2 px-3">สินค้า</th>
                    <th class="text-center py-2 px-3">จำนวน</th>
                    <th class="text-right py-2 px-3">ราคา/หน่วย</th>
                    <th class="text-right py-2 px-3">รวม</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  ${order.order_items.map(item => `
                    <tr>
                      <td class="py-2 px-3">
                        <div class="flex items-center space-x-2">
                          ${item.products?.image_url ? `<img src="${item.products.image_url}" alt="" class="w-8 h-8 rounded object-cover">` : ''}
                          <span>${item.products?.name || 'ไม่ระบุ'}</span>
                        </div>
                      </td>
                      <td class="text-center py-2 px-3">${item.quantity}</td>
                      <td class="text-right py-2 px-3">฿${Number(item.price).toLocaleString()}</td>
                      <td class="text-right py-2 px-3">฿${Number(item.total).toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- Order Summary -->
          <div class="border-t pt-4">
            <div class="space-y-2 text-sm">
              <div class="flex justify-between"><span>ยอดรวม:</span><span>฿${Number(order.subtotal).toLocaleString()}</span></div>
              <div class="flex justify-between"><span>ค่าจัดส่ง:</span><span>฿${Number(order.shipping_fee).toLocaleString()}</span></div>
              <div class="flex justify-between"><span>ส่วนลด:</span><span class="text-red-600">-฿${Number(order.discount).toLocaleString()}</span></div>
              <div class="flex justify-between font-bold text-lg pt-2 border-t">
                <span>ยอดรวมทั้งหมด:</span><span class="text-indigo-600">฿${Number(order.total_amount).toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <!-- Payment Proofs -->
          ${order.payment_proofs && order.payment_proofs.length > 0 ? `
            <div class="p-4 bg-green-50 rounded-lg">
              <h4 class="font-semibold text-gray-900 mb-2">หลักฐานการชำระเงิน</h4>
              <div class="grid grid-cols-2 gap-2">
                ${order.payment_proofs.map(proof => `
                  <div class="border rounded p-2 bg-white">
                    <p class="text-xs text-gray-600">อัพโหลดเมื่อ: ${this.formatDate(proof.uploaded_at)}</p>
                    <p class="text-xs">สถานะ: <span class="px-1 py-0.5 rounded text-xs ${proof.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${proof.status}</span></p>
                    <a href="${proof.file_path || '#'}" 
                       onclick="window.open('${proof.file_path}', '_blank'); return false;" 
                       class="text-blue-600 hover:text-blue-800 text-xs">
                       ดูหลักฐาน
                    </a>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- Notes -->
          ${order.notes ? `
            <div class="p-4 bg-yellow-50 rounded-lg">
              <h4 class="font-semibold text-gray-900 mb-2">หมายเหตุ</h4>
              <p class="text-sm">${order.notes}</p>
            </div>
          ` : ''}
        </div>
      `,
      width: '900px',
      showConfirmButton: false,
      showCloseButton: true,
      customClass: {
        popup: 'text-left'
      }
    });
    
  } catch (error) {
    console.error('Error fetching order details:', error);
    Swal.fire({
      title: 'เกิดข้อผิดพลาด',
      text: 'ไม่สามารถโหลดรายละเอียดคำสั่งซื้อได้',
      icon: 'error'
    });
  }
};

// Update Status Modal
ordersManager.showUpdateStatusModal = function(orderId, currentOrderStatus, currentPaymentStatus, currentTrackingNumber = '', currentShippingCompany = '') {
  Swal.fire({
    title: 'อัพเดทสถานะคำสั่งซื้อ',
    html: `
      <div class="space-y-4 text-left">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">สถานะคำสั่งซื้อ</label>
            <select id="order-status" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="pending" ${currentOrderStatus === 'pending' ? 'selected' : ''}>รอดำเนินการ</option>
              <option value="confirmed" ${currentOrderStatus === 'confirmed' ? 'selected' : ''}>ยืนยันแล้ว</option>
              <option value="shipped" ${currentOrderStatus === 'shipped' ? 'selected' : ''}>จัดส่งแล้ว</option>
              <option value="delivered" ${currentOrderStatus === 'delivered' ? 'selected' : ''}>ส่งถึงแล้ว</option>
              <option value="cancelled" ${currentOrderStatus === 'cancelled' ? 'selected' : ''}>ยกเลิก</option>
              <option value="returned" ${currentOrderStatus === 'returned' ? 'selected' : ''}>ส่งคืน</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">สถานะการชำระเงิน</label>
            <select id="payment-status" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="pending" ${currentPaymentStatus === 'pending' ? 'selected' : ''}>รอการชำระเงิน</option>
              <option value="paid" ${currentPaymentStatus === 'paid' ? 'selected' : ''}>ชำระเงินแล้ว</option>
              <option value="failed" ${currentPaymentStatus === 'failed' ? 'selected' : ''}>การชำระเงินล้มเหลว</option>
              <option value="refunded" ${currentPaymentStatus === 'refunded' ? 'selected' : ''}>คืนเงินแล้ว</option>
            </select>
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">เลขพัสดุ</label>
          <input 
            type="text" 
            id="tracking-number" 
            value="${currentTrackingNumber}" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" 
            placeholder="กรอกเลขพัสดุ (ถ้ามี)"
          >
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">บริษัทขนส่ง</label>
          <select id="shipping-company" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">เลือกบริษัทขนส่ง</option>
            <option value="Kerry Express" ${currentShippingCompany === 'Kerry Express' ? 'selected' : ''}>Kerry Express</option>
            <option value="Thailand Post" ${currentShippingCompany === 'Thailand Post' ? 'selected' : ''}>ไปรษณีย์ไทย</option>
            <option value="Flash Express" ${currentShippingCompany === 'Flash Express' ? 'selected' : ''}>Flash Express</option>
            <option value="J&T Express" ${currentShippingCompany === 'J&T Express' ? 'selected' : ''}>J&T Express</option>
            <option value="SCG Express" ${currentShippingCompany === 'SCG Express' ? 'selected' : ''}>SCG Express</option>
            <option value="DHL" ${currentShippingCompany === 'DHL' ? 'selected' : ''}>DHL</option>
            <option value="FedEx" ${currentShippingCompany === 'FedEx' ? 'selected' : ''}>FedEx</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">วันที่คาดว่าจะส่งถึง</label>
          <input 
            type="date" 
            id="estimated-delivery" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            min="${new Date().toISOString().split('T')[0]}"
          >
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">หมายเหตุ</label>
          <textarea 
            id="order-notes" 
            rows="3" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" 
            placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
          ></textarea>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'อัพเดท',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#3B82F6',
    width: '600px',
    preConfirm: () => {
      const orderStatus = document.getElementById('order-status').value;
      const paymentStatus = document.getElementById('payment-status').value;
      const trackingNumber = document.getElementById('tracking-number').value;
      const shippingCompany = document.getElementById('shipping-company').value;
      const estimatedDelivery = document.getElementById('estimated-delivery').value;
      const notes = document.getElementById('order-notes').value;
      
      return { 
        orderStatus, 
        paymentStatus, 
        trackingNumber, 
        shippingCompany,
        estimatedDelivery: estimatedDelivery || null,
        notes
      };
    }
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const response = await fetch(`/api/admin/orders/${orderId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(result.value)
        });
        
        const data = await response.json();
        
        if (data.success) {
          Swal.fire({
            title: 'สำเร็จ!',
            text: 'อัพเดทสถานะเรียบร้อยแล้ว',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
          
          // Reload orders table
          ordersManager.loadOrders();
        } else {
          throw new Error(data.error);
        }
        
      } catch (error) {
        console.error('Error updating status:', error);
        Swal.fire({
          title: 'เกิดข้อผิดพลาด',
          text: 'ไม่สามารถอัพเดทสถานะได้',
          icon: 'error'
        });
      }
    }
  });
};

// Create Order (Frontend)
async function createOrder(orderData) {
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    const data = await response.json();
    
    // ตรวจสอบว่าดึง order_number อย่างถูกต้องหรือไม่
    const orderNumber = data.order_number || data.order?.order_number;
    console.log('Order Number:', orderNumber);
    alert(`สั่งซื้อสำเร็จ! หมายเลขคำสั่งซื้อของคุณคือ ${orderNumber}`);
    
  } catch (error) {
    console.error('Error creating order:', error);
    alert('เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองอีกครั้ง');
  }
}

// Track Order
async function trackOrder(orderNumber) {
  try {
    const response = await fetch(`/api/orders/track/${orderNumber}`);
    const data = await response.json();

    if (data.success) {
      console.log('📦 Order data:', data.data);
      alert(`ติดตามคำสั่งซื้อสำเร็จ: ${data.data.order_number}`);
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('❌ Error tracking order:', error);
    alert('เกิดข้อผิดพลาดในการติดตามคำสั่งซื้อ');
  }
}