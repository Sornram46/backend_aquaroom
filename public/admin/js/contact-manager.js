class ContactMessagesManager {
  constructor() {
    this.messages = [];
    this.isLoaded = false;
    console.log('📩 ContactMessagesManager initialized');
  }

  /**
   * โหลดและแสดงหน้า Contact Messages
   */
  async renderContactMessagesPage() {
    try {
      const mainContent = document.getElementById('main-content');
      if (!mainContent) throw new Error('Main content element not found');

      mainContent.innerHTML = this.renderLoadingState();
      await this.loadMessages();
      mainContent.innerHTML = this.renderMessagesHTML();
      this.setupEventHandlers();

      this.isLoaded = true;
      console.log('✅ Contact Messages page loaded');
    } catch (error) {
      console.error('❌ Error loading contact messages:', error);
      this.renderErrorState(error.message);
    }
  }

  /**
   * โหลดข้อความติดต่อจาก API
   */
  async loadMessages() {
    try {
      const response = await fetch('/api/admin/contact-messages');
      if (!response.ok) throw new Error(`โหลดข้อความล้มเหลว: ${response.status}`);
      const result = await response.json();
      if (result.success) {
        this.messages = result.data;
        console.log('✅ Loaded contact messages:', this.messages);
      } else {
        throw new Error(result.message || 'โหลดข้อความล้มเหลว');
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      this.messages = [];
    }
  }

  /**
   * สร้าง HTML สำหรับหน้า Contact Messages
   */
  renderMessagesHTML() {
    return `
      <div class="max-w-5xl mx-auto space-y-8">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <i data-lucide="mail" class="w-6 h-6"></i> ข้อความติดต่อเรา
          </h1>
          <p class="text-sm text-gray-600">ดูข้อความที่ลูกค้าส่งเข้ามา</p>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-6">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ชื่อ</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">อีเมล</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">หัวข้อ</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">วันที่</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                  <th class="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody id="contact-messages-list">
                ${this.renderMessagesList()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * สร้างรายการข้อความ
   */
  renderMessagesList() {
    if (!this.messages.length) {
      return `<tr><td colspan="6" class="text-center py-8 text-gray-500">ยังไม่มีข้อความติดต่อ</td></tr>`;
    }
    return this.messages.map(msg => `
      <tr class="border-b">
        <td class="px-4 py-2">${msg.name}</td>
        <td class="px-4 py-2">${msg.email}</td>
        <td class="px-4 py-2">${msg.subject}</td>
        <td class="px-4 py-2">${new Date(msg.created_at).toLocaleString()}</td>
        <td class="px-4 py-2">
          ${msg.is_read 
            ? '<span class="text-green-600">อ่านแล้ว</span>' 
            : '<span class="text-red-500">ยังไม่อ่าน</span>'}
        </td>
        <td class="px-4 py-2 flex gap-2">
          <button class="text-blue-600 hover:underline" onclick="contactMessagesManager.viewMessage(${msg.id})">ดู</button>
          <button class="text-red-600 hover:underline" onclick="contactMessagesManager.deleteMessage(${msg.id})">ลบ</button>
        </td>
      </tr>
    `).join('');
  }

  /**
   * ดูรายละเอียดข้อความ
   */
  async viewMessage(id) {
    try {
      const res = await fetch(`/api/admin/contact-messages/${id}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      const msg = result.data;
      // Mark as read
      await fetch(`/api/admin/contact-messages/${id}/read`, { method: 'PUT' });
      // Show details
      Swal.fire({
        title: `รายละเอียดข้อความ`,
        html: `
          <div class="text-left">
            <div><b>ชื่อ:</b> ${msg.name}</div>
            <div><b>อีเมล:</b> ${msg.email}</div>
            <div><b>เบอร์:</b> ${msg.phone || '-'}</div>
            <div><b>หัวข้อ:</b> ${msg.subject}</div>
            <div class="mt-2"><b>ข้อความ:</b><br>${msg.message}</div>
            <div class="mt-2 text-xs text-gray-500">ส่งเมื่อ: ${new Date(msg.created_at).toLocaleString()}</div>
          </div>
        `,
        confirmButtonText: 'ปิด',
        width: 500
      });
      await this.renderContactMessagesPage();
    } catch (error) {
      Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
    }
  }

  /**
   * ลบข้อความ
   */
  async deleteMessage(id) {
    const result = await Swal.fire({
      title: 'ลบข้อความนี้?',
      text: 'คุณต้องการลบข้อความนี้หรือไม่',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626'
    });
    if (result.isConfirmed) {
      try {
        await fetch(`/api/admin/contact-messages/${id}`, { method: 'DELETE' });
        await this.renderContactMessagesPage();
        Swal.fire('ลบเรียบร้อย', 'ข้อความถูกลบแล้ว', 'success');
      } catch (error) {
        Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
      }
    }
  }

  /**
   * แสดงหน้าแก้ไขข้อมูลติดต่อ (Contact Setting)
   */
  async renderContactSettingPage() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = this.renderContactSettingForm();
    await this.loadContactSettingForm();
    this.setupContactSettingFormHandler();
  }

  /**
   * สร้าง HTML ฟอร์มแก้ไขข้อมูลติดต่อ
   */
  renderContactSettingForm() {
    return `
      <div class="max-w-2xl mx-auto py-10">
        <h1 class="text-2xl font-bold mb-6">ตั้งค่าข้อมูลติดต่อ</h1>
        <form id="contact-setting-form" class="bg-white p-6 rounded shadow space-y-4">
          <div>
            <label class="block mb-1">ที่อยู่</label>
            <textarea name="address" id="address" class="w-full border rounded p-2"></textarea>
          </div>
          <div>
            <label class="block mb-1">เบอร์โทร</label>
            <input name="phone" id="phone" class="w-full border rounded p-2" />
          </div>
          <div>
            <label class="block mb-1">อีเมล</label>
            <input name="email" id="email" class="w-full border rounded p-2" />
          </div>


            <div>
            <label class="block mb-1">เวลาเปิดทำการ</label>
            <input type="text" name="business_hours_first" id="business_hours_first" class="w-full border rounded p-2" />
            <label class="text-xs text-gray-500">ถึง</label>
            <input type="text" name="business_hours_two" id="business_hours_two" class="w-full border rounded p-2" />

          </div>

          <div>
            <label class="block mb-1">Facebook</label>
            <input name="facebook" id="facebook" class="w-full border rounded p-2" />
          </div>
          <div>
            <label class="block mb-1">TikTok</label>
            <input name="tiktok" id="tiktok" class="w-full border rounded p-2" />
          </div>
          <div>
            <label class="block mb-1">LINE</label>
            <input name="line" id="line" class="w-full border rounded p-2" />
          </div>
          
          <div>
            <label class="block mb-1">Google Map Embed (iframe)</label>
            <textarea name="map_embed" id="map_embed" class="w-full border rounded p-2"></textarea>
          </div>
          <button type="submit" class="bg-indigo-600 text-white px-6 py-2 rounded">บันทึก</button>
        </form>
      </div>
    `;
  }

  /**
   * โหลดข้อมูล contact setting มาใส่ในฟอร์ม
   */
  async loadContactSettingForm() {
    const res = await fetch('/api/admin/contact-setting');
    const data = await res.json();
    if (data.success && data.data) {
      Object.entries(data.data).forEach(([k, v]) => {
        if (document.getElementById(k)) document.getElementById(k).value = v || '';
      });
    }
  }

  /**
   * ตั้ง handler สำหรับ submit ฟอร์ม
   */
  setupContactSettingFormHandler() {
    const form = document.getElementById('contact-setting-form');
    if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        address: form.address.value,
        phone: form.phone.value,
        email: form.email.value,
        business_hours_first: form.business_hours_first.value,
        business_hours_two: form.business_hours_two.value,
        facebook: form.facebook.value,
        line: form.line.value,
        tiktok: form.tiktok.value,
        map_embed: form.map_embed.value
      };
      const res = await fetch('/api/admin/contact-setting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        Swal.fire('บันทึกสำเร็จ', '', 'success');
      } else {
        Swal.fire('เกิดข้อผิดพลาด', result.message, 'error');
      }
    };
  }

  /**
   * Setup Event Handlers (ถ้ามี)
   */
  setupEventHandlers() {
    // เพิ่ม event handler เพิ่มเติมได้ที่นี่
  }

  /**
   * Render Loading State
   */
  renderLoadingState() {
    return `
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p class="text-gray-600">กำลังโหลดข้อความติดต่อ...</p>
        </div>
      </div>
    `;
  }

  /**
   * Render Error State
   */
  renderErrorState(errorMessage) {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = `
        <div class="text-center py-12">
          <div class="text-red-500 mb-4">
            <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2"></i>
            <h3 class="text-lg font-medium">เกิดข้อผิดพลาด</h3>
            <p class="text-sm mt-2">${errorMessage}</p>
          </div>
          <button 
            onclick="contactMessagesManager.renderContactMessagesPage()" 
            class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
          >
            ลองใหม่
          </button>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
}

// Export class to global scope
window.ContactMessagesManager = ContactMessagesManager;

// สร้าง instance global
if (!window.contactMessagesManager) {
  window.contactMessagesManager = new ContactMessagesManager();
}