// Main Application Logic

// API URL
const API_BASE_URL = '/api';


// Routes and Views
const routes = {
  '/admin': showDashboard,
  '/admin/products-list': showProductsList,
  '/admin/categories': showCategories,
  '/admin/orders': showOrders,
  '/admin/customers': showCustomers,
  '/admin/coupons': showCoupons,  
  '/admin/alerts': showAlertsPage,
  '/admin/reports': showReports,
  '/admin/settings': showSettings,
  '/admin/products/create': showCreateProduct,
  '/admin/settings/home': showSettings, 
  '/admin/settings/about': showSettings, 
  '/admin/settings/contact': () => window.contactMessagesManager.renderContactSettingPage(),
  '/admin/settings/logo': showLogoSettings,
  '/admin/settings/payments': showPaymentSettings,

  
};



/**
 * ฟังก์ชันอัปโหลดรูปภาพไป Supabase (Global Function)
 * @param {File} file - ไฟล์รูปภาพที่จะอัปโหลด
 * @returns {Promise<string>} - URL ของรูปภาพที่อัปโหลดแล้ว
 */
async function uploadImageToSupabase(file) {
  console.log('📤 Starting image upload to Supabase:', file.name);
  
  if (!file) {
    throw new Error('ไม่มีไฟล์ที่จะอัปโหลด');
  }

  // ตรวจสอบประเภทไฟล์
  if (!file.type.startsWith('image/')) {
    throw new Error('ไฟล์ต้องเป็นรูปภาพเท่านั้น');
  }

  // ตรวจสอบขนาดไฟล์ (5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5MB');
  }

  try {
    // สร้าง FormData สำหรับอัปโหลด
    const formData = new FormData();
    formData.append('images', file);
    
    console.log('📡 Uploading to /api/upload...');
    
    // อัปโหลดไปยัง API
    const uploadResponse = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    console.log('📡 Upload response status:', uploadResponse.status);
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ Upload failed:', errorText);
      throw new Error(`อัปโหลดไม่สำเร็จ: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }
    
    const uploadResult = await uploadResponse.json();
    console.log('✅ Upload result:', uploadResult);
    
    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'อัปโหลดไม่สำเร็จ');
    }
    
    if (!uploadResult.urls || uploadResult.urls.length === 0) {
      throw new Error('ไม่ได้รับ URL ของรูปภาพที่อัปโหลด');
    }
    
    const imageUrl = uploadResult.urls[0];
    console.log('🖼️ Image uploaded successfully:', imageUrl);
    
    return imageUrl;
    
  } catch (error) {
    console.error('❌ Error in uploadImageToSupabase:', error);
    throw new Error(`ไม่สามารถอัปโหลดรูปภาพได้: ${error.message}`);
  }
}

/**
 * ฟังก์ชันตรวจสอบความถูกต้องของไฟล์รูปภาพ
 * @param {File} file - ไฟล์ที่จะตรวจสอบ
 * @returns {boolean} - true ถ้าไฟล์ถูกต้อง
 */
function validateImageFile(file) {
  if (!file) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพ');
  }
  
  // ตรวจสอบประเภทไฟล์
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('รองรับเฉพาะไฟล์ JPG, PNG, GIF และ WebP เท่านั้น');
  }
  
  // ตรวจสอบขนาดไฟล์ (5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5MB');
  }
  
  return true;
}

/**
 * ฟังก์ชันแสดงตัวอย่างรูปภาพ
 * @param {File} file - ไฟล์รูปภาพ
 * @param {string} previewElementId - ID ของ element ที่จะแสดงตัวอย่าง
 */
function showImagePreview(file, previewElementId) {
  const previewElement = document.getElementById(previewElementId);
  if (!previewElement) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    previewElement.innerHTML = `
      <img src="${e.target.result}" alt="Preview" class="w-32 h-32 object-cover rounded border">
    `;
  };
  reader.readAsDataURL(file);
}

function showLogoSettings() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  mainContent.innerHTML = `
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
            <h1 class="text-2xl font-bold text-gray-900">จัดการ Logo</h1>
            <p class="text-sm text-gray-600">อัปโหลดและตั้งค่า Logo สำหรับเว็บไซต์</p>
          </div>
        </div>
      </div>

      <!-- Current Logo Display -->
      <div id="current-logo-section" class="bg-white rounded-xl shadow-sm p-8">
        <h2 class="text-xl font-bold mb-6 text-indigo-700 flex items-center gap-2">
          <i data-lucide="eye" class="w-5 h-5"></i> Logo ปัจจุบัน
        </h2>
        
        <div id="current-logo-display" class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- Loading state -->
          <div class="col-span-full text-center py-8 text-gray-500">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
            กำลังโหลดข้อมูล Logo...
          </div>
        </div>
      </div>

      <!-- Logo Upload Form -->
      <div class="bg-white rounded-xl shadow-sm p-8">
        <h2 class="text-xl font-bold mb-6 text-indigo-700 flex items-center gap-2">
          <i data-lucide="upload" class="w-5 h-5"></i> อัปโหลด Logo ใหม่
        </h2>
        
        <form id="logo-upload-form" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Main Logo Upload -->
            <div class="space-y-4">
              <h3 class="font-semibold text-gray-800">Logo หลัก (Light Mode)</h3>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">อัปโหลด Logo</label>
                <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-indigo-400 transition-colors">
                  <div class="space-y-1 text-center">
                    <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <div class="flex text-sm text-gray-600">
                      <label for="main-logo-upload" class="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                        <span>อัปโหลดไฟล์</span>
                        <input id="main-logo-upload" name="main-logo" type="file" accept="image/*" class="sr-only" onchange="previewMainLogo(this)">
                      </label>
                      <p class="pl-1">หรือลากไฟล์มาวาง</p>
                    </div>
                    <p class="text-xs text-gray-500">PNG, JPG, SVG ขนาดไม่เกิน 5MB</p>
                  </div>
                </div>
                <div id="main-logo-preview" class="mt-3 hidden">
                  <!-- Preview will be shown here -->
                </div>
              </div>
            </div>

            <!-- Dark Logo Upload -->
            <div class="space-y-4">
              <h3 class="font-semibold text-gray-800">Logo สำหรับ Dark Mode</h3>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">อัปโหลด Dark Logo (เลือกได้)</label>
                <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-600 transition-colors">
                  <div class="space-y-1 text-center">
                    <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <div class="flex text-sm text-gray-600">
                      <label for="dark-logo-upload" class="relative cursor-pointer bg-white rounded-md font-medium text-gray-600 hover:text-gray-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-gray-500">
                        <span>อัปโหลดไฟล์</span>
                        <input id="dark-logo-upload" name="dark-logo" type="file" accept="image/*" class="sr-only" onchange="previewDarkLogo(this)">
                      </label>
                      <p class="pl-1">หรือลากไฟล์มาวาง</p>
                    </div>
                    <p class="text-xs text-gray-500">สำหรับธีมมืด (เลือกได้)</p>
                  </div>
                </div>
                <div id="dark-logo-preview" class="mt-3 hidden">
                  <!-- Preview will be shown here -->
                </div>
              </div>
            </div>
          </div>

          <!-- Logo Settings -->
          <div class="border-t pt-6">
            <h3 class="font-semibold text-gray-800 mb-4">ตั้งค่า Logo</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Alt Text</label>
                <input 
                  type="text" 
                  id="logo-alt-text"
                  placeholder="AquaRoom Logo"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">ความกว้าง (px)</label>
                <input 
                  type="number" 
                  id="logo-width"
                  value="120"
                  min="50"
                  max="300"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">ความสูง (px)</label>
                <input 
                  type="number" 
                  id="logo-height"
                  value="40"
                  min="20"
                  max="100"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <!-- Live Preview -->
          <div class="border-t pt-6">
            <h3 class="font-semibold text-gray-800 mb-4">ตัวอย่าง Logo</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Light Mode Preview -->
              <div class="border border-gray-200 rounded-lg p-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Light Mode</label>
                <div id="logo-preview-light" class="min-h-16 bg-white border border-gray-300 rounded flex items-center justify-center">
                  <span class="text-gray-500 text-sm">อัปโหลด logo เพื่อดูตัวอย่าง</span>
                </div>
              </div>
              
              <!-- Dark Mode Preview -->
              <div class="border border-gray-200 rounded-lg p-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Dark Mode</label>
                <div id="logo-preview-dark" class="min-h-16 bg-gray-900 border border-gray-700 rounded flex items-center justify-center">
                  <span class="text-gray-400 text-sm">อัปโหลด dark logo เพื่อดูตัวอย่าง</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Submit Buttons -->
          <div class="flex justify-end space-x-3 pt-6 border-t">
            <button 
              type="button" 
              onclick="loadCurrentLogos()" 
              class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center"
            >
              <i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i>
              โหลดข้อมูลใหม่
            </button>
            <button 
              type="submit" 
              id="logo-submit-btn"
              class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center"
            >
              <span id="logo-submit-text">บันทึก Logo</span>
              <svg id="logo-submit-loading" class="hidden animate-spin ml-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </button>
          </div>
        </form>
      </div>

      <!-- URL Input Alternative -->
      <div class="bg-white rounded-xl shadow-sm p-8">
        <h2 class="text-xl font-bold mb-6 text-indigo-700 flex items-center gap-2">
          <i data-lucide="link" class="w-5 h-5"></i> หรือใส่ URL Logo
        </h2>
        
        <form id="logo-url-form" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">URL Logo หลัก</label>
              <input 
                type="url" 
                id="logo-url-input"
                placeholder="https://example.com/logo.png"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">URL Dark Logo</label>
              <input 
                type="url" 
                id="dark-logo-url-input"
                placeholder="https://example.com/dark-logo.png"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div class="flex justify-end">
            <button 
              type="submit" 
              class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center"
            >
              <i data-lucide="link" class="w-4 h-4 mr-2"></i>
              บันทึก URL
            </button>
          </div>
        </form>
      </div>

      <!-- Delete Section -->
      <div class="bg-red-50 rounded-xl border border-red-200 p-8">
        <h2 class="text-xl font-bold mb-4 text-red-700 flex items-center gap-2">
          <i data-lucide="trash-2" class="w-5 h-5"></i> ลบ Logo
        </h2>
        <p class="text-sm text-red-600 mb-4">หากต้องการลบ Logo และใช้ข้อความแทน</p>
        <div class="flex space-x-3">
          <button 
            onclick="deleteLogo('main')"
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
          >
            ลบ Logo หลัก
          </button>
          <button 
            onclick="deleteLogo('dark')"
            class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
          >
            ลบ Dark Logo
          </button>
        </div>
      </div>
    </div>
  `;

  // Setup event handlers
  setupLogoEventHandlers();
  
  // Load current logos
  loadCurrentLogos();
  
  // Initialize icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ฟังก์ชันเสริมสำหรับจัดการ Logo
function setupLogoEventHandlers() {
  // Upload form handler
  document.getElementById('logo-upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleLogoUpload();
  });

  // URL form handler
  document.getElementById('logo-url-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleLogoURL();
  });

  // Auto-update preview when settings change
  ['logo-width', 'logo-height'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateLogoPreviews);
  });
}

// Preview functions
function previewMainLogo(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('main-logo-preview');
      preview.classList.remove('hidden');
      preview.innerHTML = `
        <div class="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <img src="${e.target.result}" alt="Logo Preview" class="max-h-20 w-auto mx-auto" />
          <p class="text-xs text-center text-gray-500 mt-1">ตัวอย่าง Logo หลัก</p>
        </div>
      `;
      updateLogoPreviews();
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function previewDarkLogo(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('dark-logo-preview');
      preview.classList.remove('hidden');
      preview.innerHTML = `
        <div class="border border-gray-600 rounded-lg p-3 bg-gray-800">
          <img src="${e.target.result}" alt="Dark Logo Preview" class="max-h-20 w-auto mx-auto" />
          <p class="text-xs text-center text-gray-400 mt-1">ตัวอย่าง Dark Logo</p>
        </div>
      `;
      updateLogoPreviews();
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function updateLogoPreviews() {
  const width = document.getElementById('logo-width').value || 120;
  const height = document.getElementById('logo-height').value || 40;
  
  // Update light preview
  const lightPreview = document.getElementById('logo-preview-light');
  const mainLogoInput = document.getElementById('main-logo-upload');
  
  if (mainLogoInput.files && mainLogoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      lightPreview.innerHTML = `
        <img 
          src="${e.target.result}" 
          alt="Logo Preview" 
          style="width: ${width}px; height: ${height}px; object-fit: contain;"
          class="mx-auto"
        />
      `;
    };
    reader.readAsDataURL(mainLogoInput.files[0]);
  }
  
  // Update dark preview
  const darkPreview = document.getElementById('logo-preview-dark');
  const darkLogoInput = document.getElementById('dark-logo-upload');
  
  if (darkLogoInput.files && darkLogoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      darkPreview.innerHTML = `
        <img 
          src="${e.target.result}" 
          alt="Dark Logo Preview" 
          style="width: ${width}px; height: ${height}px; object-fit: contain;"
          class="mx-auto"
        />
      `;
    };
    reader.readAsDataURL(darkLogoInput.files[0]);
  }
}

// เพิ่มฟังก์ชัน showPaymentSettings
async function showPaymentSettings() {
  console.log('💳 Loading Payment Settings...');
  
  const mainContent = document.getElementById('main-content');
  if (!mainContent) {
    console.error('Main content element not found');
    return;
  }

  try {
    // โหลด payment-settings-manager.js ถ้ายังไม่มี
    if (!window.PaymentSettingsManager) {
      console.log('📥 Loading payment-settings-manager.js...');
      await loadScript('/static/admin/js/payment-settings-manager.js');
      
      // รอให้ script execute
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!window.PaymentSettingsManager) {
        throw new Error('ไม่สามารถโหลด PaymentSettingsManager ได้');
      }
    }

    // สร้าง instance ถ้ายังไม่มี
    if (!window.paymentSettingsManager) {
      console.log('🏗️ Creating PaymentSettingsManager instance...');
      window.paymentSettingsManager = new window.PaymentSettingsManager();
    }

    // แสดงหน้า Payment Settings
    await window.paymentSettingsManager.renderPaymentSettingsPage();

  } catch (error) {
    console.error('❌ Error loading Payment Settings:', error);
    
    mainContent.innerHTML = `
      <div class="text-center py-12">
        <div class="text-red-500 mb-4">
          <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2"></i>
          <h3 class="text-lg font-medium">เกิดข้อผิดพลาด</h3>
          <p class="text-sm mt-2">${error.message}</p>
        </div>
        <button 
          onclick="showPaymentSettings()" 
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
        >
          ลองใหม่
        </button>
      </div>
    `;
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
}

// Load current logos from API
async function loadCurrentLogos() {
  try {
    // เปลี่ยนจาก /api/homepage-setting เป็น Express API
    const response = await fetch('/api/admin/logo');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('📄 Logo data loaded:', result);
    
    const currentLogoDisplay = document.getElementById('current-logo-display');
    
    if (result.success && result.data && (result.data.logo_url || result.data.dark_logo_url)) {
      const data = result.data;
      
      currentLogoDisplay.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          ${data.logo_url ? `
            <div class="text-center">
              <h3 class="font-semibold mb-4 text-gray-800">Logo หลัก (Light Mode)</h3>
              <div class="bg-white border-2 border-gray-200 rounded-lg p-6">
                <img 
                  src="${data.logo_url}" 
                  alt="${data.logo_alt_text || 'AquaRoom Logo'}" 
                  style="width: ${data.logo_width || 120}px; height: ${data.logo_height || 40}px;"
                  class="mx-auto object-contain"
                />
              </div>
              <div class="mt-3 text-sm text-gray-600">
                <p>ขนาด: ${data.logo_width || 120}×${data.logo_height || 40}px</p>
                <p>Alt Text: ${data.logo_alt_text || 'AquaRoom Logo'}</p>
              </div>
            </div>
          ` : `
            <div class="text-center text-gray-500">
              <div class="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-6">
                <i data-lucide="image" class="w-12 h-12 mx-auto mb-2 text-gray-400"></i>
                <p>ยังไม่มี Logo หลัก</p>
              </div>
            </div>
          `}
          
          ${data.dark_logo_url ? `
            <div class="text-center">
              <h3 class="font-semibold mb-4 text-gray-800">Dark Logo</h3>
              <div class="bg-gray-900 border-2 border-gray-700 rounded-lg p-6">
                <img 
                  src="${data.dark_logo_url}" 
                  alt="${data.logo_alt_text || 'AquaRoom Logo'}" 
                  style="width: ${data.logo_width || 120}px; height: ${data.logo_height || 40}px;"
                  class="mx-auto object-contain"
                />
              </div>
              <div class="mt-3 text-sm text-gray-600">
                <p>ขนาด: ${data.logo_width || 120}×${data.logo_height || 40}px</p>
                <p>สำหรับ Dark Mode</p>
              </div>
            </div>
          ` : `
            <div class="text-center text-gray-500">
              <div class="bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-6">
                <i data-lucide="image" class="w-12 h-12 mx-auto mb-2 text-gray-500"></i>
                <p class="text-gray-400">ยังไม่มี Dark Logo</p>
              </div>
            </div>
          `}
        </div>
      `;
      
      // Fill form data
      if (data) {
        document.getElementById('logo-alt-text').value = data.logo_alt_text || '';
        document.getElementById('logo-width').value = data.logo_width || 120;
        document.getElementById('logo-height').value = data.logo_height || 40;
        document.getElementById('logo-url-input').value = data.logo_url || '';
        document.getElementById('dark-logo-url-input').value = data.dark_logo_url || '';
      }
    } else {
      currentLogoDisplay.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <i data-lucide="image" class="w-16 h-16 mx-auto mb-4 text-gray-400"></i>
          <h3 class="text-lg font-medium mb-2">ยังไม่มี Logo</h3>
          <p class="text-sm">เริ่มต้นด้วยการอัปโหลด Logo แรกของคุณ</p>
        </div>
      `;
    }
    
    // Re-initialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    
  } catch (error) {
    console.error('❌ Error loading current logos:', error);
    document.getElementById('current-logo-display').innerHTML = `
      <div class="text-center py-8 text-red-500">
        <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2"></i>
        <p>เกิดข้อผิดพลาดในการโหลดข้อมูล Logo: ${error.message}</p>
      </div>
    `;
  }
}

// Handle logo upload
async function handleLogoUpload() {
  const submitBtn = document.getElementById('logo-submit-btn');
  const submitText = document.getElementById('logo-submit-text');
  const submitLoading = document.getElementById('logo-submit-loading');
  
  try {
    // Show loading state
    submitBtn.disabled = true;
    submitText.textContent = 'กำลังอัปโหลด...';
    submitLoading.classList.remove('hidden');
    
    // รวบรวมข้อมูลจากฟอร์ม
    const logoData = {
      logo_alt_text: document.getElementById('logo-alt-text').value || 'AquaRoom Logo',
      logo_width: parseInt(document.getElementById('logo-width').value) || 120,
      logo_height: parseInt(document.getElementById('logo-height').value) || 40
    };

    // รวบรวมไฟล์รูปภาพ
    const mainLogoFile = document.getElementById('main-logo-upload').files[0];
    const darkLogoFile = document.getElementById('dark-logo-upload').files[0];
    
    // อัปโหลดไฟล์ (ถ้ามี) - ใช้ API ของ Express Server
    if (mainLogoFile || darkLogoFile) {
      const formData = new FormData();
      
      if (mainLogoFile) {
        console.log('📸 Uploading main logo:', mainLogoFile.name);
        formData.append('images', mainLogoFile);
      }
      
      if (darkLogoFile) {
        console.log('🌙 Uploading dark logo:', darkLogoFile.name);
        formData.append('images', darkLogoFile);
      }
      
      try {
        console.log('🚀 Starting image upload to Express API...');
        
        // เปลี่ยนจาก /api/upload เป็น API ของ Express Server
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        console.log('📡 Upload response status:', uploadResponse.status);
        
        // ตรวจสอบ Content-Type
        const contentType = uploadResponse.headers.get('content-type');
        console.log('📄 Response Content-Type:', contentType);
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('❌ Upload failed - Response:', errorText);
          throw new Error(`Upload failed (${uploadResponse.status}): ${errorText.substring(0, 200)}`);
        }
        
        // ตรวจสอบว่า response เป็น JSON หรือไม่
        if (!contentType || !contentType.includes('application/json')) {
          const responseText = await uploadResponse.text();
          console.error('❌ Invalid response format:', responseText.substring(0, 500));
          throw new Error('Server ส่ง response ที่ไม่ใช่ JSON กลับมา');
        }
        
        const uploadResult = await uploadResponse.json();
        console.log('✅ Upload result:', uploadResult);
        
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Upload failed');
        }
        
        // เพิ่ม URL ของรูปที่อัปโหลดแล้ว
        if (uploadResult.urls && uploadResult.urls.length > 0) {
          if (mainLogoFile) {
            logoData.logo_url = uploadResult.urls[0];
          }
          if (darkLogoFile && uploadResult.urls.length > 1) {
            logoData.dark_logo_url = uploadResult.urls[1];
          } else if (darkLogoFile && !mainLogoFile) {
            logoData.dark_logo_url = uploadResult.urls[0];
          }
        }
        
      } catch (uploadError) {
        console.error('❌ Image upload error:', uploadError);
        throw new Error(`ไม่สามารถอัปโหลดรูปภาพได้: ${uploadError.message}`);
      }
    }
    
    // บันทึกข้อมูล logo ลงฐานข้อมูล - ใช้ Express API
    console.log('💾 Saving logo data to Express API:', logoData);
    
    const saveResponse = await fetch('/api/admin/logo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(logoData)
    });
    
    console.log('📡 Save response status:', saveResponse.status);
    
    // ตรวจสอบ Content-Type ของ save response
    const saveContentType = saveResponse.headers.get('content-type');
    console.log('📄 Save Response Content-Type:', saveContentType);
    
    if (!saveResponse.ok) {
      const errorText = await saveResponse.text();
      console.error('❌ Save failed - Response:', errorText);
      throw new Error(`บันทึกไม่สำเร็จ (${saveResponse.status}): ${errorText.substring(0, 200)}`);
    }
    
    // ตรวจสอบว่า save response เป็น JSON หรือไม่
    if (!saveContentType || !saveContentType.includes('application/json')) {
      const responseText = await saveResponse.text();
      console.error('❌ Invalid save response format:', responseText.substring(0, 500));
      throw new Error('Server ส่ง response ที่ไม่ใช่ JSON กลับมา (Save)');
    }
    
    const saveResult = await saveResponse.json();
    console.log('✅ Save result:', saveResult);
    
    if (!saveResult.success) {
      throw new Error(saveResult.error || saveResult.message || 'บันทึกไม่สำเร็จ');
    }
    
    // แสดงความสำเร็จ
    Swal.fire({
      icon: 'success',
      title: 'บันทึกสำเร็จ!',
      text: saveResult.message || 'Logo ได้ถูกอัปเดตแล้ว',
      timer: 2000,
      showConfirmButton: false
    });
    
    // รีโหลดข้อมูล logo ปัจจุบัน
    await loadCurrentLogos();
    
    // เคลียร์ฟอร์ม
    document.getElementById('logo-upload-form').reset();
    document.getElementById('main-logo-preview').classList.add('hidden');
    document.getElementById('dark-logo-preview').classList.add('hidden');
    
  } catch (error) {
    console.error('❌ Error in handleLogoUpload:', error);
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด!',
      text: error.message || 'ไม่สามารถอัปโหลด Logo ได้',
      confirmButtonText: 'ตกลง'
    });
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitText.textContent = 'บันทึก Logo';
    submitLoading.classList.add('hidden');
  }
}

// Handle logo URL
async function handleLogoURL() {
  try {
    const logoData = {
      logo_url: document.getElementById('logo-url-input').value,
      dark_logo_url: document.getElementById('dark-logo-url-input').value,
      logo_alt_text: document.getElementById('logo-alt-text').value,
      logo_width: parseInt(document.getElementById('logo-width').value),
      logo_height: parseInt(document.getElementById('logo-height').value)
    };
    
    console.log('🔗 Saving logo URL data:', logoData);
    
    // ใช้ Express API
    const response = await fetch('/api/admin/logo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(logoData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || result.error || 'บันทึกไม่สำเร็จ');
    }
    
    Swal.fire({
      icon: 'success',
      title: 'บันทึกสำเร็จ!',
      text: result.message || 'Logo URL ได้ถูกอัปเดตแล้ว',
      timer: 2000,
      showConfirmButton: false
    });
    
    await loadCurrentLogos();
    
  } catch (error) {
    console.error('❌ Error saving logo URL:', error);
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด!',
      text: error.message || 'ไม่สามารถบันทึก Logo URL ได้'
    });
  }
}


// Delete logo function
async function deleteLogo(type) {
  const result = await Swal.fire({
    title: 'ยืนยันการลบ',
    text: `ต้องการลบ ${type === 'main' ? 'Logo หลัก' : 'Dark Logo'} หรือไม่?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626'
  });

  if (result.isConfirmed) {
    try {
      console.log('🗑️ Deleting logo type:', type);
      
      // ใช้ Express API
      const response = await fetch(`/api/admin/logo/${type}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || result.error || 'ลบไม่สำเร็จ');
      }
      
      Swal.fire({
        icon: 'success',
        title: 'ลบสำเร็จ!',
        text: result.message || `${type === 'main' ? 'Logo หลัก' : 'Dark Logo'} ถูกลบเรียบร้อยแล้ว`,
        timer: 2000,
        showConfirmButton: false
      });
      
      await loadCurrentLogos();
      
    } catch (error) {
      console.error('❌ Error deleting logo:', error);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด!',
        text: error.message || 'ไม่สามารถลบ Logo ได้'
      });
    }
  }
}
async function loadCurrentLogo() {
  try {
    const response = await fetch('/api/homepage-setting');
    const data = await response.json();
    
    if (data) {
      document.getElementById('logo_alt_text').value = data.logo_alt_text || '';
      document.getElementById('logo_width').value = data.logo_width || 120;
      document.getElementById('logo_height').value = data.logo_height || 40;
      document.getElementById('logo_url').value = data.logo_url || '';
      document.getElementById('dark_logo_url').value = data.dark_logo_url || '';
    }
  } catch (error) {
    console.error('Error loading logo:', error);
  }
}

async function saveLogo(e) {
  e.preventDefault();
  
  const logoData = {
    logo_alt_text: document.getElementById('logo_alt_text').value,
    logo_width: parseInt(document.getElementById('logo_width').value),
    logo_height: parseInt(document.getElementById('logo_height').value),
    logo_url: document.getElementById('logo_url').value,
    dark_logo_url: document.getElementById('dark_logo_url').value
  };

  try {
    const response = await fetch('/api/homepage-setting', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(logoData)
    });

    const result = await response.json();

    if (result.success) {
      Swal.fire({
        icon: 'success',
        title: 'บันทึกสำเร็จ!',
        text: 'Logo ได้ถูกอัปเดตแล้ว',
        timer: 2000
      });
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด!',
      text: error.message
    });
  }
}


// เพิ่มฟังก์ชัน showCoupons
async function showCoupons() {
  console.log('🎫 Loading Coupons Management System...');
  
  const mainContent = document.getElementById('main-content');
  if (!mainContent) {
    console.error('❌ main-content element not found');
    return;
  }

  try {
    // แสดงสถานะโหลด
    mainContent.innerHTML = `
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p class="text-gray-600">กำลังโหลดระบบจัดการคูปอง...</p>
        </div>
      </div>
    `;

    // เรียกใช้ showCouponsPage ที่จะสร้าง global instance
    if (typeof window.showCouponsPage === 'function') {
      await window.showCouponsPage();
      console.log('✅ Coupons system loaded successfully');
    } else {
      throw new Error('showCouponsPage function not found');
    }

  } catch (error) {
    console.error('❌ Error in showCoupons:', error);
    
    mainContent.innerHTML = `
      <div class="max-w-2xl mx-auto text-center py-12">
        <div class="text-red-500 mb-6">
          <i data-lucide="alert-circle" class="w-16 h-16 mx-auto mb-4"></i>
          <h3 class="text-xl font-bold mb-2">เกิดข้อผิดพลาดในการโหลดระบบจัดการคูปอง</h3>
          <p class="text-base mb-4">${error.message}</p>
        </div>
        
        <div class="space-x-3">
          <button 
            onclick="showCoupons()" 
            class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md font-medium"
          >
            🔄 ลองใหม่
          </button>
          <button 
            onclick="location.reload()" 
            class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md font-medium"
          >
            🔄 รีเฟรชหน้า
          </button>
          <button 
            onclick="window.debugCouponsManager()" 
            class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
          >
            🔍 Debug ระบบ
          </button>
        </div>
      </div>
    `;
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
}

// เพิ่มฟังก์ชัน debug เพิ่มเติม
function testCouponsManagerCreation() {
  console.log('🧪 Testing CouponsManager creation...');
  
  try {
    // ทดสอบเรียก showCouponsPage
    if (typeof window.showCouponsPage === 'function') {
      console.log('📞 Calling showCouponsPage...');
      window.showCouponsPage();
      return;
    }
    
    // ทดสอบสร้าง CouponsManager
    if (window.CouponsManager) {
      console.log('🏗️ Attempting to create CouponsManager instance...');
      const testManager = new window.CouponsManager();
      console.log('✅ Test instance created:', testManager);
      
      // ทดสอบเรียก initialize
      if (typeof testManager.initialize === 'function') {
        console.log('🚀 initialize method found, calling it...');
        testManager.initialize().then(() => {
          console.log('✅ Initialize completed successfully');
        }).catch(error => {
          console.error('❌ Initialize failed:', error);
        });
      } else {
        console.error('❌ No initialize method found');
      }
    } else {
      console.error('❌ CouponsManager class not found');
    }
  } catch (error) {
    console.error('❌ Error in test:', error);
    alert('Test failed: ' + error.message);
  }
}

// เพิ่มฟังก์ชัน debug
function debugCouponsSystem() {
  console.log('🔍 === COUPONS SYSTEM DEBUG ===');
  console.log('CouponsManager Class:', window.CouponsManager);
  console.log('CouponsManager Type:', typeof window.CouponsManager);
  console.log('couponsManager Instance:', window.couponsManager);
  console.log('Current Location:', window.location.href);
  
  // ทดสอบการโหลดไฟล์
  // const testPaths = [
  //   './js/coupons-manager.js',
  //   '/admin/js/coupons-manager.js',
  //   '/static/admin/js/coupons-manager.js'
  // ];
  
  console.log('🧪 Testing script paths...');
  testPaths.forEach(async (path, index) => {
    try {
      const response = await fetch(path, { method: 'HEAD' });
      console.log(`${index + 1}. ${path}: ${response.status === 200 ? '✅ OK' : '❌ Not Found'}`);
    } catch (error) {
      console.log(`${index + 1}. ${path}: ❌ Error - ${error.message}`);
    }
  });
  
  // ทดสอบการสร้าง instance
  if (window.CouponsManager) {
    try {
      const testInstance = new window.CouponsManager();
      console.log('✅ Test instance created successfully');
      console.log('Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(testInstance)));
    } catch (error) {
      console.error('❌ Error creating test instance:', error);
    }
  }
  
  // แสดงผลลัพธ์
  const result = {
    hasClass: !!window.CouponsManager,
    classType: typeof window.CouponsManager,
    hasInstance: !!window.couponsManager,
    scriptElements: document.querySelectorAll('script[src*="coupons-manager"]').length,
    currentPath: window.location.pathname
  };
  
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'ผลการ Debug ระบบคูปอง',
      html: `
        <div class="text-left space-y-2">
          <div class="bg-gray-50 p-3 rounded">
            <h4 class="font-semibold mb-2">📊 สถานะระบบ</h4>
            <p>• มี CouponsManager Class: <span class="${result.hasClass ? 'text-green-600' : 'text-red-600'}">${result.hasClass ? '✅ Yes' : '❌ No'}</span></p>
            <p>• ประเภท Class: <span class="font-mono">${result.classType}</span></p>
            <p>• มี Instance: <span class="${result.hasInstance ? 'text-green-600' : 'text-red-600'}">${result.hasInstance ? '✅ Yes' : '❌ No'}</span></p>
            <p>• Script Elements: <span class="font-mono">${result.scriptElements}</span></p>
            <p>• Current Path: <span class="font-mono text-xs">${result.currentPath}</span></p>
          </div>
          
          <div class="bg-blue-50 p-3 rounded">
            <h4 class="font-semibold mb-2">💡 แนะนำการแก้ไข</h4>
            <p class="text-sm">1. ตรวจสอบไฟล์ coupons-manager.js ในโฟลเดอร์ js/</p>
            <p class="text-sm">2. ตรวจสอบการ export class ใน coupons-manager.js</p>
            <p class="text-sm">3. รีเฟรชหน้าเว็บและลองใหม่</p>
          </div>
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'ตกลง'
    });
  } else {
    alert(`Debug Result:\n${JSON.stringify(result, null, 2)}`);
  }
}
// เพิ่มฟังก์ชัน showAlertsPage
async function showAlertsPage() {
  console.log('🚨 Loading Alerts Page from route...');
try {
    // โหลด AlertsManager ถ้ายังไม่มี
    if (!window.AlertsManager) {
      await loadScript('/admin/js/alerts-manager.js');
    }
    
    // สร้าง instance ใหม่
    window.alertsManager = new window.AlertsManager();
    
    // เริ่มต้นระบบ
    await window.alertsManager.initialize();
    
  } catch (error) {
    console.error('❌ Error loading Alerts Page:', error);
    
    document.getElementById('main-content').innerHTML = `
      <div class="text-center py-12">
        <div class="text-red-500 mb-4">
          <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2"></i>
          <h3 class="text-lg font-medium">ไม่สามารถโหลดระบบแจ้งเตือนได้</h3>
          <p class="text-sm mt-2">${error.message}</p>
        </div>
        <button onclick="showAlertsPage()" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          ลองใหม่
        </button>
      </div>
    `;
    
    lucide.createIcons();
  }
}
// Get API data (ไม่ต้อง authentication แล้ว)
async function fetchAPI(endpoint, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  try {
    console.log(`🌐 Fetching API: ${API_BASE_URL}${endpoint}`);
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...defaultOptions,
      ...options
    });
    
    console.log(`📡 API Response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ API Data received:`, data);
    
    return data;
    
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error);
    
    // Return null instead of throwing
    return null;
  }
}

// Router Function

function handleRouting() {
  const path = window.location.pathname;
  const segments = path.split('/').filter(s => s);
  
  console.log('🛣️ Routing to:', path, 'Segments:', segments);
  
  // ตรวจสอบเส้นทางสำหรับแก้ไขสินค้า
  if (segments.length >= 3 && segments[1] === 'products' && segments[2] === 'edit') {
    const productId = segments[3];
    if (productId && !isNaN(productId)) {
      showEditProduct(parseInt(productId));
      return;
    }
  }
  
  // ใช้ routes ปกติ
  const route = routes[path] || routes[Object.keys(routes).find(r => path.startsWith(r))] || showNotFound;
  
  const mainContent = document.getElementById('main-content');
  const loader = document.getElementById('loader');
  
  if (mainContent && loader) {
    mainContent.innerHTML = '';
    mainContent.appendChild(loader);
    loader.classList.remove('hidden');
    
    setTimeout(() => {
      loader.classList.add('hidden');
      route();
    }, 300);
  }
}

// Dashboard View
async function showDashboard() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;
  
  try {
    console.log('📊 Loading dashboard data...');
    
    // ดึงข้อมูลสถิติจาก API รวมถึงสถิติการเข้าชม (แบบ safe)
    const [dashboardStats, recentOrders, pageViewStats] = await Promise.all([
      fetchAPI('/dashboard/stats').catch(error => {
        console.warn('⚠️ Dashboard stats API failed:', error);
        return { products: 0, orders: 0, customers: 0, revenue: 0 };
      }),
      fetchAPI('/orders/recent').catch(error => {
        console.warn('⚠️ Recent orders API failed:', error);
        return [];
      }),
      fetchAPI('/analytics/page-views').catch(error => {
        console.warn('⚠️ Page views API failed:', error);
        return null;
      })
    ]);
    
    console.log('📊 API Responses:', {
      dashboardStats,
      recentOrders,
      pageViewStats
    });
    
    // ✅ ปรับปรุง: รวมข้อมูลทั้งหมดแบบปลอดภัย
    const dashboardData = {
      // ข้อมูลพื้นฐาน
      products: dashboardStats?.products || 0,
      orders: dashboardStats?.orders || 0,
      customers: dashboardStats?.customers || 0,
      revenue: dashboardStats?.revenue || 0,
      recentOrders: Array.isArray(recentOrders) ? recentOrders : [],
      
      // ✅ แก้ไข: จัดการ pageViews แบบปลอดภัย
      pageViews: {
        summary: {
          total_views: pageViewStats?.data?.summary?.total_views || 0,
          unique_visitors: pageViewStats?.data?.summary?.unique_visitors || 0
        }
      }
    };
    
    console.log('✅ Processed dashboard data:', dashboardData);
    
    mainContent.innerHTML = `
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">แดชบอร์ด</h1>
        <p class="text-gray-600">ภาพรวมการดำเนินงานของร้านค้า</p>
      </div>
      
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <!-- Total Products -->
        <div class="p-6 bg-white rounded-xl shadow-sm">
          <div class="flex items-center">
            <div class="p-3 mr-4 bg-indigo-100 rounded-full">
              <i data-lucide="package" class="w-6 h-6 text-indigo-600"></i>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">สินค้า</p>
              <p class="text-2xl font-bold text-gray-900">${dashboardData.products}</p>
            </div>
          </div>
        </div>

        <!-- Total Orders -->
        <div class="p-6 bg-white rounded-xl shadow-sm">
          <div class="flex items-center">
            <div class="p-3 mr-4 bg-green-100 rounded-full">
              <i data-lucide="shopping-cart" class="w-6 h-6 text-green-600"></i>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">คำสั่งซื้อ</p>
              <p class="text-2xl font-bold text-gray-900">${dashboardData.orders}</p>
            </div>
          </div>
        </div>

        <!-- Total Customers -->
        <div class="p-6 bg-white rounded-xl shadow-sm">
          <div class="flex items-center">
            <div class="p-3 mr-4 bg-blue-100 rounded-full">
              <i data-lucide="users" class="w-6 h-6 text-blue-600"></i>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">ลูกค้า</p>
              <p class="text-2xl font-bold text-gray-900">${dashboardData.customers}</p>
            </div>
          </div>
        </div>

        <!-- การเข้าชมวันนี้ -->
        <div class="p-6 bg-white rounded-xl shadow-sm">
          <div class="flex items-center">
            <div class="p-3 mr-4 bg-purple-100 rounded-full">
              <i data-lucide="eye" class="w-6 h-6 text-purple-600"></i>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">การเข้าชมวันนี้</p>
              <p class="text-2xl font-bold text-gray-900">${dashboardData.pageViews.summary.total_views}</p>
            </div>
          </div>
        </div>

        <!-- ผู้เข้าชมไม่ซ้ำ -->
        <div class="p-6 bg-white rounded-xl shadow-sm">
          <div class="flex items-center">
            <div class="p-3 mr-4 bg-orange-100 rounded-full">
              <i data-lucide="user-check" class="w-6 h-6 text-orange-600"></i>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">ผู้เข้าชมไม่ซ้ำ</p>
              <p class="text-2xl font-bold text-gray-900">${dashboardData.pageViews.summary.unique_visitors}</p>
            </div>
          </div>
        </div>

        <!-- Total Revenue -->
        <div class="p-6 bg-white rounded-xl shadow-sm md:col-span-2 lg:col-span-5">
          <div class="flex items-center justify-center">
            <div class="p-3 mr-4 bg-yellow-100 rounded-full">
              <i data-lucide="dollar-sign" class="w-6 h-6 text-yellow-600"></i>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">ยอดขายรวม</p>
              <p class="text-3xl font-bold text-gray-900">฿${(dashboardData.revenue).toLocaleString()}</p>
            </div>
            
              <span class="text-sm text-gray-500">
                สถิติการเข้าชมจะแสดงเมื่อมีการตั้งค่า Analytics
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Recent Orders Table -->
      <div class="bg-white rounded-xl shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">คำสั่งซื้อล่าสุด</h2>
        </div>
        <div class="overflow-x-auto">
          ${dashboardData.recentOrders.length > 0 ? `
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    เลขที่คำสั่งซื้อ
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ลูกค้า
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ยอดรวม
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    สถานะ
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    วันที่
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${dashboardData.recentOrders.map(order => `
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm font-medium text-gray-900">#${order.id?.toString().padStart(5, '0') || 'N/A'}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-900">${order.customer || 'ไม่ระบุ'}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-900">฿${(order.total || 0).toLocaleString()}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}">
                        ${order.status || 'ไม่ระบุ'}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${order.date || '-'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div class="px-6 py-8 text-center text-gray-500">
              <i data-lucide="shopping-cart" class="w-12 h-12 mx-auto mb-4 text-gray-300"></i>
              <h3 class="text-lg font-medium mb-2">ยังไม่มีคำสั่งซื้อ</h3>
              <p class="text-sm">คำสั่งซื้อล่าสุดจะแสดงที่นี่</p>
            </div>
          `}
        </div>
        ${dashboardData.recentOrders.length > 0 ? `
          <div class="px-6 py-4 border-t border-gray-200">
            <a href="/admin/orders" class="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              ดูคำสั่งซื้อทั้งหมด →
            </a>
          </div>
        ` : ''}
      </div>
    `;
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    
    console.log('✅ Dashboard rendered successfully');
    
  } catch (error) {
    console.error('❌ Error loading dashboard:', error);
    
    // แสดง fallback UI
    mainContent.innerHTML = `
      <div class="text-center py-12">
        <div class="text-red-500 mb-6">
          <i data-lucide="alert-circle" class="w-16 h-16 mx-auto mb-4"></i>
          <h3 class="text-xl font-bold mb-2">เกิดข้อผิดพลาดในการโหลดแดชบอร์ด</h3>
          <p class="text-base mb-4">${error.message}</p>
        </div>
        
        <div class="space-x-3">
          <button 
            onclick="showDashboard()" 
            class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md font-medium"
          >
            🔄 ลองใหม่
          </button>
          <button 
            onclick="location.reload()" 
            class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md font-medium"
          >
            🔄 รีเฟรชหน้า
          </button>
        </div>
      </div>
    `;
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    
    console.error('❌ Dashboard rendering failed:', error);
  }
}



// 📊 ฟังก์ชันแสดงสถิติการเข้าชมแบบละเอียด
async function showPageViewsDetail() {
  try {
    console.log('📊 Loading page views detail...');
    
    const response = await fetch('/api/admin/analytics/page-views?period=today');
    
    if (!response.ok) {
      // ถ้า API ไม่มี แสดง message แทน
      if (response.status === 404) {
        Swal.fire({
          title: '🚧 ระบบสถิติการเข้าชม',
          html: `
            <div class="text-left space-y-4">
              <div class="bg-yellow-50 p-4 rounded-lg">
                <h4 class="font-semibold text-yellow-800 mb-2">📊 ระบบยังไม่พร้อมใช้งาน</h4>
                <p class="text-yellow-700 text-sm">
                  ระบบติดตามการเข้าชมเว็บไซต์กำลังอยู่ระหว่างการพัฒนา
                </p>
              </div>
              
              <div class="bg-blue-50 p-4 rounded-lg">
                <h4 class="font-semibold text-blue-800 mb-2">💡 ทางเลือกสำหรับสถิติการเข้าชม</h4>
                <div class="text-blue-700 text-sm space-y-2">
                  <p>• ใช้ Google Analytics เพื่อติดตามผู้เข้าชม</p>
                  <p>• ใช้ Facebook Pixel สำหรับ E-commerce</p>
                  <p>• ติดตั้งระบบ Analytics ภายนอก</p>
                </div>
              </div>
              
              <div class="bg-green-50 p-4 rounded-lg">
                <h4 class="font-semibold text-green-800 mb-2">✅ ข้อมูลที่มีอยู่ปัจจุบัน</h4>
                <div class="text-green-700 text-sm space-y-1">
                  <p>• จำนวนสินค้า: ${document.querySelector('.text-gray-900')?.textContent || 'N/A'}</p>
                  <p>• จำนวนคำสั่งซื้อ: รอข้อมูลจากระบบ</p>
                  <p>• จำนวนลูกค้า: รอข้อมูลจากระบบ</p>
                </div>
              </div>
            </div>
          `,
          icon: 'info',
          confirmButtonText: 'เข้าใจแล้ว',
          confirmButtonColor: '#4F46E5',
          width: '600px'
        });
        return;
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('📊 Page views API response:', data);
    
    if (data.success && data.data) {
      const stats = data.data;
      
      Swal.fire({
        title: '📊 สถิติการเข้าชมวันนี้',
        html: `
          <div class="text-left space-y-4">
            <!-- สรุปภาพรวม -->
            <div class="bg-indigo-50 p-4 rounded-lg">
              <h4 class="font-semibold text-indigo-800 mb-2">📈 ภาพรวม</h4>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-gray-600">การเข้าชมทั้งหมด:</span>
                  <span class="font-semibold ml-2">${stats.summary?.total_views || 0}</span>
                </div>
                <div>
                  <span class="text-gray-600">ผู้เข้าชมไม่ซ้ำ:</span>
                  <span class="font-semibold ml-2">${stats.summary?.unique_visitors || 0}</span>
                </div>
                <div>
                  <span class="text-gray-600">เฉลี่ยหน้า/คน:</span>
                  <span class="font-semibold ml-2">${stats.summary?.avg_pages_per_visitor || 0}</span>
                </div>
              </div>
            </div>
            
            <!-- หน้าที่เข้าชมมากที่สุด -->
            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-semibold text-green-800 mb-2">🔥 หน้าที่เข้าชมมากที่สุด</h4>
              <div class="space-y-2 text-sm max-h-40 overflow-y-auto">
                ${(stats.top_pages || []).slice(0, 5).map(page => `
                  <div class="flex justify-between">
                    <span class="text-gray-600 truncate">${page.url || 'N/A'}</span>
                    <span class="font-semibold">${page.views || 0} (${page.percentage || 0}%)</span>
                  </div>
                `).join('') || '<p class="text-gray-500">ไม่มีข้อมูล</p>'}
              </div>
            </div>
            
            <!-- การเข้าชมล่าสุด -->
            <div class="bg-blue-50 p-4 rounded-lg">
              <h4 class="font-semibold text-blue-800 mb-2">⏰ การเข้าชมล่าสุด</h4>
              <div class="space-y-1 text-xs max-h-32 overflow-y-auto">
                ${(stats.recent_views || []).slice(0, 5).map(view => `
                  <div class="flex justify-between">
                    <span class="text-gray-600">${view.created_at ? new Date(view.created_at).toLocaleTimeString('th-TH') : 'N/A'}</span>
                    <span class="text-gray-500 truncate ml-2">${view.page_url || 'N/A'}</span>
                  </div>
                `).join('') || '<p class="text-gray-500">ไม่มีข้อมูล</p>'}
              </div>
            </div>
          </div>
        `,
        width: '600px',
        confirmButtonText: 'ปิด',
        confirmButtonColor: '#4F46E5'
      });
    } else {
      throw new Error('ไม่พบข้อมูลสถิติการเข้าชม');
    }
  } catch (error) {
    console.error('❌ Error loading page views detail:', error);
    Swal.fire({
      title: 'เกิดข้อผิดพลาด',
      text: `ไม่สามารถโหลดสถิติการเข้าชมได้: ${error.message}`,
      icon: 'error',
      confirmButtonText: 'ตกลง'
    });
  }
}

// Helper function for status colors
function getStatusColor(status) {
  switch(status) {
    case 'สำเร็จ':
      return 'bg-green-100 text-green-800';
    case 'กำลังจัดส่ง':
      return 'bg-blue-100 text-blue-800';
    case 'รอการชำระเงิน':
      return 'bg-yellow-100 text-yellow-800';
    case 'ยกเลิก':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}


// เพิ่มฟังก์ชันลบสินค้า
window.deleteProduct = async function(productId) {
  const result = await Swal.fire({
    title: 'คุณแน่ใจหรือไม่?',
    text: 'คุณต้องการลบสินค้านี้ใช่หรือไม่?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก'
  });

  if (result.isConfirmed) {
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        Swal.fire({
          title: 'ลบแล้ว!',
          text: 'สินค้าถูกลบเรียบร้อยแล้ว',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
        
        // โหลดข้อมูลใหม่
        location.reload();
      } else {
        throw new Error(data.message || 'ไม่สามารถลบสินค้าได้');
      }
    } catch (error) {
      Swal.fire({
        title: 'เกิดข้อผิดพลาด!',
        text: error.message || 'ไม่สามารถลบสินค้าได้',
        icon: 'error'
      });
    }
  }
};

// Products List View
async function showProductsList() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  mainContent.innerHTML = `
    <div class="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">รายการสินค้า</h1>
        <p class="text-sm text-gray-600">ดูข้อมูลสินค้าทั้งหมดในระบบ</p>
      </div>
      <div class="flex gap-2">
        <button id="delete-selected-btn" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md flex items-center justify-center text-sm font-medium">
          <i data-lucide="trash-2" class="w-4 h-4 mr-2"></i> ลบที่เลือก
        </button>
        <a href="/admin/products/create" class="bg-primary hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center justify-center">
          <i data-lucide="plus" class="w-4 h-4 mr-2"></i>
          เพิ่มสินค้าใหม่
        </a>
      </div>
    </div>
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3">
                <input type="checkbox" id="select-all-products" class="form-checkbox h-4 w-4 text-indigo-600">
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">รหัสสินค้า</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">รูปภาพ</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อสินค้า</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ราคา</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">คงเหลือ</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ยอดนิยม</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
            </tr>
          </thead>
          <tbody id="products-list-table-body" class="bg-white divide-y divide-gray-200">
            <tr>
              <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500">กำลังโหลดข้อมูล...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // ดึงข้อมูลสินค้าจาก API
  try {
    const response = await fetch('/api/products');
    const products = await response.json();

    const tableBody = document.getElementById('products-list-table-body');
    if (products.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500">ไม่มีข้อมูลสินค้า</td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = products.map(product => `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-4">
            <input type="checkbox" class="product-checkbox form-checkbox h-4 w-4 text-indigo-600" value="${product.id}">
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            #${product.id}
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            ${product.image_url 
              ? `<img src="${product.image_url}" alt="${product.name}" class="h-12 w-12 rounded-lg object-cover">`
              : `<div class="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                   <i data-lucide="image" class="h-6 w-6 text-gray-400"></i>
                 </div>`
            }
          </td>
          <td class="px-6 py-4">
            <div class="text-sm font-medium text-gray-900">${product.name}</div>
            <div class="text-xs text-gray-500 truncate max-w-xs">${product.description || ''}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            ${parseFloat(product.price).toLocaleString()} บาท
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              product.stock > 10 
                ? 'bg-green-100 text-green-800' 
                : product.stock > 0 
                ? 'bg-yellow-100 text-yellow-800' 
                : 'bg-red-100 text-red-800'
            }">
              ${product.stock > 0 ? `${product.stock} ชิ้น` : 'หมด'}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
              product.is_popular 
                ? 'bg-yellow-100 text-yellow-800' 
                : 'bg-gray-100 text-gray-800'
            }">
              ${product.is_popular 
                ? '<i data-lucide="star" class="w-3 h-3 mr-1 fill-current"></i>ยอดนิยม' 
                : 'ทั่วไป'
              }
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button onclick="editProduct(${product.id})" class="text-blue-600 hover:text-blue-900 mr-3" title="แก้ไข">
              <i data-lucide="edit" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteProduct(${product.id})" class="text-red-600 hover:text-red-900" title="ลบ">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }

    // ฟังก์ชันสลับสถานะยอดนิยม
    window.togglePopular = async function(productId, isPopular) {
      try {
        const response = await fetch(`/api/products/${productId}/toggle-popular`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ is_popular: isPopular })
        });

        if (response.ok) {
          Swal.fire({
            title: 'สำเร็จ!',
            text: `${isPopular ? 'ตั้งเป็นสินค้ายอดนิยม' : 'ยกเลิกสินค้ายอดนิยม'}เรียบร้อยแล้ว`,
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
          // โหลดข้อมูลใหม่
          showProductsList();
        } else {
          throw new Error('ไม่สามารถอัปเดตสถานะได้');
        }
      } catch (error) {
        Swal.fire({
          title: 'เกิดข้อผิดพลาด!',
          text: 'ไม่สามารถอัปเดตสถานะสินค้ายอดนิยมได้',
          icon: 'error'
        });
      }
    };

    // ฟังก์ชันลบสินค้า
    window.deleteProduct = async function(productId) {
      const result = await Swal.fire({
        title: 'คุณแน่ใจหรือไม่?',
        text: 'คุณต้องการลบสินค้านี้หรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก'
      });

      if (result.isConfirmed) {
        try {
          const response = await fetch(`/api/products/${productId}`, {
            method: 'DELETE'
          });

          if (response.ok) {
            Swal.fire({
             
              title: 'ลบแล้ว!',
              text: 'สินค้าถูกลบเรียบร้อยแล้ว',
              icon: 'success',
              timer: 1500,
              showConfirmButton: false
            });
            // โหลดข้อมูลใหม่
            showProductsList();
          } else {
            throw new Error('ไม่สามารถลบสินค้าได้');
          }
        } catch (error) {
          Swal.fire({
            title: 'เกิดข้อผิดพลาด!',
            text: 'ไม่สามารถลบสินค้าได้',
            icon: 'error'
          });
        }
      }
    };

    // ฟังก์ชันแก้ไขสินค้า
    window.editProduct = function(productId) {
      console.log('Navigating to edit product:', productId);
      
      // เปลี่ยน URL แบบ pushState เพื่อไม่ให้หน้ารีเฟรช
      const newUrl = `/admin/products/edit/${productId}`;
      window.history.pushState({ productId: productId }, '', newUrl);
      
      // เรียกฟังก์ชันแสดงหน้าแก้ไข
      showEditProduct(productId);
  
    };

    // Event listener สำหรับ select all checkbox
    const selectAllCheckbox = document.getElementById('select-all-products');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', function() {
        const productCheckboxes = document.querySelectorAll('.product-checkbox');
        productCheckboxes.forEach(checkbox => {
          checkbox.checked = this.checked;
        });
      });
    }

    // Event listener สำหรับลบสินค้าที่เลือก
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    if (deleteSelectedBtn) {
      deleteSelectedBtn.addEventListener('click', async function() {
        const selectedProducts = Array.from(document.querySelectorAll('.product-checkbox:checked'))
          .map(checkbox => checkbox.value);

        if (selectedProducts.length === 0) {
          Swal.fire({
            title: 'ไม่มีสินค้าที่เลือก',
            text: 'กรุณาเลือกสินค้าที่ต้องการลบ',
            icon: 'warning'
          });
          return;
        }

        const result = await Swal.fire({
          title: 'คุณแน่ใจหรือไม่?',
          text: `คุณต้องการลบสินค้า ${selectedProducts.length} รายการ หรือไม่?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#3085d6',
          confirmButtonText: 'ลบทั้งหมด',
          cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
          try {
            // ลบสินค้าทีละรายการ
            for (const productId of selectedProducts) {
              await fetch(`/api/products/${productId}`, {
                method: 'DELETE'
              });
            }

            Swal.fire({
              title: 'ลบแล้ว!',
              text: `ลบสินค้า ${selectedProducts.length} รายการเรียบร้อยแล้ว`,
              icon: 'success',
              timer: 1500,
              showConfirmButton: false
            });
            // โหลดข้อมูลใหม่
            showProductsList();
          } catch (error) {
            Swal.fire({
              title: 'เกิดข้อผิดพลาด!',
              text: 'ไม่สามารถลบสินค้าบางรายการได้',
              icon: 'error'
            });
          }
        }
      });
    }

  } catch (error) {
    console.error('Error fetching products:', error);
    const tableBody = document.getElementById('products-list-table-body');
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="px-6 py-4 text-center text-sm text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูล</td>
      </tr>
    `;
  }

  // Re-initialize icons
  lucide.createIcons();
}

// Categories View
async function showCategories() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  try {
    // โหลดข้อมูลหมวดหมู่
    const categories = await fetchAPI('/categories') || [];

    mainContent.innerHTML = `
      <div class="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">จัดการหมวดหมู่</h1>
          <p class="text-sm text-gray-600">เพิ่ม แก้ไข และลบหมวดหมู่สินค้า</p>
        </div>
        <button id="add-category-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center justify-center">
          <i data-lucide="plus" class="w-4 h-4 mr-2"></i>
          เพิ่มหมวดหมู่ใหม่
        </button>
      </div>

      <!-- Categories Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="categories-grid">
        ${categories.map(category => `
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
            <div class="p-6">
              ${category.image_url_cate ? `
                <div class="mb-4">
                  <img src="${category.image_url_cate}" alt="${category.name}" class="w-full h-32 object-cover rounded-lg">
                </div>
              ` : `
                <div class="mb-4 w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                  <i data-lucide="image" class="w-8 h-8 text-gray-400"></i>
                </div>
              `}
              
              <div class="flex items-start justify-between mb-2">
                <h3 class="text-lg font-semibold text-gray-900">${category.name}</h3>
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  category.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }">
                  ${category.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </span>
              </div>
              
              <p class="text-sm text-gray-500 mb-4">สินค้าในหมวดหมู่: ${category.products_count || 0} รายการ</p>
              
              <div class="flex justify-end space-x-2">
                <button class="text-blue-600 hover:text-blue-900 p-2" onclick="editCategory(${category.id})" title="แก้ไข">
                  <i data-lucide="edit" class="w-4 h-4"></i>
                </button>
                <button class="text-red-600 hover:text-red-900 p-2" onclick="deleteCategory(${category.id})" title="ลบ">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          </div>
        `).join('')}
        
        ${categories.length === 0 ? `
          <div class="col-span-full text-center py-12">
            <i data-lucide="folder-x" class="w-12 h-12 text-gray-400 mx-auto mb-4"></i>
            <h3 class="text-lg font-medium text-gray-900 mb-2">ยังไม่มีหมวดหมู่</h3>
            <p class="text-gray-500 mb-4">เริ่มต้นด้วยการเพิ่มหมวดหมู่แรกของคุณ</p>
            <button onclick="showCategoryModal()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md">
              เพิ่มหมวดหมู่ใหม่
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Category Modal -->
      <div id="category-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden z-50">
        <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
          <div class="mt-3">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-medium text-gray-900" id="modal-title">เพิ่มหมวดหมู่ใหม่</h3>
              <button class="text-gray-400 hover:text-gray-600" onclick="closeCategoryModal()">
                <i data-lucide="x" class="w-6 h-6"></i>
              </button>
            </div>
            
            <form id="category-form" class="space-y-4">
              <input type="hidden" id="category-id" value="">
              
              <div>
                <label for="category-name" class="block text-sm font-medium text-gray-700 mb-2">ชื่อหมวดหมู่ *</label>
                <input type="text" id="category-name" name="name" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="กรอกชื่อหมวดหมู่">
              </div>
              
              <div>
                <label for="category-image" class="block text-sm font-medium text-gray-700 mb-2">รูปภาพหมวดหมู่</label>
                <input type="file" id="category-image" accept="image/*" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100">
                <div id="category-image-preview" class="mt-2"></div>
              </div>
              
              <div class="flex items-center">
                <input type="checkbox" id="category-active" name="is_active" checked class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
                <label for="category-active" class="ml-2 block text-sm text-gray-900">เปิดใช้งาน</label>
              </div>
              
              <div class="flex justify-end space-x-3 pt-4 border-t">
                <button type="button" onclick="closeCategoryModal()" class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                  ยกเลิก
                </button>
                <button type="submit" id="category-submit-btn" class="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  <span id="category-submit-text">บันทึก</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Setup event listeners
    setupCategoryEventListeners();
    
    // Re-initialize icons
    lucide.createIcons();
  } catch (error) {
    console.error('Error loading categories:', error);
    mainContent.innerHTML = '<p class="text-red-500">เกิดข้อผิดพลาดในการโหลดหมวดหมู่</p>';
  }
}

// Setup Category Event Listeners
function setupCategoryEventListeners() {
  // Add category button
  const addCategoryBtn = document.getElementById('add-category-btn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => showCategoryModal());
  }

  // Category form
  const categoryForm = document.getElementById('category-form');
  if (categoryForm) {
    categoryForm.addEventListener('submit', handleCategorySubmit);
  }

  // Image preview
  const categoryImage = document.getElementById('category-image');
  if (categoryImage) {
    categoryImage.addEventListener('change', handleCategoryImagePreview);
  }
}

// Show Category Modal
function showCategoryModal(categoryData = null) {
  const modal = document.getElementById('category-modal');
  const modalTitle = document.getElementById('modal-title');
  const form = document.getElementById('category-form');
  
  if (!modal || !modalTitle || !form) return;

  // Reset form
  form.reset();
  document.getElementById('category-id').value = '';
  document.getElementById('category-image-preview').innerHTML = '';

  if (categoryData) {
    // Edit mode
    modalTitle.textContent = 'แก้ไขหมวดหมู่';
    document.getElementById('category-id').value = categoryData.id;
    document.getElementById('category-name').value = categoryData.name;
    document.getElementById('category-active').checked = categoryData.is_active;
    
    if (categoryData.image_url_cate) { // เปลี่ยนจาก image_url
      document.getElementById('category-image-preview').innerHTML = 
        `<img src="${categoryData.image_url_cate}" alt="Preview" class="w-32 h-32 object-cover rounded border">`;
    }
  } else {
    // Add mode
    modalTitle.textContent = 'เพิ่มหมวดหมู่ใหม่';
  }

  modal.classList.remove('hidden');
}

// Close Category Modal
function closeCategoryModal() {
  const modal = document.getElementById('category-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Handle Category Image Preview
function handleCategoryImagePreview(e) {
  const file = e.target.files[0];
  const preview = document.getElementById('category-image-preview');
  
  if (!file || !preview) return;

  try {
    // ตรวจสอบไฟล์
    validateImageFile(file);
    
    // แสดงตัวอย่าง
    showImagePreview(file, 'category-image-preview');
    
  } catch (error) {
    console.error('Invalid image file:', error);
    
    // เคลียร์ input
    e.target.value = '';
    
    // แสดงข้อผิดพลาด
    Swal.fire({
      title: 'ไฟล์ไม่ถูกต้อง',
      text: error.message,
      icon: 'error',
      confirmButtonText: 'ตกลง'
    });
    
    // เคลียร์ preview
    preview.innerHTML = '';
  }
}
// Handle Category Form Submit
// Handle Category Form Submit
async function handleCategorySubmit(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById('category-submit-btn');
  const submitText = document.getElementById('category-submit-text');
  const categoryId = document.getElementById('category-id').value;
  const isEdit = !!categoryId;
  
  // Show loading state
  submitBtn.disabled = true;
  submitText.textContent = 'กำลังบันทึก...';
  
  try {
    console.log('💾 Saving category...');
    
    const formData = new FormData(e.target);
    const imageFile = document.getElementById('category-image').files[0];
    
    let imageUrl = '';
    
    // Upload image if provided
    if (imageFile) {
      console.log('📤 Category image file selected:', imageFile.name);
      
      try {
        // ตรวจสอบไฟล์ก่อนอัปโหลด
        validateImageFile(imageFile);
        
        // อัปโหลดรูปภาพ
        submitText.textContent = 'กำลังอัปโหลดรูปภาพ...';
        imageUrl = await uploadImageToSupabase(imageFile);
        
        console.log('✅ Category image uploaded:', imageUrl);
        
      } catch (uploadError) {
        console.error('❌ Category image upload failed:', uploadError);
        throw new Error(`ไม่สามารถอัปโหลดรูปภาพได้: ${uploadError.message}`);
      }
    }
    
    // Prepare category data
    const categoryData = {
      name: formData.get('name'),
      is_active: document.getElementById('category-active').checked
    };
    
    // เพิ่ม image URL ถ้ามีการอัปโหลดรูปภาพ
    if (imageUrl) {
      categoryData.image_url_cate = imageUrl;
    }
    
    console.log('📝 Category data to save:', categoryData);
    
    // Save category
    submitText.textContent = 'กำลังบันทึกข้อมูล...';
    
    const url = isEdit ? `/api/categories/${categoryId}` : '/api/categories';
    const method = isEdit ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(categoryData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Category saved successfully');
      
      // แสดงความสำเร็จ
      Swal.fire({
        title: 'สำเร็จ!',
        text: `${isEdit ? 'แก้ไข' : 'เพิ่ม'}หมวดหมู่เรียบร้อยแล้ว`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
      
      // ปิด modal
      closeCategoryModal();
      
      // รีโหลดหน้าหมวดหมู่
      showCategories();
      
    } else {
      throw new Error(result.message || 'ไม่สามารถบันทึกหมวดหมู่ได้');
    }
    
  } catch (error) {
    console.error('❌ Error saving category:', error);
    Swal.fire({
      title: 'เกิดข้อผิดพลาด!',
      text: error.message || 'ไม่สามารถบันทึกหมวดหมู่ได้',
      icon: 'error',
      confirmButtonText: 'ตกลง'
    });
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitText.textContent = 'บันทึก';
  }
}

// Global functions for category management
window.editCategory = async function(categoryId) {
  try {
    const response = await fetch(`/api/categories/${categoryId}`);
    if (response.ok) {
      const category = await response.json();
      showCategoryModal(category);
    } else {
      throw new Error('ไม่สามารถโหลดข้อมูลหมวดหมู่ได้');
    }
  } catch (error) {
    console.error('Error loading category:', error);
    Swal.fire({
      title: 'เกิดข้อผิดพลาด!',
      text: 'ไม่สามารถโหลดข้อมูลหมวดหมู่ได้',
      icon: 'error'
    });
  }
};

window.deleteCategory = async function(categoryId) {
  const result = await Swal.fire({
    title: 'คุณแน่ใจหรือไม่?',
    text: 'คุณต้องการลบหมวดหมู่นี้หรือไม่?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก'
  });

  if (result.isConfirmed) {
    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (response.ok && result.success) {
        Swal.fire({
          title: 'ลบแล้ว!',
          text: 'หมวดหมู่ถูกลบเรียบร้อยแล้ว',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
        showCategories(); // Reload categories
      } else {
        throw new Error(result.error || 'ไม่สามารถลบหมวดหมู่ได้');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      Swal.fire({
        title: 'เกิดข้อผิดพลาด!',
        text: error.message || 'ไม่สามารถลบหมวดหมู่ได้',
        icon: 'error'
      });
    }
  }
};

// Settings View
function showSettings() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  // ตรวจสอบ path เพื่อแสดงหน้าต่างๆ ในเมนูย่อย settings
  const path = window.location.pathname;
  if (path === '/admin/settings/home') {
    return showSettingsHome();
  }
  if (path === '/admin/settings/about') {
    return showSettingsAbout();
  }
  if (path === '/admin/settings/contact') {
    return showSettingsContact();
  }

  // Default settings overview
  mainContent.innerHTML = `
    <h1 class="text-2xl font-bold mb-4">ตั้งค่า</h1>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <a href="/admin/settings/home" class="block p-6 bg-white rounded-xl shadow hover:bg-indigo-50 transition">
        <div class="flex items-center mb-2">
          <i data-lucide="home" class="w-6 h-6 text-indigo-600 mr-2"></i>
          <span class="font-semibold text-lg">หน้าแรก</span>
        </div>
        <p class="text-gray-600 text-sm">ตั้งค่าข้อมูลหน้าแรกของเว็บไซต์</p>
      </a>
      <a href="/admin/settings/about" class="block p-6 bg-white rounded-xl shadow hover:bg-indigo-50 transition">
        <div class="flex items-center mb-2">
          <i data-lucide="info" class="w-6 h-6 text-indigo-600 mr-2"></i>
          <span class="font-semibold text-lg">เกี่ยวกับเรา</span>
        </div>
        <p class="text-gray-600 text-sm">แก้ไขข้อมูลเกี่ยวกับร้าน</p>
      </a>
      <a href="/admin/settings/contact" class="block p-6 bg-white rounded-xl shadow hover:bg-indigo-50 transition">
        <div class="flex items-center mb-2">
          <i data-lucide="phone" class="w-6 h-6 text-indigo-600 mr-2"></i>
          <span class="font-semibold text-lg">ติดต่อเรา</span>
        </div>
        <p class="text-gray-600 text-sm">แก้ไขข้อมูลการติดต่อ</p>
      </a>
      <a href="/admin/settings/logo" class="block p-6 bg-white rounded-xl shadow hover:bg-indigo-50 transition">
        <div class="flex items-center mb-2">
          <i data-lucide="image" class="w-6 h-6 text-indigo-600 mr-2"></i>
          <span class="font-semibold text-lg">ตั้งค่า Logo</span>
        </div>
        <p class="text-gray-600 text-sm">ตั้งค่าข้อมูลเกี่ยวกับ logo</p>
      </a>
       <a href="/admin/settings/payments" class="block p-6 bg-white rounded-xl shadow hover:bg-indigo-50 transition">
        <div class="flex items-center mb-2">
          <i data-lucide="credit-card" class="w-6 h-6 text-indigo-600 mr-2"></i>
          <span class="font-semibold text-lg">ตั้งค่า วิธีการชำระเงิน</span>
        </div>
        <p class="text-gray-600 text-sm">ตั้งค่าข้อมูลเกี่ยวกับหน้าวิธีการชำระเงิน</p>
      </a>
    </div>
  `;
  lucide.createIcons();
}

// หน้า admin > ตั้งค่า > หน้าแรก
async function showSettingsHome() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  // โหลดข้อมูล homepage_setting จาก API
  let homepage = null;
  try {
    const response = await fetch('/api/homepage-setting');
    if (response.ok) {
      homepage = await response.json();
    }
  } catch {
    console.log('Error loading homepage settings');
  }

  // // ฟังก์ชันอัปโหลดรูปไป Supabase
  // async function uploadImageToSupabase(file) {
  //   const formData = new FormData();
  //   formData.append('images', file);
    
  //   try {
  //     console.log('Starting upload for file:', file.name, 'Size:', file.size);
      
  //     const response = await fetch('/api/upload', {
  //       method: 'POST',
  //       body: formData
  //     });
      
  //     console.log('Upload response status:', response.status);
      
  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       console.error('Upload failed:', errorData);
  //       throw new Error(errorData.error || `Upload failed: ${response.status}`);
  //     }
      
  //     const data = await response.json();
  //     console.log('Upload response data:', data);
      
  //     if (data.success && data.urls && data.urls.length > 0) {
  //       return data.urls[0];
  //     } else {
  //       throw new Error(data.error || 'Upload failed: No URL returned');
  //     }
  //   } catch (error) {
  //     console.error('Error uploading image:', error);
      
  //     // แสดง error ให้ผู้ใช้เห็น
  //     Swal.fire({
  //       icon: 'error',
  //       title: 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ',
  //       text: error.message || 'ไม่สามารถอัปโหลดรูปภาพได้',
  //       confirmButtonText: 'ตกลง'
  //     });
      
  //     return null;
  //   }
  // }

  function renderCarouselBody(idx) {
    return `
      <form id="settings-carousel-${idx}-form" class="space-y-4 mb-8">
        <div>
          <label class="block mb-1 font-medium text-gray-700">หัวข้อ</label>
          <input name="carousel_${idx}_title" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.[`carousel_${idx}_title`] || ''}" placeholder="หัวข้อ Carousel ${idx}">
        </div>
        <div>
          <label class="block mb-1 font-medium text-gray-700">คำอธิบาย</label>
          <textarea name="carousel_${idx}_subtitle" rows="2" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" placeholder="คำอธิบาย Carousel ${idx}">${homepage?.[`carousel_${idx}_subtitle`] || ''}</textarea>
        </div>
        <div>
          <label class="block mb-1 font-medium text-gray-700">รูปภาพ Banner</label>
          <input type="file" id="carousel-${idx}-banner" accept="image/*" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
          <div id="carousel-${idx}-banner-preview" class="mt-2">
            ${homepage?.[`carousel_${idx}_image`] ? `<img src="${homepage[`carousel_${idx}_image`]}" alt="Carousel ${idx}" class="w-32 h-20 object-cover rounded border">` : ''}
          </div>
        </div>
        <div class="flex justify-end">
          <button type="button" id="save-carousel-${idx}" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-semibold">บันทึก Carousel ${idx}</button>
        </div>
      </form>
    `;
  }

  mainContent.innerHTML = `
    <div class="max-w-4xl mx-auto grid grid-cols-1 gap-8">
      <!-- Hero Section Card -->
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <i data-lucide="star" class="w-5 h-5"></i> Hero Section
        </h2>
        <form id="settings-hero-form" class="space-y-4 mb-8">
          <div>
            <label class="block mb-1 font-medium text-gray-700">หัวข้อหลัก (Hero Title)</label>
            <input name="hero_title" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.hero_title || ''}">
          </div>
          <div>
            <label class="block mb-1 font-medium text-gray-700">คำอธิบาย (Hero Subtitle)</label>
            <textarea name="hero_subtitle" rows="2" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500">${homepage?.hero_subtitle || ''}</textarea>
          </div>
          <div class="flex justify-end">
            <button type="button" id="save-hero" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-semibold">บันทึก Hero</button>
          </div>
        </form>
      </div>
      
      <!-- Carousel 1 Card -->
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <i data-lucide="image" class="w-5 h-5"></i> Carousel 1
        </h2>
        ${renderCarouselBody(1)}
      </div>
      
      <!-- Carousel 2 Card -->
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <i data-lucide="image" class="w-5 h-5"></i> Carousel 2
        </h2>
        ${renderCarouselBody(2)}
      </div>
      
      <!-- Carousel 3 Card -->
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <i data-lucide="image" class="w-5 h-5"></i> Carousel 3
        </h2>
        ${renderCarouselBody(3)}
      </div>

      <!-- Why Choose Us Section Card -->
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <i data-lucide="award" class="w-5 h-5"></i> ทำไมต้องซื้อกับเรา
        </h2>
        <form id="settings-why-choose-form" class="space-y-4 mb-8">
          <div>
            <label class="block mb-1 font-medium text-gray-700">หัวข้อหลัก</label>
            <input name="why_choose_title" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.why_choose_title || 'ทำไมต้องซื้อกับ AquaRoom'}" placeholder="ทำไมต้องซื้อกับ AquaRoom">
          </div>
          <div>
            <label class="block mb-1 font-medium text-gray-700">คำอธิบาย</label>
            <textarea name="why_choose_subtitle" rows="2" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" placeholder="เรามุ่งมั่นให้บริการที่ดีที่สุด เพื่อความพึงพอใจของลูกค้าทุกท่าน">${homepage?.why_choose_subtitle || 'เรามุ่งมั่นให้บริการที่ดีที่สุด เพื่อความพึงพอใจของลูกค้าทุกท่าน'}</textarea>
          </div>
          <div class="flex justify-end">
            <button type="button" id="save-why-choose" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-semibold">บันทึกส่วนนี้</button>
          </div>
        </form>
      </div>

      <!-- Quality Guarantee Section Card -->
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <i data-lucide="shield-check" class="w-5 h-5"></i> รับประกันคุณภาพ
        </h2>
        <form id="settings-quality-form" class="space-y-4 mb-8">
          <div>
            <label class="block mb-1 font-medium text-gray-700">หัวข้อหลัก</label>
            <input name="quality_title" class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" value="${homepage?.quality_title || 'รับประกันคุณภาพ 100%'}" placeholder="รับประกันคุณภาพ 100%">
          </div>
          <div>
            <label class="block mb-1 font-medium text-gray-700">คำอธิบาย</label>
            <textarea name="quality_subtitle" rows="2" class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="สินค้าทุกชิ้นผ่านการตรวจสอบคุณภาพอย่างเข้มงวด พร้อมการรับประกันและบริการหลังการขาย">${homepage?.quality_subtitle || 'สินค้าทุกชิ้นผ่านการตรวจสอบคุณภาพอย่างเข้มงวด พร้อมการรับประกันและบริการหลังการขาย'}</textarea>
          </div>
          <div class="grid grid-cols-1 gap-4">
            <div>
              <label class="block mb-1 font-medium text-gray-700">ฟีเจอร์ที่ 1</label>
              <input name="quality_feature_1" class="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.quality_feature_1 || 'ตรวจสอบคุณภาพก่อนส่ง'}" placeholder="ตรวจสอบคุณภาพก่อนส่ง">
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700">ฟีเจอร์ที่ 2</label>
              <input name="quality_feature_2" class="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.quality_feature_2 || 'รับประกันสินค้า 1 ปีเต็ม'}" placeholder="รับประกันสินค้า 1 ปีเต็ม">
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700">ฟีเจอร์ที่ 3</label>
              <input name="quality_feature_3" class="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.quality_feature_3 || 'บริการหลังการขายตลอด 24/7'}" placeholder="บริการหลังการขายตลอด 24/7">
            </div>
          </div>
          <div class="flex justify-end">
            <button type="button" id="save-quality" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-semibold">บันทึกส่วนนี้</button>
          </div>
        </form>
      </div>

      <!-- Statistics Section Card -->
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <i data-lucide="trending-up" class="w-5 h-5 mr-2 text-indigo-600"></i>
          สถิติและความสำเร็จ
        </h2>
        <form id="settings-stats-form" class="space-y-4 mb-8">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-3">
              <h4 class="font-medium text-gray-900 mb-2">สถิติ 1</h4>
              <input name="stat_1_number" class="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.stat_1_number || '10,000+'}" placeholder="ตัวเลข เช่น 10,000+">
              <input name="stat_1_label" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.stat_1_label || 'ลูกค้าที่ไว้วางใจ'}" placeholder="คำอธิบาย เช่น ลูกค้าที่ไว้วางใจ">
            </div>
            <div class="space-y-3">
              <h4 class="font-medium text-gray-900 mb-2">สถิติ 2</h4>
              <input name="stat_2_number" class="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.stat_2_number || '99.8%'}" placeholder="ตัวเลข เช่น 99.8%">
              <input name="stat_2_label" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.stat_2_label || 'ความพึงพอใจ'}" placeholder="คำอธิบาย เช่น ความพึงพอใจ">
            </div>
            <div class="space-y-3">
              <h4 class="font-medium text-gray-900 mb-2">สถิติ 3</h4>
              <input name="stat_3_number" class="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.stat_3_number || '1-3 วัน'}" placeholder="ตัวเลข เช่น 1-3 วัน">
              <input name="stat_3_label" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.stat_3_label || 'จัดส่งเร็ว'}" placeholder="คำอธิบาย เช่น จัดส่งเร็ว">
            </div>
            <div class="space-y-3">
              <h4 class="font-medium text-gray-900 mb-2">สถิติ 4</h4>
              <input name="stat_4_number" class="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.stat_4_number || '5★'}" placeholder="ตัวเลข เช่น 5★">
              <input name="stat_4_label" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.stat_4_label || 'เรตติ้งเฉลี่ย'}" placeholder="คำอธิบาย เช่น เรตติ้งเฉลี่ย">
            </div>
          </div>
          <div class="flex justify-end">
            <button type="button" id="save-stats" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-semibold">บันทึกสถิติ</button>
          </div>
        </form>
      </div>

      <!-- Customer Review Section Card -->
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <i data-lucide="message-circle" class="w-5 h-5"></i> รีวิวลูกค้า
        </h2>
        <form id="settings-review-form" class="space-y-4 mb-8">
          <div>
            <label class="block mb-1 font-medium text-gray-700">ข้อความรีวิว</label>
            <textarea name="review_text" rows="3" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" placeholder="สินค้าคุณภาพดี จัดส่งเร็ว บรรจุภัณฑ์ดี บริการประทับใจมาก จะกลับมาซื้ออีกแน่นอน">${homepage?.review_text || 'สินค้าคุณภาพดี จัดส่งเร็ว บรรจุภัณฑ์ดี บริการประทับใจมาก จะกลับมาซื้ออีกแน่นอน'}</textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block mb-1 font-medium text-gray-700">ชื่อลูกค้า</label>
              <input name="review_name" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.review_name || 'คุณสมชาย ใจดี'}" placeholder="คุณสมชาย ใจดี">
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700">ตำแหน่ง/สถานะ</label>
              <input name="review_title" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.review_title || 'ลูกค้า VIP'}" placeholder="ลูกค้า VIP">
            </div>
          </div>
          <div class="flex justify-end">
            <button type="button" id="save-review" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-semibold">บันทึกรีวิว</button>
          </div>
        </form>
      </div>

      <!-- Features Section Card -->
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <i data-lucide="grid-3x3" class="w-5 h-5"></i> ฟีเจอร์หลัก (4 การ์ด)
        </h2>
        <div class="space-y-6">
          ${[1, 2, 3, 4].map(i => `
            <div class="border-l-4 border-indigo-500 pl-4">
              <h4 class="font-medium text-gray-900 mb-3">ฟีเจอร์ ${i}</h4>
              <div class="space-y-3">
                <input name="feature_${i}_title" class="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.[`feature_${i}_title`] || ''}" placeholder="หัวข้อ เช่น จัดส่งรวดเร็ว">
                <textarea name="feature_${i}_desc" rows="2" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" placeholder="คำอธิบาย">${homepage?.[`feature_${i}_desc`] || ''}</textarea>
                <input name="feature_${i}_note" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.[`feature_${i}_note`] || ''}" placeholder="หมายเหตุ เช่น ✓ จัดส่งฟรีเมื่อซื้อครบ 1,000 บาท">
              </div>
            </div>
          `).join('')}
          <div class="flex justify-end">
            <button type="button" id="save-features" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-semibold">บันทึกฟีเจอร์</button>
          </div>
        </div>
      </div>

      <!-- Call to Action Section Card -->
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <i data-lucide="megaphone" class="w-5 h-5"></i> Call to Action
        </h2>
        <form id="settings-cta-form" class="space-y-4 mb-8">
          <div>
            <label class="block mb-1 font-medium text-gray-700">หัวข้อหลัก</label>
            <input name="cta_title" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.cta_title || 'พร้อมสัมผัสประสบการณ์การช็อปปิ้งที่ดีที่สุด?'}" placeholder="พร้อมสัมผัสประสบการณ์การช็อปปิ้งที่ดีที่สุด?">
          </div>
          <div>
            <label class="block mb-1 font-medium text-gray-700">คำอธิบาย</label>
            <textarea name="cta_subtitle" rows="2" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" placeholder="เข้าร่วมกับลูกค้ามากกว่า 10,000 ท่านที่เลือกซื้อกับเรา">${homepage?.cta_subtitle || 'เข้าร่วมกับลูกค้ามากกว่า 10,000 ท่านที่เลือกซื้อกับเรา'}</textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <h4 class="font-medium text-gray-900">ปุ่ม 1</h4>
              <input name="cta_button_1_text" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.cta_button_1_text || 'เริ่มช็อปปิ้งเลย'}" placeholder="ข้อความปุ่ม">
              <input name="cta_button_1_link" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.cta_button_1_link || '/products'}" placeholder="ลิงก์ เช่น /products">
            </div>
            <div class="space-y-2">
              <h4 class="font-medium text-gray-900">ปุ่ม 2</h4>
              <input name="cta_button_2_text" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.cta_button_2_text || 'เรียนรู้เพิ่มเติม'}" placeholder="ข้อความปุ่ม">
              <input name="cta_button_2_link" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${homepage?.cta_button_2_link || '/about'}" placeholder="ลิงก์ เช่น /about">
            </div>
          </div>
          <div class="flex justify-end">
            <button type="button" id="save-cta" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-semibold">บันทึก CTA</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  // ฟังก์ชันบันทึกแต่ละส่วน
  async function saveHomepageSection(data, sectionName) {
    try {
      console.log('Sending homepage data to API:', data); // Debug log
      
      // เปลี่ยนจาก /api/about-setting เป็น /api/homepage-setting
      const response = await fetch('/api/homepage-setting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      console.log('Homepage API Response:', result); // Debug log
      
      if (response.ok && result.success) {
        Swal.fire({
          title: 'สำเร็จ!',
          text: `บันทึก${sectionName}เรียบร้อยแล้ว`,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Save error:', error);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด!',
        text: `ไม่สามารถบันทึก${sectionName}ได้: ${error.message}`
      });
    }
  }

  // Event handlers
  document.getElementById('save-hero').onclick = function () {
    const form = document.getElementById('settings-hero-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    saveHomepageSection(data, 'Hero Section'); // เปลี่ยนจาก saveSection
  };

  document.getElementById('save-why-choose').onclick = function () {
    const form = document.getElementById('settings-why-choose-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    saveHomepageSection(data, 'ส่วนทำไมต้องซื้อกับเรา'); // เปลี่ยนจาก saveSection
  };

  document.getElementById('save-quality').onclick = function () {
    const form = document.getElementById('settings-quality-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    saveHomepageSection(data, 'ส่วนรับประกันคุณภาพ'); // เปลี่ยนจาก saveSection
  };

  document.getElementById('save-stats').onclick = function () {
    const form = document.getElementById('settings-stats-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    saveHomepageSection(data, 'ส่วนสถิติ'); // เปลี่ยนจาก saveSection
  };

  document.getElementById('save-review').onclick = function () {
    const form = document.getElementById('settings-review-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    saveHomepageSection(data, 'ส่วนรีวิวลูกค้า'); // เปลี่ยนจาก saveSection
  };

  document.getElementById('save-features').onclick = function () {
    const formElements = [1, 2, 3, 4].reduce((acc, i) => {
      acc[`feature_${i}_title`] = document.querySelector(`input[name="feature_${i}_title"]`).value;
      acc[`feature_${i}_desc`] = document.querySelector(`textarea[name="feature_${i}_desc"]`).value;
      acc[`feature_${i}_note`] = document.querySelector(`input[name="feature_${i}_note"]`).value;
      return acc;
    }, {});
    saveHomepageSection(formElements, 'ส่วนฟีเจอร์'); // เปลี่ยนจาก saveSection
  };

  document.getElementById('save-cta').onclick = function () {
    const form = document.getElementById('settings-cta-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    saveHomepageSection(data, 'ส่วน Call to Action'); // เปลี่ยนจาก saveSection
  };

  document.getElementById('save-carousel-1').onclick = async function () {
    const form = document.getElementById('settings-carousel-1-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    const bannerFile = document.getElementById('carousel-1-banner').files[0];
    if (bannerFile) {
      const imageUrl = await uploadImageToSupabase(bannerFile);
      if (imageUrl) {
        data.carousel_1_image = imageUrl;
      }
    }
    
    saveHomepageSection(data, 'Carousel 1'); // เปลี่ยนจาก saveSection
  };

  document.getElementById('save-carousel-2').onclick = async function () {
    const form = document.getElementById('settings-carousel-2-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    const bannerFile = document.getElementById('carousel-2-banner').files[0];
    if (bannerFile) {
      const imageUrl = await uploadImageToSupabase(bannerFile);
      if (imageUrl) {
        data.carousel_2_image = imageUrl;
      }
    }
    
    saveHomepageSection(data, 'Carousel 2');
  };

  document.getElementById('save-carousel-3').onclick = async function () {
    const form = document.getElementById('settings-carousel-3-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    const bannerFile = document.getElementById('carousel-3-banner').files[0];
    if (bannerFile) {
      const imageUrl = await uploadImageToSupabase(bannerFile);
      Swal.close();
      
      if (imageUrl) {
        data.carousel_3_image = imageUrl;
      }
    }
    
    saveHomepageSection(data, 'Carousel 3');
  };

  // Preview รูป Banner เมื่อเลือกไฟล์ใหม่
  [1, 2, 3].forEach(idx => {
    document.getElementById(`carousel-${idx}-banner`).addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          document.getElementById(`carousel-${idx}-banner-preview`).innerHTML = 
            `<img src="${e.target.result}" alt="Carousel ${idx} Preview" class="w-32 h-20 object-cover rounded border">`;
        };
        reader.readAsDataURL(file);
      }
    });
  });
}

// หน้า admin > ตั้งค่า > เกี่ยวกับเรา
async function showSettingsAbout() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  // โหลดข้อมูล about_setting จาก API
  let about = null;
  try {
    about = await fetchAPI('/about-setting');
  } catch {
    about = null;
  }

  // ฟังก์ชันอัปโหลดรูปไป Supabase
  async function uploadImageToSupabase(file) {
    const formData = new FormData();
    formData.append('images', file);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      return result.urls?.[0] || null;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  }

  mainContent.innerHTML = `
    <div class="max-w-4xl mx-auto grid grid-cols-1 gap-8">
      <!-- Hero Section Card -->
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <i data-lucide="star" class="w-5 h-5"></i> Hero Section
        </h2>
        <form id="about-hero-form" class="space-y-4 mb-8">
          <div>
            <label class="block mb-1 font-medium text-gray-700">หัวข้อหลัก</label>
            <input name="hero_title" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${about?.hero_title || ''}">
          </div>
          <div>
            <label class="block mb-1 font-medium text-gray-700">คำอธิบาย</label>
            <textarea name="hero_subtitle" rows="2" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500">${about?.hero_subtitle || ''}</textarea>
          </div>
          <div class="flex justify-end">
            <button type="button" id="save-about-hero" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-semibold">บันทึก Hero</button>
          </div>
        </form>
      </div>

      <!-- Our Story Section Card -->
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <i data-lucide="book-open" class="w-5 h-5"></i> เรื่องราวของเรา
        </h2>
        <form id="about-story-form" class="space-y-4 mb-8">
          <div>
            <label class="block mb-1 font-medium text-gray-700">หัวข้อ</label>
            <input name="story_title" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${about?.story_title || ''}">
          </div>
          <div>
            <label class="block mb-1 font-medium text-gray-700">เนื้อหา</label>
            <textarea name="story_content" rows="6" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500">${about?.story_content || ''}</textarea>
          </div>
          <div>
            <label class="block mb-1 font-medium text-gray-700">รูปภาพ</label>
            <input type="file" id="story-image" accept="image/*" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100">
            <div id="story-image-preview" class="mt-2">
              ${about?.story_image_url ? `<img src="${about.story_image_url}" alt="Story Image" class="w-32 h-32 object-cover rounded border">` : ''}
            </div>
          </div>
          <div class="flex justify-end">
            <button type="button" id="save-about-story" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-semibold">บันทึกเรื่องราว</button>
          </div>
        </form>
      </div>

      <!-- Mission Section Card -->
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <i data-lucide="target" class="w-5 h-5"></i> วิสัยทัศน์และพันธกิจ
        </h2>
        <form id="about-mission-form" class="space-y-4 mb-8">
          <div>
            <label class="block mb-1 font-medium text-gray-700">หัวข้อหลัก</label>
            <input name="mission_title" class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" value="${about?.mission_title || ''}">
          </div>
          <div>
            <label class="block mb-1 font-medium text-gray-700">คำอธิบาย</label>
            <textarea name="mission_subtitle" rows="2" class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">${about?.mission_subtitle || ''}</textarea>
          </div>
          
          <!-- Mission Cards -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div class="border-l-4 border-indigo-500 pl-4">
              <h4 class="font-medium text-gray-900 mb-2">พันธกิจ 1</h4>
              <input name="mission_1_title" class="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:ring-2 focus:ring-indigo-500" value="${about?.mission_1_title || ''}" placeholder="หัวข้อ">
              <textarea name="mission_1_desc" rows="3" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" placeholder="คำอธิบาย">${about?.mission_1_desc || ''}</textarea>
            </div>
            <div class="border-l-4 border-green-500 pl-4">
              <h4 class="font-medium text-gray-900 mb-2">พันธกิจ 2</h4>
              <input name="mission_2_title" class="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:ring-2 focus:ring-indigo-500" value="${about?.mission_2_title || ''}" placeholder="หัวข้อ">
              <textarea name="mission_2_desc" rows="3" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" placeholder="คำอธิบาย">${about?.mission_2_desc || ''}</textarea>
            </div>
            <div class="border-l-4 border-purple-500 pl-4">
              <h4 class="font-medium text-gray-900 mb-2">พันธกิจ 3</h4>
        </form>
      </div>

      <!-- Call to Action Section Card -->
      <div class="bg-white rounded-xl shadow p-8">
        <h2 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">
          <i data-lucide="megaphone" class="w-5 h-5"></i> Call to Action
        </h2>
        <form id="about-cta-form" class="space-y-4 mb-8">
          <div>
            <label class="block mb-1 font-medium text-gray-700">หัวข้อหลัก</label>
            <input name="cta_title" class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" value="${about?.cta_title || 'พร้อมเป็นส่วนหนึ่งกับเราแล้วหรือยัง?'}" placeholder="พร้อมเป็นส่วนหนึ่งกับเราแล้วหรือยัง?">
          </div>
          <div>
            <label class="block mb-1 font-medium text-gray-700">คำอธิบาย</label>
            <textarea name="cta_subtitle" rows="2" class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="เริ่มต้นประสบการณ์การช็อปปิ้งที่ดีที่สุดกับเราวันนี้">${about?.cta_subtitle || 'เริ่มต้นประสบการณ์การช็อปปิ้งที่ดีที่สุดกับเราวันนี้'}</textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <h4 class="font-medium text-gray-900">ปุ่ม 1</h4>
              <input name="cta_button_1_text" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${about?.cta_button_1_text || 'เริ่มช็อปปิ้ง'}" placeholder="ข้อความปุ่ม">
              <input name="cta_button_1_link" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${about?.cta_button_1_link || '/products'}" placeholder="ลิงก์ เช่น /products">
            </div>
            <div class="space-y-2">
              <h4 class="font-medium text-gray-900">ปุ่ม 2</h4>
              <input name="cta_button_2_text" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${about?.cta_button_2_text || 'ติดต่อเรา'}" placeholder="ข้อความปุ่ม">
              <input name="cta_button_2_link" class="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500" value="${about?.cta_button_2_link || '/contact'}" placeholder="ลิงก์ เช่น /contact">
            </div>
          </div>
          <div class="flex justify-end">
            <button type="button" id="save-about-cta" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-semibold">บันทึก CTA</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  // ฟังก์ชันบันทึกแต่ละส่วน
  async function saveSection(data, sectionName) {
    try {
      console.log('Sending about data to API:', data);
      
      const response = await fetch('/api/about-setting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ!',
          text: `บันทึก${sectionName}เรียบร้อยแล้ว`,
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Save error:', error);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด!',
        text: `ไม่สามารถบันทึก${sectionName}ได้: ${error.message}`
      });
    }
  }
  
  // Event handlers
  document.getElementById('save-about-hero').onclick = function() {
    const form = document.getElementById('about-hero-form');
    saveSection({
      hero_title: form.hero_title.value,
      hero_subtitle: form.hero_subtitle.value
    }, 'ส่วน Hero');
  };

  document.getElementById('save-about-story').onclick = async function() {
    const form = document.getElementById('about-story-form');
    const imageFile = document.getElementById('story-image').files[0];
    
    let imageUrl = about?.story_image_url || '';
    if (imageFile) {
      imageUrl = await uploadImageToSupabase(imageFile);
    }
    
    saveSection({
      story_title: form.story_title.value,
      story_content: form.story_content.value,
      story_image_url: imageUrl
    }, 'เรื่องราวของเรา');
  };

  document.getElementById('save-about-mission').onclick = function() {
    const form = document.getElementById('about-mission-form');
    saveSection({
      mission_title: form.mission_title.value,
      mission_subtitle: form.mission_subtitle.value,
      mission_1_title: form.mission_1_title.value,
      mission_1_desc: form.mission_1_desc.value,
      mission_2_title: form.mission_2_title.value,
      mission_2_desc: form.mission_2_desc.value,
      mission_3_title: form.mission_3_title.value,
      mission_3_desc: form.mission_3_desc.value
    }, 'พันธกิจ');
  };

  document.getElementById('save-about-values').onclick = function() {
    const form = document.getElementById('about-values-form');
    const data = {
      values_title: form.values_title.value,
      values_subtitle: form.values_subtitle.value
    };
    
    for (let i = 1; i <= 4; i++) {
      data[`value_${i}_title`] = form[`value_${i}_title`].value;
      data[`value_${i}_desc`] = form[`value_${i}_desc`].value;
    }
    
    saveSection(data, 'ค่านิยม');
  };

  document.getElementById('save-about-cta').onclick = function() {
    const form = document.getElementById('about-cta-form');
    saveSection({
      cta_title: form.cta_title.value,
      cta_subtitle: form.cta_subtitle.value,
      cta_button_1_text: form.cta_button_1_text.value,
      cta_button_1_link: form.cta_button_1_link.value,
      cta_button_2_text: form.cta_button_2_text.value,
      cta_button_2_link: form.cta_button_2_link.value
    }, 'Call to Action');
  };

  // Image preview handlers
  document.getElementById('story-image').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        document.getElementById('story-image-preview').innerHTML = 
          `<img src="${e.target.result}" alt="Story Preview" class="w-32 h-32 object-cover rounded border">`;
      };
      reader.readAsDataURL(file);
    }
  });
}

// Orders View
function showOrders() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;
  
  mainContent.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">จัดการคำสั่งซื้อ</h1>
      <p class="text-sm text-gray-600">ระบบนี้อยู่ระหว่างการพัฒนา</p>
    </div>
    <div class="bg-white rounded-xl shadow-sm p-8 text-center">
      <i data-lucide="shopping-cart" class="w-12 h-12 text-gray-400 mx-auto mb-4"></i>
      <h3 class="text-lg font-medium text-gray-900 mb-2">กำลังพัฒนา</h3>
      <p class="text-gray-500">ฟีเจอร์จัดการคำสั่งซื้อจะเปิดให้ใช้งานเร็วๆ นี้</p>
    </div>
  `;
  lucide.createIcons();
}

// Customers View
// ใน app.js หาฟังก์ชัน showCustomers และแทนที่ด้วย:

// ใน app.js หาฟังก์ชัน showCustomers และแทนที่ด้วย:
async function showCustomers() {
  console.log('📋 showCustomers() called');
  
  const mainContent = document.getElementById('main-content');
  if (!mainContent) {
    console.error('❌ main-content element not found');
    return;
  }

  try {
    // แสดงสถานะกำลังโหลด
    mainContent.innerHTML = `
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p class="text-gray-600">กำลังโหลดระบบจัดการลูกค้า...</p>
          <p class="text-sm text-gray-500 mt-2" id="loading-status">กำลังเตรียมข้อมูล...</p>
        </div>
      </div>
    `;

    const statusElement = document.getElementById('loading-status');
    
    // ลิสต์ path ที่เป็นไปได้
    const possiblePaths = [
      '/admin/js/customers-manager.js',
      '/static/admin/js/customers-manager.js',
      './js/customers-manager.js'
    ];
    
    console.log('🔎 Checking possible paths for customers-manager.js...');
    
    // ตรวจสอบ path ไหนที่ accessible
    let accessiblePath = null;
    for (const path of possiblePaths) {
      statusElement.textContent = `กำลังตรวจสอบ: ${path}`;
      const isAccessible = await checkFileAccessible(path);
      if (isAccessible) {
        accessiblePath = path;
        console.log(`✅ Found accessible path: ${path}`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100)); // หน่วงเวลาเล็กน้อย
    }
    
    if (!accessiblePath) {
      throw new Error('ไม่พบไฟล์ customers-manager.js ในทุก path ที่ตรวจสอบ');
    }
    
    // โหลด script
    statusElement.textContent = 'กำลังโหลดไฟล์...';
    
    if (!window.CustomersManager) {
      console.log(`📥 Loading customers-manager.js from: ${accessiblePath}`);
      await loadScript(accessiblePath);
      
      // รอให้ script execute
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!window.CustomersManager) {
        throw new Error('ไม่สามารถโหลด CustomersManager class ได้');
      }
    }

    statusElement.textContent = 'กำลังเตรียมระบบ...';
    
    // สร้าง instance
    if (!window.customersManager) {
      console.log('🏗️ Creating CustomersManager instance...');
      
      if (typeof window.CustomersManager !== 'function') {
        throw new Error('CustomersManager ไม่ใช่ constructor function');
      }
      
      window.customersManager = new window.CustomersManager();
    }
    
    // ตรวจสอบว่า instance มี method initialize หรือไม่
    if (!window.customersManager || typeof window.customersManager.initialize !== 'function') {
      throw new Error('CustomersManager instance ไม่มี initialize method');
    }

    statusElement.textContent = 'กำลังโหลดข้อมูลลูกค้า...';
    
    // Initialize
    console.log('🚀 Initializing customers manager...');
    await window.customersManager.initialize();
    
    console.log('✅ Customers management system loaded successfully');

  } catch (error) {
    console.error('❌ Error in showCustomers:', error);
    
    // แสดง error UI พร้อมข้อมูล debug
    mainContent.innerHTML = `
      <div class="max-w-2xl mx-auto text-center py-12">
        <div class="text-red-500 mb-6">
          <i data-lucide="alert-circle" class="w-16 h-16 mx-auto mb-4"></i>
          <h3 class="text-xl font-bold mb-2">เกิดข้อผิดพลาดในการโหลดระบบจัดการลูกค้า</h3>
          <p class="text-base mb-4">${error.message}</p>
        </div>
        
        <div class="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <h4 class="font-semibold mb-2">ข้อมูล Debug:</h4>
          <div class="text-sm text-gray-600 space-y-1">
            <div>🌐 Current URL: ${window.location.href}</div>
            <div>📁 Base Path: ${window.location.origin}</div>
            <div>🔧 CustomersManager Class: ${window.CustomersManager ? '✅ Loaded' : '❌ Not Found'}</div>
            <div>🏗️ Instance: ${window.customersManager ? '✅ Created' : '❌ Not Created'}</div>
            <div>⏰ Time: ${new Date().toLocaleString('th-TH')}</div>
          </div>
        </div>
        
        <div class="space-x-3">
          <button 
            onclick="showCustomers()" 
            class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md font-medium"
          >
            🔄 ลองใหม่
          </button>
          <button 
            onclick="location.reload()" 
            class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md font-medium"
          >
            🔄 รีเฟรชหน้า
          </button>
          <button 
            onclick="debugCustomersManager()" 
            class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
          >
            🔍 Debug
          </button>
        </div>
      </div>
    `;
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
}
// เพิ่มฟังก์ชันเหล่านี้ในส่วนต้นของไฟล์ app.js (หลังจาก API_BASE_URL)

/**
 * โหลด JavaScript file แบบ dynamic
 * @param {string} src - path ของไฟล์ที่จะโหลด
 * @returns {Promise} - Promise ที่ resolve เมื่อโหลดเสร็จ
 */
async function loadScript(src) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Attempting to load script: ${src}`);
    
    // ตรวจสอบว่าโหลดแล้วหรือยัง
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      console.log(`✅ Script already loaded: ${src}`);
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.type = 'text/javascript';
    script.async = true;
    
    // Timeout หลัง 10 วินาที
    const timeout = setTimeout(() => {
      console.error(`⏰ Script loading timeout: ${src}`);
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      reject(new Error(`Script loading timeout: ${src}`));
    }, 10000);
    
    script.onload = () => {
      clearTimeout(timeout);
      console.log(`✅ Script loaded successfully: ${src}`);
      resolve();
    };
    
    script.onerror = (error) => {
      clearTimeout(timeout);
      console.error(`❌ Failed to load script: ${src}`, error);
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      reject(new Error(`Failed to load script: ${src}`));
    };
    
    document.head.appendChild(script);
    console.log(`📝 Script tag added to head: ${src}`);
  });
}

/**
 * ตรวจสอบว่าไฟล์ accessible หรือไม่
 * @param {string} url - URL ที่จะตรวจสอบ
 * @returns {Promise<boolean>} - true ถ้าไฟล์ accessible
 */
async function checkFileAccessible(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    console.log(`🔍 File check - ${url}: ${response.status}`);
    return response.status === 200;
  } catch (error) {
    console.error(`❌ File not accessible - ${url}:`, error);
    return false;
  }
}



// ฟังก์ชันคำนวณค่าจัดส่ง
async function calculateShipping(cartItems, destination = 'bangkok') {
  try {
    const response = await fetch('/api/calculate-shipping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: cartItems.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.price
        })),
        destination: destination
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // แสดงรายละเอียดค่าจัดส่ง
      displayShippingDetails(result.data);
      return result.data.totalShippingCost;
    }
    
  } catch (error) {
    console.error('Error calculating shipping:', error);
    return 0;
  }
}

// แสดงรายละเอียดค่าจัดส่ง
function displayShippingDetails(shippingData) {
  const shippingContainer = document.getElementById('shipping-details');
  
  let html = '<div class="shipping-breakdown">';
  html += '<h4>รายละเอียดค่าจัดส่ง:</h4>';
  
  shippingData.details.forEach(detail => {
    html += `
      <div class="shipping-item">
        <span class="product-name">${detail.productName}</span>
        <span class="calculation">${detail.calculation}</span>
        <span class="cost">${detail.cost} บาท</span>
      </div>
    `;
  });
  
  if (shippingData.freeShippingApplied) {
    html += '<div class="free-shipping">🎉 จัดส่งฟรี!</div>';
  }
  
  html += `<div class="total">รวมค่าจัดส่ง: ${shippingData.totalShippingCost} บาท</div>`;
  html += '</div>';
  
  shippingContainer.innerHTML = html;
}
/**
 * เพิ่มฟังก์ชัน debug helper สำหรับ customers manager
 */
function debugCustomersManager() {
  console.log('🔍 === CUSTOMERS MANAGER DEBUG ===');
  console.log('CustomersManager Class:', window.CustomersManager);
  console.log('customersManager Instance:', window.customersManager);
  console.log('Current Location:', window.location.href);
  
  // ทดสอบโหลดไฟล์
  const testPaths = [
    '/admin/js/customers-manager.js',
    '/static/admin/js/customers-manager.js'
  ];
  
  testPaths.forEach(async (path) => {
    try {
      const response = await fetch(path, { method: 'HEAD' });
      console.log(`Path ${path}: ${response.status === 200 ? '✅ OK' : '❌ NOT FOUND'}`);
    } catch (error) {
      console.log(`Path ${path}: ❌ ERROR`, error);
    }
  });
}

// เรียกใช้ debug function เมื่อโหลดหน้า
window.addEventListener('load', () => {
  setTimeout(() => {
    debugCustomersManager();
  }, 1000);
});
// Reports View
// แทนที่ฟังก์ชัน showReports ใน app.js (ประมาณ line 2258)

async function showReports() {
  console.log('📊 Loading Reports & Analytics System...');
  
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  try {
    // แสดงสถานะโหลด
    mainContent.innerHTML = `
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p class="text-gray-600">กำลังโหลดระบบรายงาน...</p>
          <p class="text-sm text-gray-500 mt-2" id="loading-status">กำลังเตรียมข้อมูล...</p>
        </div>
      </div>
    `;

    const statusElement = document.getElementById('loading-status');
    
    // ทดสอบ path ที่เป็นไปได้สำหรับ reports-manager.js
    const possiblePaths = [
      '/admin/js/reports-manager.js',
      '/static/admin/js/reports-manager.js',
      './js/reports-manager.js',
      'js/reports-manager.js'
    ];
    
    let accessiblePath = null;
    
    // หา path ที่ใช้งานได้
    for (const path of possiblePaths) {
      try {
        const response = await fetch(path, { method: 'HEAD' });
        if (response.ok) {
          accessiblePath = path;
          console.log(`✅ Found reports-manager.js at: ${path}`);
          break;
        }
      } catch (e) {
        console.log(`❌ Path not found: ${path}`);
        continue;
      }
    }
    
    // ถ้าไม่พบไฟล์ ให้สร้าง UI แบบง่าย
    if (!accessiblePath) {
      console.warn('⚠️ reports-manager.js not found, creating simple UI');
      await createSimpleReportsUI();
      return;
    }
    
    // โหลด reports-manager.js
    if (!window.ReportsManager) {
      statusElement.textContent = `กำลังโหลด reports-manager.js จาก ${accessiblePath}...`;
      
      await loadScript(accessiblePath);
      
      // รอให้ script execute
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!window.ReportsManager) {
        throw new Error('ไม่สามารถโหลด ReportsManager class ได้');
      }
    }

    statusElement.textContent = 'กำลังเตรียมระบบ...';
    
    // สร้าง instance
    if (!window.reportsManager) {
      console.log('🏗️ Creating ReportsManager instance...');
      window.reportsManager = new window.ReportsManager();
    }

    statusElement.textContent = 'กำลังโหลดข้อมูลรายงาน...';
    
    // เริ่มต้นระบบ
    await window.reportsManager.initialize();
    
    console.log('✅ Reports Manager initialized successfully');

  } catch (error) {
    console.error('❌ Error initializing Reports Manager:', error);
    
    // ถ้าเกิดข้อผิดพลาด ใช้ Simple UI แทน
    await createSimpleReportsUI();
  }
}

// เพิ่มใน app.js

// เพิ่มใน aquaroom-admin/public/admin/js/app.js

async function showAlerts() {
  console.log('🚨 Loading Alerts Management System...');
  
  try {
    // โหลด AlertsManager (ถ้ายังไม่มี)
    if (!window.AlertsManager) {
      await loadScript('/admin/js/alerts-manager.js');
    }
    
    // สร้าง instance
    if (!window.alertsManager) {
      window.alertsManager = new window.AlertsManager();
    }
    
    // เริ่มต้นระบบ
    await window.alertsManager.initialize();
    
  } catch (error) {
    console.error('❌ Error loading Alerts Manager:', error);
    
    document.getElementById('main-content').innerHTML = `
      <div class="text-center py-12">
        <div class="text-red-500 mb-4">
          <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2"></i>
          <h3 class="text-lg font-medium">ไม่สามารถโหลดระบบแจ้งเตือนได้</h3>
          <p class="text-sm mt-2">${error.message}</p>
        </div>
        <button onclick="showAlerts()" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          ลองใหม่
        </button>
      </div>
    `;
    
    lucide.createIcons();
  }
}

// ฟังก์ชันสร้าง Reports UI แบบง่าย (ถ้าไม่สามารถโหลด ReportsManager ได้)
async function createSimpleReportsUI() {
  const mainContent = document.getElementById('main-content');
  
  try {
    // โหลดข้อมูลพื้นฐาน
    const [overview, salesChart] = await Promise.all([
      fetch('/api/admin/analytics/overview').then(r => r.json()).catch(() => null),
      fetch('/api/admin/analytics/sales-chart').then(r => r.json()).catch(() => null)
    ]);

    mainContent.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-gray-900">📊 รายงานและสถิติ</h1>
          <p class="text-sm text-gray-600">ภาพรวมการดำเนินงานของร้านค้า</p>
        </div>

        <!-- Overview Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          ${createOverviewCards(overview?.data)}
        </div>

        <!-- Sales Chart -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h3 class="text-lg font-semibold mb-4">📈 กราฟยอดขาย</h3>
          <div id="simple-sales-chart" class="h-64 flex items-center justify-center text-gray-500">
            ${salesChart ? 'กราฟจะแสดงที่นี่ (ต้องใช้ Chart.js)' : 'ไม่มีข้อมูลการขาย'}
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-white rounded-xl shadow-sm p-6 text-center">
            <div class="text-indigo-600 mb-3">
              <i data-lucide="trending-up" class="w-8 h-8 mx-auto"></i>
            </div>
            <h4 class="font-semibold mb-2">สินค้าขายดี</h4>
            <button onclick="showTopProducts()" class="text-sm text-indigo-600 hover:text-indigo-800">
              ดูรายละเอียด →
            </button>
          </div>

          <div class="bg-white rounded-xl shadow-sm p-6 text-center">
            <div class="text-green-600 mb-3">
              <i data-lucide="users" class="w-8 h-8 mx-auto"></i>
            </div>
            <h4 class="font-semibold mb-2">สถิติลูกค้า</h4>
            <button onclick="showCustomerStats()" class="text-sm text-green-600 hover:text-green-800">
              ดูรายละเอียด →
            </button>
          </div>

          <div class="bg-white rounded-xl shadow-sm p-6 text-center">
            <div class="text-orange-600 mb-3">
              <i data-lucide="package" class="w-8 h-8 mx-auto"></i>
            </div>
            <h4 class="font-semibold mb-2">รายงานสต็อก</h4>
            <button onclick="showInventoryReport()" class="text-sm text-orange-600 hover:text-orange-800">
              ดูรายละเอียด →
            </button>
          </div>
        </div>

        <!-- Status Footer -->
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div class="flex items-center">
            <i data-lucide="info" class="w-5 h-5 text-yellow-600 mr-2"></i>
            <p class="text-sm text-yellow-800">
              <strong>หมายเหตุ:</strong> ระบบกำลังใช้งาน Reports UI แบบง่าย 
              หากต้องการฟีเจอร์เต็มรูปแบบ กรุณาตรวจสอบไฟล์ reports-manager.js
            </p>
          </div>
        </div>
      </div>
    `;

    // เริ่มใช้งาน icons
    lucide.createIcons();
    
  } catch (error) {
    console.error('Error creating simple reports UI:', error);
    
    mainContent.innerHTML = `
      <div class="text-center py-12">
        <div class="text-red-500 mb-4">
          <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2"></i>
          <h3 class="text-lg font-medium">เกิดข้อผิดพลาดในการโหลดระบบรายงาน</h3>
          <p class="text-sm mt-2">${error.message}</p>
        </div>
        
        <button 
          onclick="showReports()" 
          class="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          <i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i>
          ลองใหม่
        </button>
      </div>
    `;
    
    lucide.createIcons();
  }
}

// ฟังก์ชันสร้าง Overview Cards
function createOverviewCards(data) {
  if (!data) {
    return `
      <div class="bg-white rounded-xl shadow-sm p-6 text-center">
        <p class="text-gray-500">ไม่มีข้อมูลสถิติ</p>
      </div>
    `.repeat(4);
  }

  const cards = [
    {
      title: 'คำสั่งซื้อทั้งหมด',
      value: data.totalOrders || 0,
      icon: 'shopping-cart',
      color: 'blue'
    },
    {
      title: 'รายได้รวม',
      value: `฿${(data.totalRevenue || 0).toLocaleString()}`,
      icon: 'dollar-sign',
      color: 'green'
    },
    {
      title: 'ลูกค้าทั้งหมด',
      value: data.totalCustomers || 0,
      icon: 'users',
      color: 'purple'
    },
    {
      title: 'สินค้าทั้งหมด',
      value: data.totalProducts || 0,
      icon: 'package',
      color: 'orange'
    }
  ];

  return cards.map(card => `
    <div class="bg-white rounded-xl shadow-sm p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-600">${card.title}</p>
          <p class="text-2xl font-bold text-gray-900">${card.value}</p>
        </div>
        <div class="text-${card.color}-600">
          <i data-lucide="${card.icon}" class="w-8 h-8"></i>
        </div>
      </div>
    </div>
  `).join('');
}

// ฟังก์ชันแสดงข้อมูลเพิ่มเติม
window.showTopProducts = async function() {
  try {
    const response = await fetch('/api/admin/analytics/top-products');
    const data = await response.json();
    
    if (data.success) {
      Swal.fire({
        title: '🏆 สินค้าขายดี',
        html: `
          <div class="text-left">
            ${data.data.best_sellers.slice(0, 5).map((product, index) => `
              <div class="flex justify-between items-center py-2 ${index > 0 ? 'border-t' : ''}">
                <span>${index + 1}. ${product.name}</span>
                <span class="font-semibold">${product.total_sold} ขาย</span>
              </div>
            `).join('')}
          </div>
        `,
        width: '500px',
        confirmButtonText: 'ปิด'
      });
    }
  } catch (error) {
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลสินค้าขายดีได้', 'error');
  }
};

window.showCustomerStats = async function() {
  try {
    const response = await fetch('/api/admin/analytics/customers-stats');
    const data = await response.json();
    
    if (data.success) {
      Swal.fire({
        title: '👥 สถิติลูกค้า',
        html: `
          <div class="text-left space-y-2">
            <div class="flex justify-between"><span>ลูกค้าใหม่:</span><span class="font-semibold">${data.data.new_customers}</span></div>
            <div class="flex justify-between"><span>ลูกค้าที่กลับมา:</span><span class="font-semibold">${data.data.returning_customers}</span></div>
            <div class="flex justify-between"><span>ลูกค้าที่ซื้อมากที่สุด:</span><span class="font-semibold">${data.data.top_customers[0]?.name || 'ไม่มี'}</span></div>
          </div>
        `,
        confirmButtonText: 'ปิด'
      });
    }
  } catch (error) {
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดสถิติลูกค้าได้', 'error');
  }
};

window.showInventoryReport = async function() {
  try {
    const response = await fetch('/api/admin/analytics/inventory-report');
    const data = await response.json();
    
    if (data.success) {
      Swal.fire({
        title: '📦 รายงานสต็อก',
        html: `
          <div class="text-left space-y-2">
            <div class="flex justify-between"><span>สินค้าหมด:</span><span class="font-semibold text-red-600">${data.data.out_of_stock_count}</span></div>
            <div class="flex justify-between"><span>สินค้าใกล้หมด:</span><span class="font-semibold text-yellow-600">${data.data.low_stock_count}</span></div>
            <div class="flex justify-between"><span>รวมสินค้าทั้งหมด:</span><span class="font-semibold">${data.data.total_products}</span></div>
          </div>
        `,
        confirmButtonText: 'ปิด'
      });
    }
  } catch (error) {
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดรายงานสต็อกได้', 'error');
  }
};

// หน้า admin > ตั้งค่า > ติดต่อเรา
async function showSettingsContact() {
  if (window.contactMessagesManager) {
    await window.contactMessagesManager.renderContactMessagesPage();
  } else {
    // fallback error
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = '<div class="text-red-500 text-center py-8">ContactMessagesManager not found</div>';
    }
  }
}
// Not Found View
function showNotFound() {
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full">
        <h1 class="text-6xl font-bold text-gray-300">404</h1>
        <p class="text-xl text-gray-500 mb-6">ไม่พบหน้าที่ต้องการ</p>
        <a href="/admin" class="px-4 py-2 bg-primary text-white rounded-md">กลับไปหน้าแรก</a>
      </div>
    `;
  }
}

// เพิ่มฟังก์ชันสำหรับการจัดการ shipping type
function toggleShippingType() {
  const shippingType = document.querySelector('input[name="shipping_type"]:checked')?.value;
  const defaultSection = document.getElementById('default-shipping-section');
  const specialSection = document.getElementById('special-shipping-section');
  
  if (shippingType === 'special') {
    if (defaultSection) defaultSection.classList.add('hidden');
    if (specialSection) specialSection.classList.remove('hidden');
    updateShippingExamples();
  } else {
    if (defaultSection) defaultSection.classList.remove('hidden');
    if (specialSection) specialSection.classList.add('hidden');
  }
}

// อัปเดตตัวอย่างการคิดค่าจัดส่ง
function updateShippingExamples() {
  const baseCostElement = document.getElementById('special-base-cost');
  const thresholdElement = document.getElementById('special-quantity-threshold');
  const extraCostElement = document.getElementById('special-extra-cost');
  const examplesElement = document.getElementById('shipping-examples');
  
  if (!baseCostElement || !thresholdElement || !extraCostElement || !examplesElement) {
    return;
  }
  
  const baseCost = parseFloat(baseCostElement.value) || 80;
  const threshold = parseInt(thresholdElement.value) || 4;
  const extraCost = parseFloat(extraCostElement.value) || 10;
  
  examplesElement.innerHTML = `
    <p>• สั่ง 1-${threshold} ตัว = ${baseCost} บาท</p>
    <p>• สั่ง ${threshold + 1} ตัว = ${baseCost} + (1×${extraCost}) = ${baseCost + extraCost} บาท</p>
    <p>• สั่ง ${threshold + 3} ตัว = ${baseCost} + (3×${extraCost}) = ${baseCost + (3 * extraCost)} บาท</p>
    <p>• สั่ง ${threshold + 6} ตัว = ${baseCost} + (6×${extraCost}) = ${baseCost + (6 * extraCost)} บาท</p>
  `;
}

// เพิ่มสินค้า (Create Product View)
async function showCreateProduct() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  try {
    // แสดงสถานะโหลด
    mainContent.innerHTML = `
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p class="text-gray-600">กำลังโหลดฟอร์มเพิ่มสินค้า...</p>
        </div>
      </div>
    `;

    // โหลดข้อมูลหมวดหมู่
    let categories = [];
    try {
      console.log('📂 Loading categories for create product form...');
      const response = await fetch('/api/categories');
      
      if (response.ok) {
        const categoryData = await response.json();
        console.log('📂 Categories response:', categoryData);
        
        // จัดการ response format ที่แตกต่างกัน
        if (Array.isArray(categoryData)) {
          categories = categoryData;
        } else if (categoryData.success && Array.isArray(categoryData.data)) {
          categories = categoryData.data;
        } else if (categoryData.categories && Array.isArray(categoryData.categories)) {
          categories = categoryData.categories;
        } else {
          console.warn('⚠️ Unexpected categories response format:', categoryData);
          categories = [];
        }
        
        console.log('✅ Categories loaded:', categories.length);
      } else {
        throw new Error(`HTTP ${response.status}: Failed to load categories`);
      }
    } catch (error) {
      console.error('❌ Error loading categories:', error);
      categories = [];
    }

    // สร้างฟอร์ม
mainContent.innerHTML = `
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
        <h1 class="text-2xl font-bold text-gray-900">เพิ่มสินค้าใหม่</h1>
        <p class="text-sm text-gray-600">กรอกข้อมูลสินค้าใหม่ที่ต้องการเพิ่มเข้าสู่ระบบ</p>
      </div>
    </div>
  </div>

  <form id="create-product-form" class="bg-white rounded-xl shadow-sm p-6 space-y-6">
    <!-- ชื่อสินค้า -->
    <div>
      <label for="product-name" class="block text-sm font-medium text-gray-700 mb-2">ชื่อสินค้า *</label>
      <input 
        type="text" 
        id="product-name" 
        name="name" 
        required 
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        placeholder="กรอกชื่อสินค้า"
      >
    </div>

    <!-- คำอธิบาย -->
    <div>
      <label for="product-description" class="block text-sm font-medium text-gray-700 mb-2">คำอธิบายสินค้า</label>
      <textarea 
        id="product-description" 
        name="description" 
        rows="4"
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        placeholder="กรอกคำอธิบายสินค้า"
      ></textarea>
    </div>

    <!-- ราคาและจำนวน -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label for="product-price" class="block text-sm font-medium text-gray-700 mb-2">ราคา (บาท) *</label>
        <input 
          type="number" 
          id="product-price" 
          name="price" 
          required 
          min="0" 
          step="0.01"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="0.00"
        >
      </div>
      <div>
        <label for="product-stock" class="block text-sm font-medium text-gray-700 mb-2">จำนวนในคลัง *</label>
        <input 
          type="number" 
          id="product-stock" 
          name="stock" 
          required 
          min="0"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="0"
        >
      </div>
    </div>

    <!-- หมวดหมู่และสินค้ายอดนิยม -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label for="product-category" class="block text-sm font-medium text-gray-700 mb-2">หมวดหมู่</label>
        <select 
          id="product-category" 
          name="categoryId"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">เลือกหมวดหมู่</option>
          ${categories.map(category => `
            <option value="${category.id}">${category.name}</option>
          `).join('')}
        </select>
        ${categories.length === 0 ? `
          <p class="text-sm text-red-500 mt-1">⚠️ ไม่พบหมวดหมู่ในระบบ</p>
        ` : `
          <p class="text-sm text-gray-500 mt-1">พบ ${categories.length} หมวดหมู่</p>
        `}
      </div>
      <div class="flex items-center">
        <div class="flex items-center h-5">
          <input 
            id="product-popular" 
            name="is_popular" 
            type="checkbox" 
            class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
          >
        </div>
        <div class="ml-3 text-sm">
          <label for="product-popular" class="font-medium text-gray-700">สินค้ายอดนิยม</label>
          <p class="text-gray-500">แสดงสินค้านี้ในหน้าสินค้ายอดนิยม</p>
        </div>
      </div>
    </div>
    <!-- 📷 ส่วนอัปโหลดรูปภาพสินค้า -->
<div class="border-t pt-6">
  <h3 class="text-lg font-medium text-gray-900 mb-4 flex items-center">
    <i data-lucide="image" class="w-5 h-5 mr-2 text-indigo-600"></i>
    รูปภาพสินค้า
  </h3>
  
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <!-- รูปภาพที่ 1 -->
    <div>
      <label for="image-1" class="block text-sm font-medium text-gray-700 mb-2">
        รูปภาพหลัก *
      </label>
      <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-indigo-400 transition-colors">
        <div class="space-y-1 text-center">
          <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="flex text-sm text-gray-600">
            <label for="image-1" class="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
              <span>อัปโหลดไฟล์</span>
              <input id="image-1" name="image-1" type="file" accept="image/*" class="sr-only" onchange="previewImage(1, this)">
            </label>
            <p class="pl-1">หรือลาก</p>
          </div>
          <p class="text-xs text-gray-500">PNG, JPG ขนาดไม่เกิน 5MB</p>
        </div>
      </div>
      <div id="preview-1" class="mt-3 hidden">
        <!-- Preview จะแสดงที่นี่ -->
      </div>
    </div>

    <!-- รูปภาพที่ 2 -->
    <div>
      <label for="image-2" class="block text-sm font-medium text-gray-700 mb-2">
        รูปภาพที่ 2
      </label>
      <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-indigo-400 transition-colors">
        <div class="space-y-1 text-center">
          <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="flex text-sm text-gray-600">
            <label for="image-2" class="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
              <span>อัปโหลดไฟล์</span>
              <input id="image-2" name="image-2" type="file" accept="image/*" class="sr-only" onchange="previewImage(2, this)">
            </label>
            <p class="pl-1">หรือลาก</p>
          </div>
          <p class="text-xs text-gray-500">PNG, JPG ขนาดไม่เกิน 5MB</p>
        </div>
      </div>
      <div id="preview-2" class="mt-3 hidden">
        <!-- Preview จะแสดงที่นี่ -->
      </div>
    </div>

    <!-- รูปภาพที่ 3 -->
    <div>
      <label for="image-3" class="block text-sm font-medium text-gray-700 mb-2">
        รูปภาพที่ 3
      </label>
      <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-indigo-400 transition-colors">
        <div class="space-y-1 text-center">
          <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="flex text-sm text-gray-600">
            <label for="image-3" class="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
              <span>อัปโหลดไฟล์</span>
              <input id="image-3" name="image-3" type="file" accept="image/*" class="sr-only" onchange="previewImage(3, this)">
            </label>
            <p class="pl-1">หรือลาก</p>
          </div>
          <p class="text-xs text-gray-500">PNG, JPG ขนาดไม่เกิน 5MB</p>
        </div>
      </div>
      <div id="preview-3" class="mt-3 hidden">
        <!-- Preview จะแสดงที่นี่ -->
      </div>
    </div>

    <!-- รูปภาพที่ 4 -->
    <div>
      <label for="image-4" class="block text-sm font-medium text-gray-700 mb-2">
        รูปภาพที่ 4
      </label>
      <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-indigo-400 transition-colors">
        <div class="space-y-1 text-center">
          <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="flex text-sm text-gray-600">
            <label for="image-4" class="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
              <span>อัปโหลดไฟล์</span>
              <input id="image-4" name="image-4" type="file" accept="image/*" class="sr-only" onchange="previewImage(4, this)">
            </label>
            <p class="pl-1">หรือลาก</p>
          </div>
          <p class="text-xs text-gray-500">PNG, JPG ขนาดไม่เกิน 5MB</p>
        </div>
      </div>
      <div id="preview-4" class="mt-3 hidden">
        <!-- Preview จะแสดงที่นี่ -->
      </div>
    </div>
  </div>
  
  <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <div class="flex">
      <i data-lucide="info" class="w-5 h-5 text-blue-600 mr-2 mt-0.5"></i>
      <div class="text-sm">
        <p class="text-blue-800 font-medium">💡 เคล็ดลับการอัปโหลดรูปภาพ</p>
        <ul class="text-blue-700 mt-1 space-y-1">
          <li>• รูปภาพแรกจะเป็นรูปหลักที่แสดงในรายการสินค้า</li>
          <li>• ควรใช้รูปภาพที่มีขนาด 800x800 พิกเซล เพื่อความคมชัด</li>
          <li>• รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 5MB</li>
          <li>• สามารถอัปโหลดได้สูงสุด 4 รูป</li>
        </ul>
      </div>
    </div>
  </div>
</div>

    <!-- 📦 ส่วนการตั้งค่าค่าจัดส่ง (ใหม่) -->
<div class="border-t pt-6">
  <h3 class="text-lg font-medium text-gray-900 mb-4 flex items-center">
    <i data-lucide="truck" class="w-5 h-5 mr-2 text-indigo-600"></i>
    การตั้งค่าค่าจัดส่ง
  </h3>
  
  <!-- ตัวเลือกประเภทการจัดส่ง -->
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
    <h4 class="font-semibold text-blue-800 mb-3">ประเภทการคิดค่าจัดส่ง</h4>
    <div class="space-y-3">
      <div class="flex items-center">
        <input 
          id="shipping-type-default" 
          name="shipping_type" 
          type="radio" 
          value="default" 
          checked
          onchange="toggleShippingType()"
          class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
        >
        <label for="shipping-type-default" class="ml-3 block text-sm font-medium text-gray-700">
          ค่าจัดส่งปกติ
        </label>
        <span class="ml-2 text-xs text-gray-500">(กรุงเทพฯ/ต่างจังหวัด/เกาะ)</span>
      </div>
      
      <div class="flex items-center">
        <input 
          id="shipping-type-special" 
          name="shipping_type" 
          type="radio" 
          value="special"
          onchange="toggleShippingType()"
          class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
        >
        <label for="shipping-type-special" class="ml-3 block text-sm font-medium text-gray-700">
          ค่าจัดส่งพิเศษ
        </label>
        <span class="ml-2 text-xs text-gray-500">(สำหรับปลากัด หรือสินค้าพิเศษ)</span>
      </div>
    </div>
  </div>

  <!-- การตั้งค่าค่าจัดส่งปกติ -->
  <div id="default-shipping-section" class="space-y-6">
    <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
      <div class="flex">
        <i data-lucide="info" class="w-5 h-5 text-indigo-600 mr-2 mt-0.5"></i>
        <div class="text-sm">
          <p class="text-indigo-800 font-medium">ค่าจัดส่งปกติ</p>
          <p class="text-indigo-700 mt-1">ใช้ค่าเริ่มต้น: กรุงเทพฯ 0 บาท, ต่างจังหวัด 50 บาท, เกาะ/ห่างไกล 100 บาท</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <label for="shipping-bangkok" class="block text-sm font-medium text-gray-700 mb-2">
          กรุงเทพฯ - ปริมณฑล (บาท)
        </label>
        <input 
          type="number" 
          id="shipping-bangkok" 
          name="shipping_cost_bangkok" 
          min="0" 
          step="0.01"
          value="0"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="0.00"
        >
      </div>

      <div>
        <label for="shipping-provinces" class="block text-sm font-medium text-gray-700 mb-2">
          ต่างจังหวัด (บาท)
        </label>
        <input 
          type="number" 
          id="shipping-provinces" 
          name="shipping_cost_provinces" 
          min="0" 
          step="0.01"
          value="50"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="50.00"
        >
      </div>

      <div>
        <label for="shipping-remote" class="block text-sm font-medium text-gray-700 mb-2">
          เกาะ / ห่างไกล (บาท)
        </label>
        <input 
          type="number" 
          id="shipping-remote" 
          name="shipping_cost_remote" 
          min="0" 
          step="0.01"
          value="100"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="100.00"
        >
      </div>
    </div>
  </div>

  <!-- การตั้งค่าค่าจัดส่งพิเศษ -->
  <div id="special-shipping-section" class="space-y-6 hidden">
    <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div class="flex">
        <i data-lucide="fish" class="w-5 h-5 text-orange-600 mr-2 mt-0.5"></i>
        <div class="text-sm">
          <p class="text-orange-800 font-medium">ค่าจัดส่งพิเศษ (สำหรับปลากัด)</p>
          <p class="text-orange-700 mt-1">เหมาะสำหรับสินค้าที่มีการคิดค่าจัดส่งแบบขั้นบันได เช่น ปลากัด</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- ค่าจัดส่งพื้นฐาน -->
      <div>
        <label for="special-base-cost" class="block text-sm font-medium text-gray-700 mb-2">
          ค่าจัดส่งพื้นฐาน (บาท) *
        </label>
        <input 
          type="number" 
          id="special-base-cost" 
          name="special_shipping_base" 
          min="0" 
          step="0.01"
          value="80"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          placeholder="80.00"
        >
        <p class="text-xs text-gray-500 mt-1">ค่าจัดส่งเริ่มต้น เช่น 80 บาท</p>
      </div>

      <!-- จำนวนขีดจำกัด -->
      <div>
        <label for="special-quantity-threshold" class="block text-sm font-medium text-gray-700 mb-2">
          จำนวนขีดจำกัด (ตัว) *
        </label>
        <input 
          type="number" 
          id="special-quantity-threshold" 
          name="special_shipping_qty" 
          min="1" 
          value="4"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          placeholder="4"
        >
        <p class="text-xs text-gray-500 mt-1">เกินจำนวนนี้จะคิดค่าเพิ่ม เช่น 4 ตัว</p>
      </div>

      <!-- ค่าจัดส่งเพิ่ม -->
      <div>
        <label for="special-extra-cost" class="block text-sm font-medium text-gray-700 mb-2">
          ค่าจัดส่งเพิ่มต่อชิ้น (บาท) *
        </label>
        <input 
          type="number" 
          id="special-extra-cost" 
          name="special_shipping_extra" 
          min="0" 
          step="0.01"
          value="10"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          placeholder="10.00"
        >
        <p class="text-xs text-gray-500 mt-1">เพิ่มต่อชิ้นที่เกิน เช่น 10 บาท/ตัว</p>
      </div>

      <!-- หมายเหตุพิเศษ -->
      <div>
        <label for="special-shipping-notes" class="block text-sm font-medium text-gray-700 mb-2">
          หมายเหตุการจัดส่งพิเศษ
        </label>
        <textarea 
          id="special-shipping-notes" 
          name="special_shipping_notes" 
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          placeholder="เช่น ปลากัด 1-4 ตัว = 80฿, เกิน 4 ตัว +10฿/ตัว"
        ></textarea>
      </div>
    </div>

    <!-- ตัวอย่างการคิดค่าจัดส่ง -->
    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h5 class="font-semibold text-gray-800 mb-2">ตัวอย่างการคิดค่าจัดส่ง:</h5>
      <div id="shipping-examples" class="space-y-1 text-sm text-gray-600">
        <p>• สั่ง 1-4 ตัว = 80 บาท</p>
        <p>• สั่ง 5 ตัว = 80 + (1×10) = 90 บาท</p>
        <p>• สั่ง 7 ตัว = 80 + (3×10) = 110 บาท</p>
        <p>• สั่ง 10 ตัว = 80 + (6×10) = 140 บาท</p>
      </div>
    </div>
  </div>

  <!-- ตั้งค่าเพิ่มเติม -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
    <!-- จัดส่งฟรีเมื่อซื้อครบ -->
    <div>
      <label for="free-shipping-threshold" class="block text-sm font-medium text-gray-700 mb-2">
        จัดส่งฟรีเมื่อซื้อครบ (บาท)
      </label>
      <input 
        type="number" 
        id="free-shipping-threshold" 
        name="free_shipping_threshold" 
        min="0" 
        step="0.01"
        placeholder="เช่น 1000"
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
      <p class="text-xs text-gray-500 mt-1">เว้นว่างหากไม่มีเงื่อนไขจัดส่งฟรี</p>
    </div>

    <!-- ระยะเวลาจัดส่ง -->
    <div>
      <label for="delivery-time" class="block text-sm font-medium text-gray-700 mb-2">
        ระยะเวลาจัดส่ง
      </label>
      <input 
        type="text" 
        id="delivery-time" 
        name="delivery_time" 
        value="2-3 วัน"
        maxlength="50"
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        placeholder="เช่น 2-3 วัน"
      >
      <p class="text-xs text-gray-500 mt-1">ระยะเวลาที่คาดว่าจะจัดส่งถึงลูกค้า</p>
    </div>
  </div>
</div>
    <!-- ปุ่มบันทึก -->
    <div class="flex justify-end space-x-3 pt-6 border-t">
      <button 
        type="button" 
        onclick="window.history.back()" 
        class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
      >
        ยกเลิก
      </button>
      <button type="submit" id="submit-btn" class="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center">
        <span id="submit-text">บันทึกสินค้า</span>
        <svg id="submit-loading" class="hidden animate-spin ml-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </button>
    </div>
  </form>
`;
// ฟังก์ชันแสดงตัวอย่างรูปภาพ
window.previewImage = function(index, input) {
  const file = input.files[0];
  const previewElement = document.getElementById(`preview-${index}`);
  
  if (!file || !previewElement) return;

  try {
    // ตรวจสอบไฟล์
    validateImageFile(file);
    
    // แสดงตัวอย่าง
    const reader = new FileReader();
    reader.onload = function(e) {
      previewElement.innerHTML = `
        <div class="relative">
          <img src="${e.target.result}" alt="Preview ${index}" class="w-full h-32 object-cover rounded border">
          <button 
            type="button" 
            onclick="removeImage(${index})" 
            class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
          >
            ×
          </button>
        </div>
      `;
      previewElement.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    
  } catch (error) {
    console.error('Invalid image file:', error);
    
    // เคลียร์ input
    input.value = '';
    
    // แสดงข้อผิดพลาด
    Swal.fire({
      title: 'ไฟล์ไม่ถูกต้อง',
      text: error.message,
      icon: 'error',
      confirmButtonText: 'ตกลง'
    });
  }
};

// ฟังก์ชันลบรูปภาพ
window.removeImage = function(index) {
  document.getElementById(`image-${index}`).value = '';
  document.getElementById(`preview-${index}`).classList.add('hidden');
  document.getElementById(`preview-${index}`).innerHTML = '';
};

// Handle form submission
document.getElementById('create-product-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById('submit-btn');
  const submitText = document.getElementById('submit-text');
  const submitLoading = document.getElementById('submit-loading');
  
  try {
    // Show loading state
    submitBtn.disabled = true;
    submitText.textContent = 'กำลังบันทึก...';
    submitLoading.classList.remove('hidden');
    
    const formData = new FormData(this);
    
    // ✅ เพิ่มการอัปโหลดรูปภาพ
    const imageUrls = [];
    submitText.textContent = 'กำลังอัปโหลดรูปภาพ...';
    
    for (let i = 1; i <= 4; i++) {
      const imageFile = document.getElementById(`image-${i}`).files[0];
      if (imageFile) {
        try {
          const imageUrl = await uploadImageToSupabase(imageFile);
          imageUrls.push(imageUrl);
          console.log(`✅ Image ${i} uploaded:`, imageUrl);
        } catch (uploadError) {
          console.error(`❌ Failed to upload image ${i}:`, uploadError);
          throw new Error(`ไม่สามารถอัปโหลดรูปภาพที่ ${i} ได้: ${uploadError.message}`);
        }
      }
    }
    
    console.log('📸 All images uploaded:', imageUrls);
    
    // ดึงข้อมูลการตั้งค่าการจัดส่ง
    const shippingType = document.querySelector('input[name="shipping_type"]:checked')?.value || 'default';
    
    // เตรียมข้อมูลสินค้าให้ครบถ้วน
    const productData = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: parseFloat(formData.get('price')),
      stock: parseInt(formData.get('stock')),
      categoryId: formData.get('categoryId') ? parseInt(formData.get('categoryId')) : null,
      popular: document.getElementById('product-popular').checked,
      images: imageUrls, // ✅ เพิ่มรูปภาพ
      
      // ข้อมูลการจัดส่งอื่นๆ... (เหมือนเดิม)
      delivery_time: formData.get('delivery_time') || '2-3 วัน',
      shipping_notes: formData.get('shipping_notes') || null,
      special_handling: document.getElementById('special-handling')?.checked || false,
      free_shipping_threshold: formData.get('free_shipping_threshold') ? parseFloat(formData.get('free_shipping_threshold')) : null,
      
      // ข้อมูลการจัดส่งพิเศษ
      has_special_shipping: shippingType === 'special',
      
      // ถ้าเป็นการจัดส่งปกติ
      ...(shippingType === 'default' && {
        shipping_cost_bangkok: parseFloat(formData.get('shipping_cost_bangkok') || 0),
        shipping_cost_provinces: parseFloat(formData.get('shipping_cost_provinces') || 50),
        shipping_cost_remote: parseFloat(formData.get('shipping_cost_remote') || 100)
      }),
      
      // ถ้าเป็นการจัดส่งพิเศษ
      ...(shippingType === 'special' && {
        special_shipping_base: parseFloat(formData.get('special_shipping_base') || 80),
        special_shipping_qty: parseInt(formData.get('special_shipping_qty') || 4),
        special_shipping_extra: parseFloat(formData.get('special_shipping_extra') || 10),
        special_shipping_notes: formData.get('special_shipping_notes') || null
      })
    };
    
    console.log('📦 Final product data:', productData);
    
    submitText.textContent = 'กำลังบันทึกข้อมูล...';
    
    // ส่งข้อมูลไปยัง API
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      Swal.fire({
        title: 'สำเร็จ!',
        text: 'เพิ่มสินค้าเรียบร้อยแล้ว',
        icon: 'success',
        confirmButtonText: 'ตกลง'
      }).then(() => {
        window.location.href = '/admin/products';
      });
    } else {
      throw new Error(result.error || 'ไม่สามารถเพิ่มสินค้าได้');
    }
    
  } catch (error) {
    console.error('❌ Error creating product:', error);
    Swal.fire({
      title: 'เกิดข้อผิดพลาด!',
      text: error.message || 'ไม่สามารถเพิ่มสินค้าได้',
      icon: 'error',
      confirmButtonText: 'ตกลง'
    });
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitText.textContent = 'บันทึกสินค้า';
    submitLoading.classList.add('hidden');
  }
});

    // Re-initialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

  } catch (error) {
    console.error('Error in showCreateProduct:', error);
    
    mainContent.innerHTML = `
      <div class="text-center py-12">
        <div class="text-red-500 mb-4">
          <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2"></i>
          <h3 class="text-lg font-medium">เกิดข้อผิดพลาดในการโหลดฟอร์ม</h3>
          <p class="text-sm mt-2">${error.message}</p>
        </div>
        <div class="space-x-3">
          <button onclick="window.history.back()" class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">
            กลับ
          </button>
          <button onclick="showCreateProduct()" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            ลองใหม่
          </button>
        </div>
      </div>
    `;
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Set up logout functionality


  
  // Handle routing
  handleRouting();
  
  // Handle browser navigation
  window.addEventListener('popstate', handleRouting);
});

// แทนที่ฟังก์ชัน showEditProduct ที่มีอยู่
async function showEditProduct(productId) {
  console.log('🔧 Loading edit product form for ID:', productId);
  
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  try {
    // แสดงสถานะโหลด
    mainContent.innerHTML = `
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p class="text-gray-600">กำลังโหลดข้อมูลสินค้า...</p>
        </div>
      </div>
    `;

    // โหลดข้อมูลสินค้าที่จะแก้ไข
    console.log('📡 Calling API:', `/api/products/${productId}/edit`);
    
    const productResponse = await fetch(`/api/products/${productId}/edit`);
    
    console.log('📡 API Response status:', productResponse.status);
    
    if (!productResponse.ok) {
      const errorText = await productResponse.text();
      console.error('❌ API Error:', errorText);
      throw new Error(`ไม่พบสินค้า ID: ${productId} - ${errorText}`);
    }
    
    const productResult = await productResponse.json();
    console.log('📦 API Response:', productResult);
    
    if (!productResult.success) {
      throw new Error(productResult.error || 'ไม่สามารถโหลดข้อมูลสินค้าได้');
    }
    
    const product = productResult.product;
    console.log('✅ Product loaded for edit:', product);
    
    // ตรวจสอบข้อมูลการจัดส่ง
    console.log('🚚 Shipping data check:', {
      has_special_shipping: product.has_special_shipping,
      shipping_cost_bangkok: product.shipping_cost_bangkok,
      shipping_cost_provinces: product.shipping_cost_provinces,
      shipping_cost_remote: product.shipping_cost_remote,
      special_shipping_base: product.special_shipping_base,
      special_shipping_qty: product.special_shipping_qty,
      special_shipping_extra: product.special_shipping_extra,
      delivery_time: product.delivery_time,
      special_handling: product.special_handling,
      free_shipping_threshold: product.free_shipping_threshold
    });

    // โหลดข้อมูลหมวดหมู่
    let categories = [];
    try {
      const categoryResponse = await fetch('/api/categories');
      if (categoryResponse.ok) {
        categories = await categoryResponse.json();
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }

    // สร้างฟอร์มแก้ไข พร้อมส่วนการตั้งค่าการจัดส่ง
    mainContent.innerHTML = `
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
            <h1 class="text-2xl font-bold text-gray-900">แก้ไขสินค้า</h1>
            <p class="text-sm text-gray-600">แก้ไขข้อมูลสินค้า: ${product.name}</p>
          </div>
        </div>
      </div>

      <form id="edit-product-form" class="bg-white rounded-xl shadow-sm p-6 space-y-6">
        <input type="hidden" id="product-id" value="${product.id}">
        
        <!-- ชื่อสินค้า -->
        <div>
          <label for="product-name" class="block text-sm font-medium text-gray-700 mb-2">ชื่อสินค้า *</label>
          <input 
            type="text" 
            id="product-name" 
            name="name" 
            required 
            value="${product.name || ''}"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="กรอกชื่อสินค้า"
          >
        </div>

        <!-- คำอธิบาย -->
        <div>
          <label for="product-description" class="block text-sm font-medium text-gray-700 mb-2">คำอธิบายสินค้า</label>
          <textarea 
            id="product-description" 
            name="description" 
            rows="4"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="กรอกคำอธิบายสินค้า"
          >${product.description || ''}</textarea>
        </div>

        <!-- ราคาและจำนวน -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="product-price" class="block text-sm font-medium text-gray-700 mb-2">ราคา (บาท) *</label>
            <input 
              type="number" 
              id="product-price" 
              name="price" 
              required 
              min="0" 
              step="0.01"
              value="${product.price || 0}"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="0.00"
            >
          </div>
          <div>
            <label for="product-stock" class="block text-sm font-medium text-gray-700 mb-2">จำนวนในคลัง *</label>
            <input 
              type="number" 
              id="product-stock" 
              name="stock" 
              required 
              min="0"
              value="${product.stock || 0}"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="0"
            >
          </div>
        </div>

        <!-- หมวดหมู่และสินค้ายอดนิยม -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="product-category" class="block text-sm font-medium text-gray-700 mb-2">หมวดหมู่</label>
            <select 
              id="product-category" 
              name="categoryId"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">เลือกหมวดหมู่</option>
              ${categories.map(category => `
                <option value="${category.id}" ${product.category && product.category.id === category.id ? 'selected' : ''}>
                  ${category.name}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="flex items-center">
            <div class="flex items-center h-5">
              <input 
                id="product-popular" 
                name="is_popular" 
                type="checkbox" 
                ${product.is_popular ? 'checked' : ''}
                class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
              >
            </div>
            <div class="ml-3 text-sm">
              <label for="product-popular" class="font-medium text-gray-700">สินค้ายอดนิยม</label>
              <p class="text-gray-500">แสดงสินค้านี้ในหน้าสินค้ายอดนิยม</p>
            </div>
          </div>
        </div>

        <!-- 📦 ส่วนการตั้งค่าค่าจัดส่ง -->
        <div class="border-t pt-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <i data-lucide="truck" class="w-5 h-5 mr-2 text-indigo-600"></i>
            การตั้งค่าค่าจัดส่ง
          </h3>
          
          <!-- ตัวเลือกประเภทการจัดส่ง -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 class="font-semibold text-blue-800 mb-3">ประเภทการคิดค่าจัดส่ง</h4>
            <div class="space-y-3">
              <div class="flex items-center">
                <input 
                  id="shipping-type-default-edit" 
                  name="shipping_type" 
                  type="radio" 
                  value="default" 
                  ${!product.has_special_shipping ? 'checked' : ''}
                  onchange="toggleShippingTypeEdit()"
                  class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                >
                <label for="shipping-type-default-edit" class="ml-3 block text-sm font-medium text-gray-700">
                  ค่าจัดส่งปกติ
                </label>
                <span class="ml-2 text-xs text-gray-500">(กรุงเทพฯ/ต่างจังหวัด/เกาะ)</span>
              </div>
              
              <div class="flex items-center">
                <input 
                  id="shipping-type-special-edit" 
                  name="shipping_type" 
                  type="radio" 
                  value="special"
                  ${product.has_special_shipping ? 'checked' : ''}
                  onchange="toggleShippingTypeEdit()"
                  class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                >
                <label for="shipping-type-special-edit" class="ml-3 block text-sm font-medium text-gray-700">
                  ค่าจัดส่งพิเศษ
                </label>
                <span class="ml-2 text-xs text-gray-500">(สำหรับปลากัด หรือสินค้าพิเศษ)</span>
              </div>
            </div>
          </div>

          <!-- การตั้งค่าค่าจัดส่งปกติ -->
          <div id="default-shipping-section-edit" class="space-y-6 ${product.has_special_shipping ? 'hidden' : ''}">
            <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div class="flex">
                <i data-lucide="info" class="w-5 h-5 text-indigo-600 mr-2 mt-0.5"></i>
                <div class="text-sm">
                  <p class="text-indigo-800 font-medium">ค่าจัดส่งปกติ</p>
                  <p class="text-indigo-700 mt-1">กำหนดค่าจัดส่งแยกตามพื้นที่</p>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label for="shipping-bangkok-edit" class="block text-sm font-medium text-gray-700 mb-2">
                  กรุงเทพฯ - ปริมณฑล (บาท)
                </label>
                <input 
                  type="number" 
                  id="shipping-bangkok-edit" 
                  name="shipping_cost_bangkok" 
                  min="0" 
                  step="0.01"
                  value="${product.shipping_cost_bangkok !== null ? product.shipping_cost_bangkok : 0}"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                >
              </div>

              <div>
                <label for="shipping-provinces-edit" class="block text-sm font-medium text-gray-700 mb-2">
                  ต่างจังหวัด (บาท)
                </label>
                <input 
                  type="number" 
                  id="shipping-provinces-edit" 
                  name="shipping_cost_provinces" 
                  min="0" 
                  step="0.01"
                  value="${product.shipping_cost_provinces !== null ? product.shipping_cost_provinces : 50}"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="50.00"
                >
              </div>

              <div>
                <label for="shipping-remote-edit" class="block text-sm font-medium text-gray-700 mb-2">
                  เกาะ / ห่างไกล (บาท)
                </label>
                <input 
                  type="number" 
                  id="shipping-remote-edit" 
                  name="shipping_cost_remote" 
                  min="0" 
                  step="0.01"
                  value="${product.shipping_cost_remote !== null ? product.shipping_cost_remote : 100}"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="100.00"
                >
              </div>
            </div>
          </div>

          <!-- การตั้งค่าค่าจัดส่งพิเศษ -->
          <div id="special-shipping-section-edit" class="space-y-6 ${!product.has_special_shipping ? 'hidden' : ''}">
            <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div class="flex">
                <i data-lucide="fish" class="w-5 h-5 text-orange-600 mr-2 mt-0.5"></i>
                <div class="text-sm">
                  <p class="text-orange-800 font-medium">ค่าจัดส่งพิเศษ (สำหรับปลากัด)</p>
                  <p class="text-orange-700 mt-1">เหมาะสำหรับสินค้าที่มีการคิดค่าจัดส่งแบบขั้นบันได</p>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- ค่าจัดส่งพื้นฐาน -->
              <div>
                <label for="special-base-cost-edit" class="block text-sm font-medium text-gray-700 mb-2">
                  ค่าจัดส่งพื้นฐาน (บาท) *
                </label>
                <input 
                  type="number" 
                  id="special-base-cost-edit" 
                  name="special_shipping_base" 
                  min="0" 
                  step="0.01"
                  value="${product.special_shipping_base !== null ? product.special_shipping_base : 80}"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="80.00"
                >
                <p class="text-xs text-gray-500 mt-1">ค่าจัดส่งเริ่มต้น</p>
              </div>

              <!-- จำนวนขีดจำกัด -->
              <div>
                <label for="special-quantity-threshold-edit" class="block text-sm font-medium text-gray-700 mb-2">
                  จำนวนขีดจำกัด (ตัว) *
                </label>
                <input 
                  type="number" 
                  id="special-quantity-threshold-edit" 
                  name="special_shipping_qty" 
                  min="1" 
                  value="${product.special_shipping_qty !== null ? product.special_shipping_qty : 4}"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="4"
                >
                <p class="text-xs text-gray-500 mt-1">เกินจำนวนนี้จะคิดค่าเพิ่ม</p>
              </div>

              <!-- ค่าจัดส่งเพิ่ม -->
              <div>
                <label for="special-extra-cost-edit" class="block text-sm font-medium text-gray-700 mb-2">
                  ค่าจัดส่งเพิ่มต่อชิ้น (บาท) *
                </label>
                <input 
                  type="number" 
                  id="special-extra-cost-edit" 
                  name="special_shipping_extra" 
                  min="0" 
                  step="0.01"
                  value="${product.special_shipping_extra !== null ? product.special_shipping_extra : 10}"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="10.00"
                >
                <p class="text-xs text-gray-500 mt-1">เพิ่มต่อชิ้นที่เกิน</p>
              </div>

              <!-- หมายเหตุพิเศษ -->
              <div>
                <label for="special-shipping-notes-edit" class="block text-sm font-medium text-gray-700 mb-2">
                  หมายเหตุการจัดส่งพิเศษ
                </label>
                <textarea 
                  id="special-shipping-notes-edit" 
                  name="special_shipping_notes" 
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="เช่น ปลากัด 1-4 ตัว = 80฿, เกิน 4 ตัว +10฿/ตัว"
                >${product.special_shipping_notes || ''}</textarea>
              </div>
            </div>

            <!-- ตัวอย่างการคิดค่าจัดส่ง -->
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h5 class="font-semibold text-gray-800 mb-2">ตัวอย่างการคิดค่าจัดส่ง:</h5>
              <div id="shipping-examples-edit" class="space-y-1 text-sm text-gray-600">
                <!-- จะถูกอัปเดตด้วย JavaScript -->
              </div>
            </div>
          </div>

          <!-- ตั้งค่าเพิ่มเติม -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <!-- จัดส่งฟรีเมื่อซื้อครบ -->
            <div>
              <label for="free-shipping-threshold-edit" class="block text-sm font-medium text-gray-700 mb-2">
                จัดส่งฟรีเมื่อซื้อครบ (บาท)
              </label>
              <input 
                type="number" 
                id="free-shipping-threshold-edit" 
                name="free_shipping_threshold" 
                min="0" 
                step="0.01"
                value="${product.free_shipping_threshold !== null ? product.free_shipping_threshold : ''}"
                placeholder="เช่น 1000"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
              <p class="text-xs text-gray-500 mt-1">เว้นว่างหากไม่มีเงื่อนไขจัดส่งฟรี</p>
            </div>

            <!-- ระยะเวลาจัดส่ง -->
            <div>
              <label for="delivery-time-edit" class="block text-sm font-medium text-gray-700 mb-2">
                ระยะเวลาจัดส่ง
              </label>
              <input 
                type="text" 
                id="delivery-time-edit" 
                name="delivery_time" 
                value="${product.delivery_time || '2-3 วัน'}"
                maxlength="50"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="เช่น 2-3 วัน"
              >
              <p class="text-xs text-gray-500 mt-1">ระยะเวลาที่คาดว่าจะจัดส่งถึงลูกค้า</p>
            </div>
          </div>

          <!-- หมายเหตุและสินค้าพิเศษ -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div class="flex items-start">
              <div class="flex items-center h-5 mt-1">
                <input 
                  id="special-handling-edit" 
                  name="special_handling" 
                  type="checkbox" 
                  ${product.special_handling ? 'checked' : ''}
                  class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                >
              </div>
              <div class="ml-3">
                <label for="special-handling-edit" class="font-medium text-gray-700">สินค้าต้องการการจัดการพิเศษ</label>
                <p class="text-gray-500 text-sm">เช่น ของแก้ว, ของเหลว, สินค้าเปราะบาง</p>
              </div>
            </div>

            <div>
              <label for="shipping-notes-edit" class="block text-sm font-medium text-gray-700 mb-2">
                หมายเหตุการจัดส่ง
              </label>
              <textarea 
                id="shipping-notes-edit" 
                name="shipping_notes" 
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="เช่น ต้องระวังเป็นพิเศษ, เก็บในที่เย็น"
              >${product.shipping_notes || ''}</textarea>
            </div>
          </div>
        </div>

        <!-- รูปภาพสินค้า -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">รูปภาพสินค้า</label>
          <p class="text-sm text-gray-500 mb-3">อัปโหลดรูปภาพสินค้าได้สูงสุด 4 รูป (เว้นว่างไว้หากไม่ต้องการเปลี่ยน)</p>
          
          <!-- แสดงรูปภาพปัจจุบัน -->
          <div class="mb-4">
            <h4 class="text-sm font-medium text-gray-700 mb-2">รูปภาพปัจจุบัน:</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              ${[
                { url: product.image_url, label: 'รูปที่ 1' },
                { url: product.image_url_two, label: 'รูปที่ 2' },
                { url: product.image_url_three, label: 'รูปที่ 3' },
                { url: product.image_url_four, label: 'รูปที่ 4' }
              ].map((image, index) => `
                <div class="border rounded-lg p-2">
                  ${image.url ? `
                    <img src="${image.url}" alt="${image.label}" class="w-full h-20 object-cover rounded mb-1">
                    <p class="text-xs text-center text-gray-500">${image.label}</p>
                  ` : `
                    <div class="w-full h-20 bg-gray-100 rounded flex items-center justify-center mb-1">
                      <i data-lucide="image" class="w-6 h-6 text-gray-400"></i>
                    </div>
                    <p class="text-xs text-center text-gray-500">ไม่มี${image.label}</p>
                  `}
                </div>
              `).join('')}
            </div>
          </div>
          
          <!-- อัปโหลดรูปภาพใหม่ -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            ${[1, 2, 3, 4].map(i => `
              <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-indigo-400 transition-colors">
                <input type="file" id="image-${i}" accept="image/*" class="hidden" onchange="previewImage(${i}, this)">
                <label for="image-${i}" class="cursor-pointer">
                  <div id="preview-${i}" class="preview-container">
                    <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <p class="text-sm text-gray-500 mt-2">รูปใหม่ที่ ${i}</p>
                  </div>
                </label>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- ปุ่มบันทึก -->
        <div class="flex justify-end space-x-3 pt-6 border-t">
          <button 
            type="button" 
            onclick="window.history.back()" 
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            ยกเลิก
          </button>
          <button type="submit" id="submit-btn" class="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center">
            <span id="submit-text">บันทึกการแก้ไข</span>
            <svg id="submit-loading" class="hidden animate-spin ml-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </button>
        </div>
      </form>
    `;

    // เพิ่มฟังก์ชัน JavaScript สำหรับ Edit Product
    window.toggleShippingTypeEdit = function() {
      const shippingType = document.querySelector('input[name="shipping_type"]:checked')?.value;
      const defaultSection = document.getElementById('default-shipping-section-edit');
      const specialSection = document.getElementById('special-shipping-section-edit');
      
      console.log('🔄 Toggling shipping type to:', shippingType);
      
      if (shippingType === 'special') {
        if (defaultSection) defaultSection.classList.add('hidden');
        if (specialSection) specialSection.classList.remove('hidden');
        updateShippingExamplesEdit();
      } else {
        if (defaultSection) defaultSection.classList.remove('hidden');
        if (specialSection) specialSection.classList.add('hidden');
      }
    };

    // อัปเดตตัวอย่างการคิดค่าจัดส่งสำหรับ Edit
    window.updateShippingExamplesEdit = function() {
      const baseCostElement = document.getElementById('special-base-cost-edit');
      const thresholdElement = document.getElementById('special-quantity-threshold-edit');
      const extraCostElement = document.getElementById('special-extra-cost-edit');
      const examplesElement = document.getElementById('shipping-examples-edit');
      
      if (!baseCostElement || !thresholdElement || !extraCostElement || !examplesElement) {
        return;
      }
      
      const baseCost = parseFloat(baseCostElement.value) || 80;
      const threshold = parseInt(thresholdElement.value) || 4;
      const extraCost = parseFloat(extraCostElement.value) || 10;
      
      examplesElement.innerHTML = `
        <p>• สั่ง 1-${threshold} ตัว = ${baseCost} บาท</p>
        <p>• สั่ง ${threshold + 1} ตัว = ${baseCost} + (1×${extraCost}) = ${baseCost + extraCost} บาท</p>
        <p>• สั่ง ${threshold + 3} ตัว = ${baseCost} + (3×${extraCost}) = ${baseCost + (3 * extraCost)} บาท</p>
        <p>• สั่ง ${threshold + 6} ตัว = ${baseCost} + (6×${extraCost}) = ${baseCost + (6 * extraCost)} บาท</p>
      `;
    };

    // Event listeners สำหรับอัปเดตตัวอย่าง
    setTimeout(() => {
      const inputs = ['special-base-cost-edit', 'special-quantity-threshold-edit', 'special-extra-cost-edit'];
      inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
          element.addEventListener('input', updateShippingExamplesEdit);
        }
      });
      
      // อัปเดตตัวอย่างครั้งแรก
      if (product.has_special_shipping) {
        updateShippingExamplesEdit();
      }
    }, 100);

    // ฟังก์ชันแสดงตัวอย่างรูปภาพ
    window.previewImage = function(index, input) {
      if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const previewContainer = document.getElementById(`preview-${index}`);
          previewContainer.innerHTML = `
            <img src="${e.target.result}" alt="Preview ${index}" class="w-full h-20 object-cover rounded">
            <p class="text-sm text-gray-500 mt-1">รูปใหม่ที่ ${index}</p>
          `;
        };
        reader.readAsDataURL(input.files[0]);
      }
    };

 // Handle form submission
document.getElementById('edit-product-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById('submit-btn');
  const submitText = document.getElementById('submit-text');
  const submitLoading = document.getElementById('submit-loading');
  
  // แสดงสถานะกำลังโหลด
  submitBtn.disabled = true;
  submitText.textContent = 'กำลังบันทึก...';
  submitLoading.classList.remove('hidden');
  
  try {
    const productId = document.getElementById('product-id').value;
    
    // ✅ แก้ไข: ดึงข้อมูลจากฟอร์มแบบชัดเจน
    const name = document.getElementById('product-name').value.trim();
    const description = document.getElementById('product-description').value.trim();
    const price = document.getElementById('product-price').value;
    const stock = document.getElementById('product-stock').value;
    const categoryId = document.getElementById('product-category').value;
    const popular = document.getElementById('product-popular').checked;
    
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!name) {
      throw new Error('กรุณาใส่ชื่อสินค้า');
    }
    if (!price || parseFloat(price) < 0) {
      throw new Error('กรุณาใส่ราคาสินค้าที่ถูกต้อง');
    }
    if (!stock || parseInt(stock) < 0) {
      throw new Error('กรุณาใส่จำนวนสินค้าที่ถูกต้อง');
    }
    
    console.log('📝 Form data validation passed:', {
      name, description, price, stock, categoryId, popular
    });
    
    // รวบรวมไฟล์รูปภาพใหม่
    const imageFiles = [];
    for (let i = 1; i <= 4; i++) {
      const fileInput = document.getElementById(`image-${i}`);
      if (fileInput && fileInput.files && fileInput.files[0]) {
        imageFiles.push(fileInput.files[0]);
      }
    }
    
    let imageUrls = [];
    
    // อัปโหลดรูปภาพใหม่ไปยัง Supabase (ถ้ามี)
    if (imageFiles.length > 0) {
      console.log('📤 Uploading new images...');
      submitText.textContent = 'กำลังอัปโหลดรูปภาพ...';
      
      const uploadFormData = new FormData();
      imageFiles.forEach(file => {
        uploadFormData.append('images', file);
      });
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData
      });
      
      if (uploadResponse.ok) {
        const uploadResult = await uploadResponse.json();
        imageUrls = uploadResult.urls || [];
        console.log('✅ Images uploaded:', imageUrls);
      } else {
        console.warn('⚠️ Image upload failed, continuing without new images');
      }
    }
    
    // ดึงข้อมูลการตั้งค่าการจัดส่ง
    const shippingType = document.querySelector('input[name="shipping_type"]:checked')?.value || 'default';
    
    // ✅ แก้ไข: เตรียมข้อมูลสินค้าให้ครบถ้วน
    const productData = {
      // ข้อมูลพื้นฐาน (จำเป็น)
      name: name,
      description: description || '', // ถ้าไม่มีให้เป็น string ว่าง
      price: parseFloat(price),
      stock: parseInt(stock),
      categoryId: categoryId ? parseInt(categoryId) : null,
      popular: popular, // ✅ แก้ไข: เปลี่ยนจาก popular
      
      // รูปภาพ (ถ้ามีการอัปโหลดใหม่)
      ...(imageUrls.length > 0 && { images: imageUrls }),
      
      // ข้อมูลการจัดส่งพื้นฐาน
      delivery_time: document.getElementById('delivery-time-edit')?.value || '2-3 วัน',
      shipping_notes: document.getElementById('shipping-notes-edit')?.value || null,
      special_handling: document.getElementById('special-handling-edit')?.checked || false,
      free_shipping_threshold: (() => {
        const value = document.getElementById('free-shipping-threshold-edit')?.value;
        return value ? parseFloat(value) : null;
      })(),
      
      // 🐠 ข้อมูลการจัดส่งพิเศษ
      has_special_shipping: shippingType === 'special',
      
      // ถ้าเป็นการจัดส่งปกติ
      ...(shippingType === 'default' && {
        shipping_cost_bangkok: parseFloat(document.getElementById('shipping-bangkok-edit')?.value || 0),
        shipping_cost_provinces: parseFloat(document.getElementById('shipping-provinces-edit')?.value || 50),
        shipping_cost_remote: parseFloat(document.getElementById('shipping-remote-edit')?.value || 100)
      }),
      
      // ถ้าเป็นการจัดส่งพิเศษ
      ...(shippingType === 'special' && {
        special_shipping_base: parseFloat(document.getElementById('special-base-cost-edit')?.value || 80),
        special_shipping_qty: parseInt(document.getElementById('special-quantity-threshold-edit')?.value || 4),
        special_shipping_extra: parseFloat(document.getElementById('special-extra-cost-edit')?.value || 10),
        special_shipping_notes: document.getElementById('special-shipping-notes-edit')?.value || null
      })
    };
    
    console.log('📦 Final product data to send:', productData);
    
    // ตรวจสอบข้อมูลก่อนส่ง
    if (!productData.name || !productData.price || productData.stock === undefined) {
      throw new Error('ข้อมูลไม่ครบถ้วน: ชื่อสินค้า, ราคา, และจำนวนสินค้าจำเป็นต้องมี');
    }
    
    submitText.textContent = 'กำลังบันทึกข้อมูล...';
    
    // อัปเดตสินค้า
    const response = await fetch(`/api/products/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });
    
    console.log('📡 API Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error response:', errorText);
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ API Success response:', result);
    
    if (result.success || result.id) {
      Swal.fire({
        title: 'สำเร็จ!',
        text: 'แก้ไขสินค้าเรียบร้อยแล้ว',
        icon: 'success',
        confirmButtonText: 'ตกลง'
      }).then(() => {
        window.history.back(); // กลับไปหน้าเดิม
      });
    } else {
      throw new Error(result.error || result.message || 'ไม่สามารถแก้ไขสินค้าได้');
    }
    
  } catch (error) {
    console.error('❌ Error updating product:', error);
    Swal.fire({
      title: 'เกิดข้อผิดพลาด!',
      text: error.message || 'ไม่สามารถแก้ไขสินค้าได้',
      icon: 'error',
      confirmButtonText: 'ตกลง'
    });
  } finally {
    // คืนสถานะปุ่ม
    submitBtn.disabled = false;
    submitText.textContent = 'บันทึกการแก้ไข';
    submitLoading.classList.add('hidden');
  }
});

    // Re-initialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

  } catch (error) {
    console.error('Error loading edit product form:', error);
    
    mainContent.innerHTML = `
      <div class="text-center py-12">
        <div class="text-red-500 mb-4">
          <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2"></i>
          <h3 class="text-lg font-medium">เกิดข้อผิดพลาดในการโหลดข้อมูลสินค้า</h3>
          <p class="text-sm mt-2">${error.message}</p>
        </div>
        <div class="space-x-3">
          <button onclick="window.history.back()" class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">
            กลับ
          </button>
          <button onclick="showEditProduct(${productId})" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            ลองใหม่
          </button>
        </div>
      </div>
    `;
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
}



async function loadProducts() {
  try {
    console.log('📦 Loading products...');
    
    showLoadingState('กำลังโหลดสินค้า...');
    
    const response = await fetch('/api/products');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('📦 Products API response:', data);
    
    // ✅ แก้ไข: จัดการ response format ที่ถูกต้อง
    let products = [];
    if (Array.isArray(data)) {
      // ถ้า data เป็น array ตรงๆ
      products = data;
    } else if (data.success && Array.isArray(data.data)) {
      // ถ้า data มี format { success: true, data: [...] }
      products = data.data;
    } else if (data.products && Array.isArray(data.products)) {
      // ถ้า data มี format { products: [...] }
      products = data.products;
    } else {
      console.warn('⚠️ Unexpected API response format:', data);
      products = [];
    }
    
    console.log('✅ Products loaded:', products.length);
    
    // แสดงข้อมูลสินค้า
    renderProductsData(products);
    
  } catch (error) {
    console.error('❌ Error loading products:', error);
    
    // แสดง error message ที่เป็นมิตร
    showErrorState('ไม่สามารถโหลดข้อมูลสินค้าได้', error.message);
  }
}

// ✅ เพิ่มฟังก์ชันสำหรับดึงข้อมูลสินค้าพร้อม pagination
async function loadProductsWithPagination(page = 1, limit = 10, search = '') {
  try {
    console.log(`📦 Loading products - Page: ${page}, Search: "${search}"`);
    
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search })
    });
    
    const response = await fetch(`/api/products?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      products: Array.isArray(data) ? data : (data.products || data.data || []),
      pagination: data.pagination || null
    };
    
  } catch (error) {
    console.error('❌ Error loading products with pagination:', error);
    throw error;
  }
}



// แก้ไขฟังก์ชัน renderProductsData
// ...existing code...

function renderProductsData(products) {
  const tableBody = document.getElementById('products-table-body');
  if (!tableBody) {
    console.error('❌ products-table-body element not found');
    return;
  }
  
  if (!Array.isArray(products) || products.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500">
          ${Array.isArray(products) ? 'ไม่มีสินค้าในระบบ' : 'รูปแบบข้อมูลไม่ถูกต้อง'}
        </td>
      </tr>
    `;
    return;
  }
  
  // สร้าง placeholder image เป็น data URL
  const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNiAxNkMyMS41MjI4IDE2IDI2IDE3LjM0MzEgMjYgMTlDMjYgMjAuNjU2OSAyMS41MjI4IDIyIDE2IDIyQzEwLjQ3NzIgMjIgNiAyMC42NTY5IDYgMTlDNiAxNy4zNDMxIDEwLjQ3NzIgMTYgMTYgMTZaIiBmaWxsPSIjOTQ5NEE0Ii8+CjxwYXRoIGQ9Ik0yNiAyM0MyNiAyNC42NTY5IDIxLjUyMjggMjYgMTYgMjZDMTAuNDc3MiAyNiA2IDI0LjY1NjkgNiAyM1Y2SDI2VjIzWiIgZmlsbD0iIzk0OTRBNCIvPgo8L3N2Zz4K';
  
  tableBody.innerHTML = products.map(product => `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex-shrink-0 h-10 w-10">
          ${product.image_url ? `
            <img 
              class="h-10 w-10 rounded-md object-cover" 
              src="${product.image_url}" 
              alt="${product.name || 'สินค้า'}"
              onerror="this.src='${placeholderImage}'"
            >
          ` : `
            <div class="h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center">
              <i data-lucide="image" class="w-5 h-5 text-gray-400"></i>
            </div>
          `}
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm text-gray-900">#${product.id || 'N/A'}</div>
      </td>
      <td class="px-6 py-4">
        <div class="text-sm font-medium text-gray-900">${product.name || 'ไม่มีชื่อสินค้า'}</div>
        <div class="text-xs text-gray-500 truncate max-w-xs">${product.description || ''}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm text-gray-900">${product.category?.name || product.category_name || '-'}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm text-gray-900">฿${parseFloat(product.price || 0).toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm ${parseInt(product.stock || 0) <= 5 ? 'text-red-600 font-medium' : 'text-gray-900'}">
          ${product.stock !== undefined ? product.stock : 'N/A'}
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
          ${product.is_active !== false ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div class="flex justify-end space-x-2">
          <button class="text-indigo-600 hover:text-indigo-900" onclick="viewProduct(${product.id})" title="ดูรายละเอียด">
            <i data-lucide="eye" class="w-5 h-5"></i>
          </button>
          <button class="text-blue-600 hover:text-blue-900" onclick="editProduct(${product.id})" title="แก้ไข">
            <i data-lucide="edit" class="w-5 h-5"></i>
          </button>
          <button class="text-red-600 hover:text-red-900" onclick="deleteProduct(${product.id})" title="ลบ">
            <i data-lucide="trash-2" class="w-5 h-5"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
  
  // Re-initialize icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}



function showErrorState(title, message) {
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.innerHTML = `
      <div class="text-center py-12">
        <div class="text-red-500 mb-4">
          <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2"></i>
          <h3 class="text-lg font-medium">${title}</h3>
          ${message ? `<p class="text-sm mt-2 text-gray-600">${message}</p>` : ''}
        </div>
        <button onclick="loadProducts()" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          ลองใหม่
        </button>
      </div>
    `;
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
}
function showLoadingState(message = 'กำลังโหลด...') {
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.innerHTML = `
      <div class="text-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p class="text-gray-600">${message}</p>
      </div>
    `;
  }
}

async function showOrders() {
  if (typeof ordersManager !== 'undefined') {
    await ordersManager.initialize();
  } else {
    document.getElementById('main-content').innerHTML = `
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p class="text-gray-600">กำลังโหลด Orders Manager...</p>
        </div>
      </div>
    `;
  }
}

// แก้ไข routing function ที่ line 2375 ให้เพิ่ม route สำหรับแก้ไขสินค้า

// ใน function ที่จัดการ routing
document.addEventListener('DOMContentLoaded', () => {
  // ... existing code ...
  
  // เพิ่มส่วนนี้ใน routing logic
  const pathSegments = window.location.pathname.split('/').filter(segment => segment);
  
  if (pathSegments.length >= 3 && pathSegments[1] === 'products' && pathSegments[2] === 'edit') {
    const productId = pathSegments[3];
    if (productId && !isNaN(productId)) {
      showEditProduct(parseInt(productId));
      return;
    }
  }
  
  // ... rest of existing routing logic ...
});


// เพิ่มใน app.js (หลังจาก line 2600)

/**
 * ฟังก์ชันสำหรับโหลด JavaScript file แบบ dynamic
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    
    script.onload = () => {
      console.log(`✅ Script loaded: ${src}`);
      resolve(true);
    };
    
    script.onerror = () => {
      console.error(`❌ Failed to load script: ${src}`);
      reject(new Error(`Failed to load script: ${src}`));
    };
    
    document.head.appendChild(script);
  });
}

/**
 * ฟังก์ชัน debug helper สำหรับ reports manager
 */
function debugReportsManager() {
  console.log('🔍 === REPORTS MANAGER DEBUG ===');
  console.log('ReportsManager Class:', window.ReportsManager);
  console.log('reportsManager Instance:', window.reportsManager);
  console.log('Current Location:', window.location.href);
  
  // ทดสอบโหลดไฟล์
  const testPaths = [
    '/admin/js/reports-manager.js',
    '/static/admin/js/reports-manager.js'
  ];
  
  testPaths.forEach(async (path) => {
    try {
      const response = await fetch(path, { method: 'HEAD' });
      console.log(`Path ${path}: ${response.status === 200 ? '✅ OK' : '❌ NOT FOUND'}`);
    } catch (error) {
      console.log(`Path ${path}: ❌ ERROR`, error);
    }
  });
}

// เพิ่มใน handleNavigation function

function handleNavigation() {
  const path = window.location.pathname;
  const segments = path.split('/').filter(s => s);
  
  // Clear active states
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('bg-indigo-600', 'text-white');
    link.classList.add('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');
  });
  
  // เพิ่มการจัดการสำหรับหน้าแก้ไขสินค้า
  if (segments.length >= 3 && segments[1] === 'products' && segments[2] === 'edit') {
    const productId = segments[3];
    if (productId && !isNaN(productId)) {
      // เปิดใช้งาน menu Products
      const productsLink = document.querySelector('a[href="/admin/products"]');
      if (productsLink) {
        productsLink.classList.remove('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');
        productsLink.classList.add('bg-indigo-600', 'text-white');
      }
      showEditProduct(parseInt(productId));
      return;
    }
  }
  
  // ... rest of navigation handling ...
}