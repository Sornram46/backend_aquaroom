/**
 * Payment Settings Management System
 * จัดการการตั้งค่าวิธีการชำระเงินในระบบ Admin
 */

class PaymentSettingsManager {
  constructor() {
    this.settings = null;
    this.isLoaded = false;
    this.bankAccounts = [];
    this.promptpaySettings = {};
    
    console.log('💳 PaymentSettingsManager initialized');
  }

  /**
   * โหลดและแสดงหน้า Payment Settings
   */
  async renderPaymentSettingsPage() {
    try {
      console.log('💳 Loading Payment Settings page...');
      
      const mainContent = document.getElementById('main-content');
      if (!mainContent) {
        throw new Error('Main content element not found');
      }

      // แสดง loading state
      mainContent.innerHTML = this.renderLoadingState();

      // โหลดข้อมูลจาก API
      await this.loadPaymentSettings();

      // สร้าง HTML
      mainContent.innerHTML = this.renderPaymentSettingsHTML();

      // Setup event handlers
      this.setupEventHandlers();

      // โหลด icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

      this.isLoaded = true;
      console.log('✅ Payment Settings page loaded successfully');

    } catch (error) {
      console.error('❌ Error loading Payment Settings:', error);
      this.renderErrorState(error.message);
    }
  }

  /**
   * โหลดข้อมูลการตั้งค่าจาก API
   */
  async loadPaymentSettings() {
    try {
      console.log('📡 Loading payment settings from API...');
      
      const response = await fetch('/api/admin/payment-settings');
      if (!response.ok) {
        throw new Error(`Failed to load payment settings: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        this.settings = result.data;
        console.log('✅ Payment settings loaded:', this.settings);
      } else {
        throw new Error(result.message || 'Failed to load payment settings');
      }

    } catch (error) {
      console.error('❌ Error loading payment settings:', error);
      // ใช้ค่าเริ่มต้นถ้าโหลดไม่ได้
      this.settings = this.getDefaultSettings();
    }
  }

  /**
   * ค่าเริ่มต้นของการตั้งค่า
   */
  getDefaultSettings() {
    return {
      // PromptPay Settings
      promptpay_enabled: false,
      promptpay_id: '',
      promptpay_name: '',
      promptpay_qr_type: 'phone', // 'phone' หรือ 'tax_id'
      
      // Bank Transfer Settings
      bank_transfer_enabled: true,
      bank_accounts: [],
      
      // Credit Card Settings (สำหรับอนาคต)
      credit_card_enabled: false,
      
      // Cash on Delivery
      cod_enabled: false,
      cod_fee: 0,
      cod_max_amount: 0,
      
      // Auto-verification
      auto_verify_enabled: false,
      auto_verify_amount_limit: 10000,
      
      // Other settings
      payment_timeout_hours: 24,
      require_payment_proof: true
    };
  }

  /**
   * สร้าง HTML สำหรับหน้า Payment Settings
   */
  renderPaymentSettingsHTML() {
    return `
      <div class="max-w-6xl mx-auto space-y-8">
        <!-- Header -->
        <div class="mb-6">
          <div class="flex items-center space-x-4">
            <button 
              onclick="window.history.back()" 
              class="text-gray-400 hover:text-gray-600"
              title="กลับ"
            >
              <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </button>
            <div>
              <h1 class="text-2xl font-bold text-gray-900">ตั้งค่าวิธีการชำระเงิน</h1>
              <p class="text-sm text-gray-600">จัดการวิธีการชำระเงินที่ลูกค้าสามารถใช้ได้</p>
            </div>
          </div>
        </div>

        <!-- Payment Methods Overview -->
        ${this.renderPaymentMethodsOverview()}

        <!-- PromptPay Settings -->
        ${this.renderPromptPaySettings()}

        <!-- Bank Transfer Settings -->
        ${this.renderBankTransferSettings()}

        <!-- Cash on Delivery Settings -->
        ${this.renderCODSettings()}

        <!-- Auto-Verification Settings -->
        ${this.renderAutoVerificationSettings()}

        <!-- General Settings -->
        ${this.renderGeneralSettings()}

        <!-- Save Button -->
        <div class="flex justify-end space-x-3 pt-6 border-t">
          <button 
            type="button" 
            onclick="paymentSettingsManager.resetSettings()" 
            class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            รีเซ็ต
          </button>
          <button 
            type="button" 
            onclick="paymentSettingsManager.saveAllSettings()" 
            id="save-payment-settings-btn"
            class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center"
          >
            <span id="save-payment-settings-text">บันทึกการตั้งค่า</span>
            <svg id="save-payment-settings-loading" class="hidden animate-spin ml-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * ภาพรวมวิธีการชำระเงิน
   */
  renderPaymentMethodsOverview() {
    const methods = [
      {
        id: 'promptpay',
        name: 'PromptPay QR Code',
        enabled: this.settings?.promptpay_enabled || false,
        icon: 'qr-code',
        color: 'blue'
      },
      {
        id: 'bank_transfer',
        name: 'โอนผ่านธนาคาร',
        enabled: this.settings?.bank_transfer_enabled || false,
        icon: 'building-2',
        color: 'green'
      },
      {
        id: 'cod',
        name: 'เก็บเงินปลายทาง',
        enabled: this.settings?.cod_enabled || false,
        icon: 'truck',
        color: 'orange'
      },
      {
        id: 'credit_card',
        name: 'บัตรเครดิต/เดบิต',
        enabled: this.settings?.credit_card_enabled || false,
        icon: 'credit-card',
        color: 'purple'
      }
    ];

    return `
      <div class="bg-white rounded-xl shadow-sm p-8">
        <h2 class="text-xl font-bold mb-6 text-indigo-700 flex items-center gap-2">
          <i data-lucide="credit-card" class="w-5 h-5"></i> วิธีการชำระเงิน
        </h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          ${methods.map(method => `
            <div class="border border-gray-200 rounded-lg p-4 text-center">
              <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-${method.color}-100 flex items-center justify-center">
                <i data-lucide="${method.icon}" class="w-6 h-6 text-${method.color}-600"></i>
              </div>
              <h3 class="font-semibold text-gray-900 mb-2">${method.name}</h3>
              <div class="flex items-center justify-center">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  method.enabled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }">
                  ${method.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * การตั้งค่า PromptPay
   */
  renderPromptPaySettings() {
    return `
      <div class="bg-white rounded-xl shadow-sm p-8">
        <h2 class="text-xl font-bold mb-6 text-indigo-700 flex items-center gap-2">
          <i data-lucide="qr-code" class="w-5 h-5"></i> PromptPay QR Code
        </h2>
        
        <div class="space-y-6">
          <!-- Enable/Disable -->
          <div class="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div>
              <h3 class="font-semibold text-gray-900">เปิดใช้งาน PromptPay</h3>
              <p class="text-sm text-gray-600">ลูกค้าสามารถสแกน QR Code เพื่อชำระเงิน</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                id="promptpay-enabled"
                ${this.settings?.promptpay_enabled ? 'checked' : ''}
                class="sr-only peer"
                onchange="paymentSettingsManager.togglePromptPay(this.checked)"
              >
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <!-- PromptPay Settings Form -->
          <div id="promptpay-settings-form" class="${!this.settings?.promptpay_enabled ? 'hidden' : ''}">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- QR Type -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">ประเภท PromptPay</label>
                <select 
                  id="promptpay-qr-type"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="phone" ${this.settings?.promptpay_qr_type === 'phone' ? 'selected' : ''}>เบอร์โทรศัพท์</option>
                  <option value="tax_id" ${this.settings?.promptpay_qr_type === 'tax_id' ? 'selected' : ''}>เลขประจำตัวผู้เสียภาษี</option>
                </select>
              </div>

              <!-- PromptPay ID -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  <span id="promptpay-id-label">
                    ${this.settings?.promptpay_qr_type === 'tax_id' ? 'เลขประจำตัวผู้เสียภาษี' : 'เบอร์โทรศัพท์'}
                  </span>
                </label>
                <input 
                  type="text" 
                  id="promptpay-id"
                  value="${this.settings?.promptpay_id || ''}"
                  placeholder="${this.settings?.promptpay_qr_type === 'tax_id' ? '1234567890123' : '0812345678'}"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <!-- Account Name -->
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-2">ชื่อบัญชี</label>
                <input 
                  type="text" 
                  id="promptpay-name"
                  value="${this.settings?.promptpay_name || ''}"
                  placeholder="ชื่อเจ้าของบัญชี PromptPay"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <!-- QR Code Preview -->
            <div class="mt-6 p-4 border border-gray-200 rounded-lg">
              <h4 class="font-semibold text-gray-900 mb-3">ตัวอย่าง QR Code</h4>
              <div id="qr-code-preview" class="flex items-center justify-center h-32 bg-gray-50 rounded border-2 border-dashed border-gray-300">
                <span class="text-gray-500 text-sm">กรอกข้อมูล PromptPay เพื่อสร้าง QR Code</span>
              </div>
              <button 
                type="button" 
                onclick="paymentSettingsManager.generateQRPreview()"
                class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                สร้าง QR Code ตัวอย่าง
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * การตั้งค่าโอนผ่านธนาคาร
   */
  renderBankTransferSettings() {
    return `
      <div class="bg-white rounded-xl shadow-sm p-8">
        <h2 class="text-xl font-bold mb-6 text-indigo-700 flex items-center gap-2">
          <i data-lucide="building-2" class="w-5 h-5"></i> โอนผ่านธนาคาร
        </h2>
        
        <div class="space-y-6">
          <!-- Enable/Disable -->
          <div class="flex items-center justify-between p-4 bg-green-50 rounded-lg">
            <div>
              <h3 class="font-semibold text-gray-900">เปิดใช้งานโอนผ่านธนาคาร</h3>
              <p class="text-sm text-gray-600">ลูกค้าสามารถโอนเงินเข้าบัญชีธนาคารของร้าน</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                id="bank-transfer-enabled"
                ${this.settings?.bank_transfer_enabled ? 'checked' : ''}
                class="sr-only peer"
                onchange="paymentSettingsManager.toggleBankTransfer(this.checked)"
              >
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          <!-- Bank Accounts -->
          <div id="bank-accounts-section" class="${!this.settings?.bank_transfer_enabled ? 'hidden' : ''}">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold text-gray-900">บัญชีธนาคาร</h3>
              <button 
                type="button" 
                onclick="paymentSettingsManager.addBankAccount()"
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center"
              >
                <i data-lucide="plus" class="w-4 h-4 mr-2"></i>
                เพิ่มบัญชี
              </button>
            </div>

            <div id="bank-accounts-list" class="space-y-4">
              ${this.renderBankAccountsList()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ตัวเลือกธนาคาร
   */
  renderBankOptions(selectedBank = '') {
    const banks = [
      { name: 'ธนาคารกรุงเทพ', code: 'BBL', icon: 'https://upload.wikimedia.org/wikipedia/th/8/83/Bangkok_Bank_Logo.svg' },
      { name: 'ธนาคารกสิกรไทย', code: 'KBANK', icon: 'https://upload.wikimedia.org/wikipedia/th/2/25/Kasikornbank_logo.svg' },
      { name: 'ธนาคารไทยพาณิชย์', code: 'SCB', icon: 'https://upload.wikimedia.org/wikipedia/th/3/36/SCB_Logo.svg' },
      { name: 'ธนาคารกรุงไทย', code: 'KTB', icon: 'https://upload.wikimedia.org/wikipedia/th/3/30/Krungthai_Bank_Logo.svg' },
      { name: 'ธนาคารทหารไทยธนชาต', code: 'TTB', icon: 'https://upload.wikimedia.org/wikipedia/th/0/0a/TMBThanachart_Bank_logo.svg' },
      { name: 'ธนาคารกรุงศรีอยุธยา', code: 'BAY', icon: 'https://upload.wikimedia.org/wikipedia/th/f/f7/Krungsri_logo.svg' },
      { name: 'ธนาคารเกียรตินาคินภัทร', code: 'KKP', icon: 'https://upload.wikimedia.org/wikipedia/th/d/d8/Kiatnakin_Phatra_Bank_Logo.svg' },
      { name: 'ธนาคารซีไอเอ็มบี ไทย', code: 'CIMB', icon: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/CIMB_Bank_Logo.svg' },
      { name: 'ธนาคารยูโอบี', code: 'UOB', icon: 'https://upload.wikimedia.org/wikipedia/commons/1/1e/UOB_Logo.svg' },
      { name: 'ธนาคารสแตนดาร์ดชาร์เตอร์ด', code: 'SCBT', icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Standard_Chartered_logo.svg' },
      { name: 'ธนาคารอาคารสงเคราะห์', code: 'GSB', icon: 'https://upload.wikimedia.org/wikipedia/th/0/0b/Government_Savings_Bank_Logo.svg' },
      { name: 'ธนาคารออมสิน', code: 'BAAC', icon: 'https://upload.wikimedia.org/wikipedia/th/7/7e/Bank_for_Agriculture_and_Agricultural_Cooperatives_Logo.svg' },
      { name: 'ธนาคารอิสลามแห่งประเทศไทย', code: 'IBANK', icon: 'https://upload.wikimedia.org/wikipedia/th/a/a6/Islamic_Bank_of_Thailand_Logo.svg' }
    ];

    return banks.map(bank => 
      `<option value="${bank.name}" data-icon="${bank.icon}" data-code="${bank.code}" ${selectedBank === bank.name ? 'selected' : ''}>${bank.name}</option>`
    ).join('');
  }

  /**
   * รายการบัญชีธนาคาร
   */
   renderBankAccountsList() {
    const accounts = this.settings?.bank_accounts || [];
    
    if (accounts.length === 0) {
      return `
        <div class="text-center py-8 text-gray-500">
          <i data-lucide="building-2" class="w-8 h-8 mx-auto mb-2"></i>
          <p>ยังไม่มีบัญชีธนาคาร</p>
          <p class="text-sm">เพิ่มบัญชีธนาคารเพื่อให้ลูกค้าสามารถโอนเงินได้</p>
        </div>
      `;
    }

    return accounts.map((account, index) => `
      <div class="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
        <!-- ส่วนหัวของบัญชี -->
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <h4 class="font-semibold text-gray-900 flex items-center">
            <i data-lucide="building-2" class="w-4 h-4 mr-2 text-green-600"></i>
            บัญชีธนาคาร #${index + 1}
          </h4>
          <button 
            type="button" 
            onclick="paymentSettingsManager.removeBankAccount(${index})"
            class="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm flex items-center transition-colors"
            title="ลบบัญชีนี้"
          >
            <i data-lucide="trash-2" class="w-4 h-4 mr-1"></i>
            ลบ
          </button>
        </div>

        <div class="space-y-4">
          <!-- Row 1: ธนาคารและไอคอน -->
          <div class="grid grid-cols-1 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                <i data-lucide="building" class="inline w-4 h-4 mr-1"></i>
                ธนาคาร
              </label>
              <div class="relative">
                <select 
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 pr-12 text-sm"
                  data-account-index="${index}"
                  data-field="bank_name"
                  onchange="paymentSettingsManager.updateBankAccount(${index}, 'bank_name', this.value); paymentSettingsManager.updateBankIcon(${index}, this);"
                >
                  <option value="">🏦 เลือกธนาคาร</option>
                  ${this.renderBankOptions(account.bank_name)}
                </select>
                ${account.bank_icon ? `
                  <div class="absolute right-10 top-1/2 transform -translate-y-1/2">
                    <img src="${account.bank_icon}" alt="${account.bank_name}" class="w-6 h-6 object-contain">
                  </div>
                ` : ''}
              </div>
              
              <!-- Custom Icon Upload -->
              <div class="mt-2 p-3 bg-gray-50 rounded-lg">
                <label class="block text-xs font-medium text-gray-600 mb-2">
                  <i data-lucide="upload" class="inline w-3 h-3 mr-1"></i>
                  อัปโหลดไอคอนธนาคารเอง (ไม่บังคับ)
                </label>
                <div class="flex gap-2">
                  <input 
                    type="file" 
                    accept="image/*"
                    class="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 bg-white file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    onchange="uploadCustomBankIcon(${index}, this)"
                  />
                  ${account.bank_icon ? `
                    <button
                      type="button"
                      onclick="removeBankIcon(${index})"
                      class="px-2 py-1.5 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors flex items-center"
                      title="ลบไอคอน"
                    >
                      <i data-lucide="x" class="w-3 h-3 mr-1"></i>
                      ลบ
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- Row 2: ชื่อบัญชีและเลขที่บัญชี -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <!-- ชื่อบัญชี -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                <i data-lucide="user" class="inline w-4 h-4 mr-1"></i>
                ชื่อเจ้าของบัญชี
              </label>
              <input 
                type="text" 
                value="${account.account_name || ''}"
                placeholder="นาย/นาง ชื่อเจ้าของบัญชี"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                onchange="paymentSettingsManager.updateBankAccount(${index}, 'account_name', this.value)"
              />
            </div>

            <!-- เลขที่บัญชี พร้อมปุ่มคัดลอก -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                <i data-lucide="credit-card" class="inline w-4 h-4 mr-1"></i>
                เลขที่บัญชี
              </label>
              <div class="relative">
                <input 
                  type="text" 
                  value="${account.account_number || ''}"
                  placeholder="xxx-x-xxxxx-x"
                  class="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm font-mono"
                  onchange="paymentSettingsManager.updateBankAccount(${index}, 'account_number', this.value)"
                />
                <button
                  type="button"
                  onclick="copyAccountNumber('${account.account_number || ''}')"
                  class="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                  title="คัดลอกเลขบัญชี"
                  ${!account.account_number ? 'disabled' : ''}
                >
                  <i data-lucide="copy" class="w-4 h-4"></i>
                </button>
              </div>
              ${account.account_number ? `
                <p class="text-xs text-gray-500 mt-1 flex items-center">
                  <i data-lucide="info" class="w-3 h-3 mr-1"></i>
                  คลิกปุ่มเพื่อคัดลอกเลขบัญชี
                </p>
              ` : `
                <p class="text-xs text-orange-500 mt-1 flex items-center">
                  <i data-lucide="alert-triangle" class="w-3 h-3 mr-1"></i>
                  กรุณากรอกเลขที่บัญชี
                </p>
              `}
            </div>
          </div>

          <!-- Row 3: สาขา (ไม่บังคับ) -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                <i data-lucide="map-pin" class="inline w-4 h-4 mr-1"></i>
                สาขา <span class="text-gray-400 text-xs">(ไม่บังคับ)</span>
              </label>
              <input 
                type="text" 
                value="${account.branch || ''}"
                placeholder="สาขาหลัก, สาขาเซ็นทรัล, ฯลฯ"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                onchange="paymentSettingsManager.updateBankAccount(${index}, 'branch', this.value)"
              />
            </div>
            
            <!-- สถานะและการตรวจสอบ -->
            <div class="flex items-end">
              <div class="w-full p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-medium text-blue-800">สถานะบัญชี</p>
                    <p class="text-xs text-blue-600">
                      ${account.bank_name && account.account_number && account.account_name ? 
                        '✅ ข้อมูลครบถ้วน' : 
                        '⚠️ ข้อมูลไม่ครบ'
                      }
                    </p>
                  </div>
                  ${account.bank_name && account.account_number && account.account_name ? `
                    <div class="text-green-500">
                      <i data-lucide="check-circle" class="w-5 h-5"></i>
                    </div>
                  ` : `
                    <div class="text-orange-500">
                      <i data-lucide="alert-circle" class="w-5 h-5"></i>
                    </div>
                  `}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  /**
   * การตั้งค่าเก็บเงินปลายทาง
   */
  renderCODSettings() {
    return `
      <div class="bg-white rounded-xl shadow-sm p-8">
        <h2 class="text-xl font-bold mb-6 text-indigo-700 flex items-center gap-2">
          <i data-lucide="truck" class="w-5 h-5"></i> เก็บเงินปลายทาง (COD)
        </h2>
        
        <div class="space-y-6">
          <!-- Enable/Disable -->
          <div class="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
            <div>
              <h3 class="font-semibold text-gray-900">เปิดใช้งานเก็บเงินปลายทาง</h3>
              <p class="text-sm text-gray-600">ลูกค้าสามารถชำระเงินเมื่อได้รับสินค้า</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                id="cod-enabled"
                ${this.settings?.cod_enabled ? 'checked' : ''}
                class="sr-only peer"
                onchange="paymentSettingsManager.toggleCOD(this.checked)"
              >
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
            </label>
          </div>

          <!-- COD Settings -->
          <div id="cod-settings-form" class="${!this.settings?.cod_enabled ? 'hidden' : ''}">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">ค่าธรรมเนียม COD (บาท)</label>
                <input 
                  type="number" 
                  id="cod-fee"
                  value="${this.settings?.cod_fee || 0}"
                  min="0"
                  step="0.01"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="0.00"
                />
                <p class="text-xs text-gray-500 mt-1">ค่าธรรมเนียมเพิ่มเติมสำหรับ COD</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">ยอดสูงสุดสำหรับ COD (บาท)</label>
                <input 
                  type="number" 
                  id="cod-max-amount"
                  value="${this.settings?.cod_max_amount || 0}"
                  min="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="ไม่จำกัด"
                />
                <p class="text-xs text-gray-500 mt-1">ยอดสูงสุดที่อนุญาตให้ใช้ COD (0 = ไม่จำกัด)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * การตั้งค่าการตรวจสอบอัตโนมัติ
   */
  renderAutoVerificationSettings() {
    return `
      <div class="bg-white rounded-xl shadow-sm p-8">
        <h2 class="text-xl font-bold mb-6 text-indigo-700 flex items-center gap-2">
          <i data-lucide="shield-check" class="w-5 h-5"></i> การตรวจสอบอัตโนมัติ
        </h2>
        
        <div class="space-y-6">
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div class="flex">
              <i data-lucide="info" class="w-5 h-5 text-yellow-600 mr-2 mt-0.5"></i>
              <div class="text-sm">
                <p class="text-yellow-800 font-medium">ฟีเจอร์ในอนาคต</p>
                <p class="text-yellow-700 mt-1">ระบบตรวจสอบสลิปอัตโนมัติจะพร้อมใช้งานในเวอร์ชันถัดไป</p>
              </div>
            </div>
          </div>

          <!-- Enable/Disable -->
          <div class="flex items-center justify-between p-4 bg-purple-50 rounded-lg opacity-50">
            <div>
              <h3 class="font-semibold text-gray-900">เปิดใช้งานการตรวจสอบอัตโนมัติ</h3>
              <p class="text-sm text-gray-600">ระบบจะตรวจสอบสลิปโอนเงินอัตโนมัติ</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                id="auto-verify-enabled"
                disabled
                class="sr-only peer"
              >
              <div class="w-11 h-6 bg-gray-200 rounded-full peer"></div>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * การตั้งค่าทั่วไป
   */
  renderGeneralSettings() {
    return `
      <div class="bg-white rounded-xl shadow-sm p-8">
        <h2 class="text-xl font-bold mb-6 text-indigo-700 flex items-center gap-2">
          <i data-lucide="settings" class="w-5 h-5"></i> การตั้งค่าทั่วไป
        </h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">ระยะเวลาชำระเงิน (ชั่วโมง)</label>
            <input 
              type="number" 
              id="payment-timeout"
              value="${this.settings?.payment_timeout_hours || 24}"
              min="1"
              max="168"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p class="text-xs text-gray-500 mt-1">เวลาที่ลูกค้ามีในการชำระเงิน</p>
          </div>

          <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h3 class="font-semibold text-gray-900">ต้องการหลักฐานการชำระเงิน</h3>
              <p class="text-sm text-gray-600">บังคับให้ลูกค้าอัปโหลดสลิปโอนเงิน</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                id="require-payment-proof"
                ${this.settings?.require_payment_proof ? 'checked' : ''}
                class="sr-only peer"
              >
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup Event Handlers
   */
  setupEventHandlers() {
    // PromptPay QR Type change
    const qrTypeSelect = document.getElementById('promptpay-qr-type');
    if (qrTypeSelect) {
      qrTypeSelect.addEventListener('change', (e) => {
        this.updatePromptPayLabels(e.target.value);
      });
    }
  }

  /**
   * Toggle PromptPay
   */
  togglePromptPay(enabled) {
    const form = document.getElementById('promptpay-settings-form');
    if (form) {
      if (enabled) {
        form.classList.remove('hidden');
      } else {
        form.classList.add('hidden');
      }
    }
  }

  /**
   * Toggle Bank Transfer
   */
  toggleBankTransfer(enabled) {
    const section = document.getElementById('bank-accounts-section');
    if (section) {
      if (enabled) {
        section.classList.remove('hidden');
      } else {
        section.classList.add('hidden');
      }
    }
  }

  /**
   * Toggle COD
   */
  toggleCOD(enabled) {
    const form = document.getElementById('cod-settings-form');
    if (form) {
      if (enabled) {
        form.classList.remove('hidden');
      } else {
        form.classList.add('hidden');
      }
    }
  }

  /**
   * Update PromptPay Labels
   */
  updatePromptPayLabels(type) {
    const label = document.getElementById('promptpay-id-label');
    const input = document.getElementById('promptpay-id');
    
    if (type === 'tax_id') {
      if (label) label.textContent = 'เลขประจำตัวผู้เสียภาษี';
      if (input) input.placeholder = '1234567890123';
    } else {
      if (label) label.textContent = 'เบอร์โทรศัพท์';
      if (input) input.placeholder = '0812345678';
    }
  }

  /**
   * อัปเดต Bank Account และ Icon เมื่อเลือกธนาคาร
   */
  updateBankIcon(accountIndex, selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const iconUrl = selectedOption.getAttribute('data-icon');
    
    if (iconUrl && this.settings.bank_accounts[accountIndex]) {
      this.settings.bank_accounts[accountIndex].bank_icon = iconUrl;
      
      // รีเฟรชการแสดงผลทันที
      this.refreshBankAccountsList();
    }
  }

  /**
   * อัปโหลดไอคอนธนาคารแบบกำหนดเอง
   */
  async uploadCustomBankIcon(accountIndex, fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    // ตรวจสอบขนาดไฟล์
    if (file.size > 1024 * 1024) { // 1MB
      Swal.fire({
        icon: 'warning',
        title: 'ไฟล์ใหญ่เกินไป',
        text: 'กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 1MB'
      });
      fileInput.value = '';
      return;
    }

    // ตรวจสอบประเภทไฟล์
    if (!file.type.startsWith('image/')) {
      Swal.fire({
        icon: 'warning',
        title: 'ประเภทไฟล์ไม่ถูกต้อง',
        text: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น'
      });
      fileInput.value = '';
      return;
    }

    try {
      // สร้าง FormData สำหรับอัปโหลด
      const formData = new FormData();
      formData.append('icon', file);
      formData.append('accountIndex', accountIndex.toString());

      // แสดง loading
      Swal.fire({
        title: 'กำลังอัปโหลด...',
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
          Swal.showLoading();
        }
      });

      // อัปโหลดไฟล์
      const response = await fetch('/api/admin/payment-settings/upload-bank-icon', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // อัปเดตข้อมูลในหน่วยความจำ
        if (!this.settings.bank_accounts[accountIndex]) {
          this.settings.bank_accounts[accountIndex] = {};
        }
        this.settings.bank_accounts[accountIndex].bank_icon = result.iconUrl;

        // บันทึกการตั้งค่าทันที
        await this.saveAllSettings();

        // รีเฟรชรายการ
        this.refreshBankAccountsList();

        Swal.fire({
          icon: 'success',
          title: 'อัปโหลดสำเร็จ',
          text: 'ไอคอนธนาคารถูกอัปโหลดและบันทึกเรียบร้อยแล้ว',
          timer: 1500,
          showConfirmButton: false
        });

      } else {
        throw new Error(result.message || 'อัปโหลดไม่สำเร็จ');
      }

    } catch (error) {
      console.error('Error uploading bank icon:', error);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: error.message || 'ไม่สามารถอัปโหลดไอคอนได้'
      });
    } finally {
      // ล้างค่าไฟล์ input
      fileInput.value = '';
    }
  }

  /**
   * ลบไอคอนธนาคาร
   */
  async removeBankIcon(accountIndex) {
    const result = await Swal.fire({
      title: 'ลบไอคอนธนาคาร?',
      text: 'คุณต้องการลบไอคอนธนาคารนี้หรือไม่?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626'
    });

    if (result.isConfirmed) {
      if (this.settings.bank_accounts[accountIndex]) {
        this.settings.bank_accounts[accountIndex].bank_icon = null;
        
        // บันทึกการตั้งค่าทันที
        await this.saveAllSettings();
        
        this.refreshBankAccountsList();
        
        Swal.fire({
          icon: 'success',
          title: 'ลบเรียบร้อย',
          text: 'ลบไอคอนธนาคารแล้ว',
          timer: 1500,
          showConfirmButton: false
        });
      }
    }
  }

  /**
   * คัดลอกเลขที่บัญชี
   */
  async copyAccountNumber(accountNumber) {
    if (!accountNumber) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่มีเลขที่บัญชี',
        text: 'กรุณากรอกเลขที่บัญชีก่อน',
        timer: 1500,
        showConfirmButton: false
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(accountNumber);
      
      // แสดง toast notification แบบสวย
      this.showSuccessToast(`คัดลอกเลขบัญชี ${accountNumber} แล้ว`);
      
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      
      // Fallback สำหรับเบราว์เซอร์เก่า
      const textArea = document.createElement('textarea');
      textArea.value = accountNumber;
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        document.execCommand('copy');
        this.showSuccessToast(`คัดลอกเลขบัญชี ${accountNumber} แล้ว`);
      } catch (fallbackError) {
        Swal.fire({
          icon: 'error',
          title: 'ไม่สามารถคัดลอกได้',
          text: 'กรุณาคัดลอกด้วยตัวเอง: ' + accountNumber
        });
      }
      
      document.body.removeChild(textArea);
    }
  }

  /**
   * แสดง Success Toast
   */
  showSuccessToast(message) {
    // ลบ toast เก่าถ้ามี
    const existingToast = document.getElementById('success-toast');
    if (existingToast) {
      existingToast.remove();
    }

    // สร้าง toast ใหม่
    const toast = document.createElement('div');
    toast.id = 'success-toast';
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 transform translate-x-full';
    toast.innerHTML = `
      <div class="flex items-center">
        <i data-lucide="check-circle" class="w-5 h-5 mr-2"></i>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // สร้าง lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    
    // แสดง toast
    setTimeout(() => {
      toast.classList.remove('translate-x-full');
    }, 100);
    
    // ซ่อน toast หลัง 3 วินาที
    setTimeout(() => {
      toast.classList.add('translate-x-full');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  /**
   * Generate QR Preview
   */
  async generateQRPreview() {
    const promptpayId = document.getElementById('promptpay-id')?.value;
    const amount = 100; // ตัวอย่าง 100 บาท
    
    if (!promptpayId) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณากรอกข้อมูล',
        text: 'กรุณากรอกเบอร์โทรศัพท์หรือเลขประจำตัวผู้เสียภาษี'
      });
      return;
    }

    const previewContainer = document.getElementById('qr-code-preview');
    if (previewContainer) {
      previewContainer.innerHTML = `
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p class="text-sm text-gray-500">กำลังสร้าง QR Code...</p>
        </div>
      `;

      // จำลองการสร้าง QR Code
      setTimeout(() => {
        previewContainer.innerHTML = `
          <div class="text-center">
            <div class="w-24 h-24 bg-gray-900 mx-auto mb-2 flex items-center justify-center text-white text-xs">
              QR CODE<br/>ตัวอย่าง<br/>${promptpayId}<br/>฿${amount}
            </div>
            <p class="text-sm text-gray-600">ตัวอย่าง QR Code สำหรับ ฿${amount}</p>
          </div>
        `;
      }, 1000);
    }
  }

  /**
   * Save All Settings
   */
  async saveAllSettings() {
    const submitBtn = document.getElementById('save-payment-settings-btn');
    const submitText = document.getElementById('save-payment-settings-text');
    const submitLoading = document.getElementById('save-payment-settings-loading');

    try {
      // Show loading state
      if (submitBtn) submitBtn.disabled = true;
      if (submitText) submitText.textContent = 'กำลังบันทึก...';
      if (submitLoading) submitLoading.classList.remove('hidden');

      // Collect all settings
      const settings = this.collectAllSettings();

      console.log('💾 Saving payment settings:', settings);

      // Send to API
      const response = await fetch('/api/admin/payment-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        await Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ!',
          text: 'การตั้งค่าวิธีการชำระเงินถูกบันทึกเรียบร้อยแล้ว',
          timer: 2000,
          showConfirmButton: false
        });

        // Update local settings
        this.settings = settings;

        // Refresh overview
        this.refreshPaymentMethodsOverview();

      } else {
        throw new Error(result.message || 'บันทึกไม่สำเร็จ');
      }

    } catch (error) {
      console.error('❌ Error saving payment settings:', error);
      await Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด!',
        text: error.message || 'ไม่สามารถบันทึกการตั้งค่าได้'
      });

    } finally {
      // Reset button state
      if (submitBtn) submitBtn.disabled = false;
      if (submitText) submitText.textContent = 'บันทึกการตั้งค่า';
      if (submitLoading) submitLoading.classList.add('hidden');
    }
  }

  /**
   * Collect All Settings from Form
   */
  collectAllSettings() {
    return {
      // PromptPay
      promptpay_enabled: document.getElementById('promptpay-enabled')?.checked || false,
      promptpay_qr_type: document.getElementById('promptpay-qr-type')?.value || 'phone',
      promptpay_id: document.getElementById('promptpay-id')?.value || '',
      promptpay_name: document.getElementById('promptpay-name')?.value || '',

      // Bank Transfer
      bank_transfer_enabled: document.getElementById('bank-transfer-enabled')?.checked || false,
      bank_accounts: this.settings?.bank_accounts || [],

      // COD
      cod_enabled: document.getElementById('cod-enabled')?.checked || false,
      cod_fee: parseFloat(document.getElementById('cod-fee')?.value || 0),
      cod_max_amount: parseFloat(document.getElementById('cod-max-amount')?.value || 0),

      // Auto Verification
      auto_verify_enabled: false, // ยังไม่เปิดใช้งาน

      // General
      payment_timeout_hours: parseInt(document.getElementById('payment-timeout')?.value || 24),
      require_payment_proof: document.getElementById('require-payment-proof')?.checked || true
    };
  }

  /**
   * Refresh Payment Methods Overview
   */
  refreshPaymentMethodsOverview() {
    // Implementation for refreshing the overview section
    // This would typically re-render the overview section with updated data
    console.log('🔄 Refreshing payment methods overview...');
  }

  /**
   * Reset Settings
   */
  async resetSettings() {
    const result = await Swal.fire({
      title: 'รีเซ็ตการตั้งค่า?',
      text: 'การดำเนินการนี้จะรีเซ็ตการตั้งค่าทั้งหมดกลับเป็นค่าเริ่มต้น',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'รีเซ็ต',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626'
    });

    if (result.isConfirmed) {
      this.settings = this.getDefaultSettings();
      await this.renderPaymentSettingsPage();
      
      Swal.fire({
        icon: 'success',
        title: 'รีเซ็ตเรียบร้อย',
        text: 'การตั้งค่าถูกรีเซ็ตกลับเป็นค่าเริ่มต้นแล้ว',
        timer: 1500,
        showConfirmButton: false
      });
    }
  }

  /**
   * Render Loading State
   */
  renderLoadingState() {
    return `
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p class="text-gray-600">กำลังโหลดการตั้งค่าวิธีการชำระเงิน...</p>
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
            onclick="paymentSettingsManager.renderPaymentSettingsPage()" 
            class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
          >
            ลองใหม่
          </button>
        </div>
      `;
      
      // Re-initialize icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }

  /**
   * Add Bank Account
   */
  addBankAccount() {
    if (!this.settings.bank_accounts) {
      this.settings.bank_accounts = [];
    }

    this.settings.bank_accounts.push({
      bank_name: '',
      account_number: '',
      account_name: '',
      branch: '',
      bank_icon: null
    });

    this.refreshBankAccountsList();
    
    // Scroll to new account
    setTimeout(() => {
      const newAccountElement = document.querySelector('[data-account-index="' + (this.settings.bank_accounts.length - 1) + '"]');
      if (newAccountElement) {
        newAccountElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  /**
   * Remove Bank Account
   */
  async removeBankAccount(index) {
    const result = await Swal.fire({
      title: 'ลบบัญชีธนาคาร?',
      text: 'คุณต้องการลบบัญชีธนาคารนี้หรือไม่?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626'
    });

    if (result.isConfirmed) {
      if (this.settings.bank_accounts && this.settings.bank_accounts[index]) {
        this.settings.bank_accounts.splice(index, 1);
        this.refreshBankAccountsList();
        
        Swal.fire({
          icon: 'success',
          title: 'ลบเรียบร้อย',
          text: 'ลบบัญชีธนาคารแล้ว',
          timer: 1500,
          showConfirmButton: false
        });
      }
    }
  }

  /**
   * Update Bank Account
   */
  updateBankAccount(index, field, value) {
    if (this.settings.bank_accounts && this.settings.bank_accounts[index]) {
      this.settings.bank_accounts[index][field] = value;
    }
  }

  /**
   * Refresh Bank Accounts List
   */
  refreshBankAccountsList() {
    const container = document.getElementById('bank-accounts-list');
    if (container) {
      container.innerHTML = this.renderBankAccountsList();
      
      // โหลด lucide icons ใหม่
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }
}





// Export class to global scope
window.PaymentSettingsManager = PaymentSettingsManager;

// สร้าง instance global
if (!window.paymentSettingsManager) {
  window.paymentSettingsManager = new PaymentSettingsManager();
}

// ✅ Export methods to global scope สำหรับ onclick handlers
window.uploadCustomBankIcon = function(accountIndex, fileInput) {
  if (window.paymentSettingsManager) {
    window.paymentSettingsManager.uploadCustomBankIcon(accountIndex, fileInput);
  } else {
    console.error('PaymentSettingsManager not initialized');
  }
};

window.removeBankIcon = function(accountIndex) {
  if (window.paymentSettingsManager) {
    window.paymentSettingsManager.removeBankIcon(accountIndex);
  } else {
    console.error('PaymentSettingsManager not initialized');
  }
};

window.copyAccountNumber = function(accountNumber) {
  if (window.paymentSettingsManager) {
    window.paymentSettingsManager.copyAccountNumber(accountNumber);
  } else {
    console.error('PaymentSettingsManager not initialized');
  }
};

window.addBankAccount = function() {
  if (window.paymentSettingsManager) {
    window.paymentSettingsManager.addBankAccount();
  } else {
    console.error('PaymentSettingsManager not initialized');
  }
};

window.removeBankAccount = function(index) {
  if (window.paymentSettingsManager) {
    window.paymentSettingsManager.removeBankAccount(index);
  } else {
    console.error('PaymentSettingsManager not initialized');
  }
};

window.updateBankAccount = function(index, field, value) {
  if (window.paymentSettingsManager) {
    window.paymentSettingsManager.updateBankAccount(index, field, value);
  } else {
    console.error('PaymentSettingsManager not initialized');
  }
};

window.updateBankIcon = function(accountIndex, selectElement) {
  if (window.paymentSettingsManager) {
    window.paymentSettingsManager.updateBankIcon(accountIndex, selectElement);
  } else {
    console.error('PaymentSettingsManager not initialized');
  }
};

console.log('💳 Payment Settings Manager loaded successfully');