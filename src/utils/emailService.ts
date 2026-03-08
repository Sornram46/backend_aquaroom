import nodemailer, { Transporter } from 'nodemailer';
import { prisma } from '../index';

interface OrderEmailData {
  orderId: number;
  orderNumber: string;
  customerName: string;
  phone: string;
  address: string;
  totalAmount: number;
  subtotal: number;
  shippingFee: number;
  discount: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

interface EmailSettings {
  email_service: string;
  admin_email: string;
  email_user: string;
  email_password: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  order_notification_enabled: boolean;
  is_configured: boolean;
}

/**
 * สร้าง transporter สำหรับส่งอีเมล
 */
async function createTransporter(): Promise<Transporter | null> {
  try {
    // ดึงการตั้งค่าจากฐานข้อมูล
    const settings = await prisma.email_notification_settings.findFirst({
      orderBy: { id: 'desc' }
    });

    if (!settings || !settings.is_configured || !settings.email_password) {
      console.log('📧 Email notification not configured or password missing');
      return null;
    }

    let transportConfig: any;

    // ตั้งค่าตาม email service ที่เลือก
    if (settings.email_service === 'gmail') {
      transportConfig = {
        service: 'gmail',
        auth: {
          user: settings.email_user,
          pass: settings.email_password
        }
      };
    } else if (settings.email_service === 'outlook') {
      transportConfig = {
        service: 'hotmail',
        auth: {
          user: settings.email_user,
          pass: settings.email_password
        }
      };
    } else if (settings.email_service === 'custom') {
      transportConfig = {
        host: settings.smtp_host,
        port: settings.smtp_port || 587,
        secure: settings.smtp_secure,
        auth: {
          user: settings.email_user,
          pass: settings.email_password
        }
      };
    } else {
      console.error('❌ Unsupported email service:', settings.email_service);
      return null;
    }

    const transporter = nodemailer.createTransport(transportConfig);
    
    // ทดสอบการเชื่อมต่อ
    try {
      await transporter.verify();
      console.log('✅ Email transporter verified successfully');
      return transporter;
    } catch (verifyError) {
      console.error('❌ Email transporter verification failed:', verifyError);
      return null;
    }

  } catch (error) {
    console.error('❌ Error creating email transporter:', error);
    return null;
  }
}

/**
 * ส่งอีเมลแจ้งเตือนออเดอร์ใหม่
 */
export async function sendOrderNotification(orderData: OrderEmailData): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    // ดึงการตั้งค่า
    const settings = await prisma.email_notification_settings.findFirst({
      orderBy: { id: 'desc' }
    });

    if (!settings || !settings.order_notification_enabled) {
      console.log('📧 Order notification is disabled');
      return { success: false, error: 'Order notification is disabled' };
    }

    // สร้าง transporter
    const transporter = await createTransporter();
    if (!transporter) {
      return { success: false, error: 'Failed to create email transporter' };
    }

    // สร้าง HTML สำหรับอีเมล
    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .order-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .order-info h2 { margin-top: 0; color: #667eea; font-size: 20px; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e9ecef; }
          .info-row:last-child { border-bottom: none; }
          .label { font-weight: bold; color: #495057; }
          .value { color: #6c757d; }
          .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .items-table th { background: #667eea; color: white; padding: 12px; text-align: left; }
          .items-table td { padding: 12px; border-bottom: 1px solid #e9ecef; }
          .items-table tr:last-child td { border-bottom: none; }
          .total-section { background: #e7f3ff; padding: 15px; border-radius: 8px; margin-top: 20px; }
          .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
          .total-row.grand { font-weight: bold; font-size: 18px; color: #667eea; border-top: 2px solid #667eea; padding-top: 12px; margin-top: 8px; }
          .footer { text-align: center; margin-top: 30px; color: #6c757d; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛒 มีออเดอร์ใหม่เข้ามา!</h1>
          </div>
          <div class="content">
            <div class="order-info">
              <h2>📋 ข้อมูลออเดอร์</h2>
              <div class="info-row">
                <span class="label">เลขที่ออเดอร์:</span>
                <span class="value">#${orderData.orderNumber}</span>
              </div>
              <div class="info-row">
                <span class="label">ชื่อลูกค้า:</span>
                <span class="value">${orderData.customerName}</span>
              </div>
              <div class="info-row">
                <span class="label">เบอร์โทร:</span>
                <span class="value">${orderData.phone}</span>
              </div>
              <div class="info-row">
                <span class="label">ที่อยู่จัดส่ง:</span>
                <span class="value">${orderData.address}</span>
              </div>
              <div class="info-row">
                <span class="label">วันที่สั่งซื้อ:</span>
                <span class="value">${new Date().toLocaleString('th-TH', { 
                  timeZone: 'Asia/Bangkok',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</span>
              </div>
            </div>

            <h3>🛍️ รายการสินค้า</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th>สินค้า</th>
                  <th style="text-align: center;">จำนวน</th>
                  <th style="text-align: right;">ราคา</th>
                  <th style="text-align: right;">รวม</th>
                </tr>
              </thead>
              <tbody>
                ${orderData.items.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;">${item.price.toLocaleString('th-TH')} ฿</td>
                    <td style="text-align: right;">${(item.price * item.quantity).toLocaleString('th-TH')} ฿</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="total-section">
              <div class="total-row">
                <span>ยอดรวมสินค้า:</span>
                <span>${orderData.subtotal.toLocaleString('th-TH')} ฿</span>
              </div>
              <div class="total-row">
                <span>ค่าจัดส่ง:</span>
                <span>${orderData.shippingFee.toLocaleString('th-TH')} ฿</span>
              </div>
              ${orderData.discount > 0 ? `
                <div class="total-row">
                  <span>ส่วนลด:</span>
                  <span style="color: #dc3545;">-${orderData.discount.toLocaleString('th-TH')} ฿</span>
                </div>
              ` : ''}
              <div class="total-row grand">
                <span>ยอดรวมทั้งหมด:</span>
                <span>${orderData.totalAmount.toLocaleString('th-TH')} ฿</span>
              </div>
            </div>

            <div class="footer">
              <p>📧 อีเมลนี้ถูกส่งอัตโนมัติจากระบบ Aquaroom</p>
              <p>กรุณาตรวจสอบและดำเนินการจัดเตรียมสินค้าให้ลูกค้า</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // ส่งอีเมล
    const info = await transporter.sendMail({
      from: `"Aquaroom Shop" <${settings.email_user}>`,
      to: settings.admin_email,
      subject: `🛒 ออเดอร์ใหม่! #${orderData.orderNumber} - ${orderData.customerName}`,
      html: emailHTML
    });

    console.log('✅ Order notification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error sending order notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * ทดสอบการส่งอีเมล
 */
export async function sendTestEmail(): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const settings = await prisma.email_notification_settings.findFirst({
      orderBy: { id: 'desc' }
    });

    if (!settings) {
      return { success: false, error: 'Email settings not found' };
    }

    const transporter = await createTransporter();
    if (!transporter) {
      return { success: false, error: 'Failed to create email transporter' };
    }

    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 20px auto; padding: 20px; background: #f9f9f9; border-radius: 10px; }
          .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; }
          .success { color: #28a745; font-size: 48px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ ทดสอบการส่งอีเมล</h1>
          </div>
          <div class="content">
            <div class="success">✓</div>
            <h2 style="text-align: center; color: #667eea;">การตั้งค่าอีเมลใช้งานได้!</h2>
            <p style="text-align: center;">ระบบแจ้งเตือนทาง Email สำหรับ Aquaroom พร้อมใช้งานแล้ว</p>
            <p style="text-align: center; color: #6c757d; font-size: 14px;">
              เวลาที่ทดสอบ: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"Aquaroom Shop" <${settings.email_user}>`,
      to: settings.admin_email,
      subject: '✅ ทดสอบการส่งอีเมล - Aquaroom',
      html: testHTML
    });

    console.log('✅ Test email sent:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error sending test email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
