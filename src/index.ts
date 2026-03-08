import express, { Request, Response, NextFunction } from 'express';

import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import Busboy from 'busboy';
import fs, { lutimes } from 'fs';
import session from 'express-session';
import { OAuth2Client } from 'google-auth-library';
import { supabase, testSupabaseConnection, ensureBucketExists } from './utils/supabase';
import { auth } from './middlewares/auth.middleware';

// Extend SessionData to include 'admin' property
declare module 'express-session' {
  interface SessionData {
    admin?: any;
  }
}

// Load environment variables ก่อน
dotenv.config();

// Initialize Prisma client
export const prisma = new PrismaClient();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Type declarations
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
      };
      files?: any[];
    }
  }
}


// Middlewares
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Early Supabase connection test with actionable logs
(async () => {
  const ok = await testSupabaseConnection();
  if (!ok) {
    console.warn('[Startup] Supabase connection test failed. Please verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  } else {
    console.log('[Startup] Supabase connection test completed.');
  }
})();

// ===========================================
// STATIC FILES (single definitions)
// ===========================================
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/static', express.static(path.join(__dirname, '../public'))); // legacy path (kept for backward compatibility)
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// Explicit JS route with proper headers (avoid content-type issues when proxied)
app.use('/admin/js', express.static(path.join(__dirname, '../public/admin/js'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300'); // short cache, can be tuned
    }
  }
}));
app.use(session({
  secret: process.env.JWT_SECRET || 'admin-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
// Helper function สำหรับ handle file upload ด้วย busboy
const handleFileUploadWithBusboy = (req: Request, res: Response, next: Function) => {
  const busboy = Busboy({ headers: req.headers });
  const files: any[] = [];
  const fields: any = {};

  busboy.on('file', (fieldname, file, info) => {
    const { filename, encoding, mimeType } = info;
    const chunks: Buffer[] = [];

    file.on('data', (chunk) => {
      chunks.push(chunk);
    });

    file.on('end', () => {
      const buffer = Buffer.concat(chunks);
      files.push({
        fieldname,
        originalname: filename,
        encoding,
        mimetype: mimeType,
        buffer,
        size: buffer.length
      });
    });
  });

  busboy.on('field', (fieldname, value) => {
    fields[fieldname] = value;
  });

  busboy.on('finish', () => {
    req.files = files;
    req.body = fields;
    next();
  });

  req.pipe(busboy);
};



// ===========================================
// STATIC ROUTES
// ===========================================

// Admin login route - ต้องอยู่ก่อน route ทั่วไป
app.get('/admin/login', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/admin/login.html'));
});

// Admin panel SPA catch-all (must come AFTER static definitions but BEFORE API fallbacks)
app.get(/^\/admin(\/.*)?$/, (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// ===========================================
// API ROUTES (ไม่ต้อง auth แล้ว)
// ===========================================

app.use('/static', express.static(path.join(__dirname, '../public')));

// (Removed duplicate /static & /admin static registrations and duplicate catch-all route)

// Guard: if an asset-like request reaches here (i.e. NOT served above) return 404 instead of HTML to prevent
// browsers interpreting index.html as JS -> "Unexpected token '<'" errors.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (/\.(js|css|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf)$/.test(req.path)) {
    return res.status(404).type('text/plain').send('Not found');
  }
  next();
});

// API Routes for Dashboard
app.get('/api/dashboard/stats', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Dashboard stats API called');
    
    // ดึงข้อมูลสินค้า
    console.log('📦 Fetching products count...');
    const productsCount = await prisma.product.count();
    console.log('📦 Products count:', productsCount);
    
    // ข้อมูลอื่นๆ
    let ordersCount = 0;
    let customersCount = 0;
    let totalRevenue = 0;
    
    try {
      console.log('📋 Fetching orders count...');
      // ดึงจำนวนคำสั่งซื้อจากตาราง orders
      ordersCount = await prisma.orders.count();
      console.log('📋 Orders count:', ordersCount);
      
      console.log('👥 Fetching customers count...');
      // ดึงจำนวนลูกค้าจากตาราง users (เฉพาะที่ไม่ใช่ admin)
      customersCount = await prisma.users.count({
        where: {
          role: {
            not: 'admin'  // นับเฉพาะที่ไม่ใช่ admin
          }
        }
      });
      console.log('👥 Customers count:', customersCount);
      
      console.log('💰 Fetching revenue...');
      // คำนวณรายได้ทั้งหมดจากคำสั่งซื้อ
      const revenueResult = await prisma.orders.aggregate({
        _sum: {
          total_amount: true
        },
        where: {
          payment_status: 'paid' // สถานะที่ชำระเงินแล้ว
        }
      });
      console.log('💰 Revenue result:', revenueResult);
      
      totalRevenue = revenueResult._sum.total_amount 
        ? Number(revenueResult._sum.total_amount)
        : 0;
      console.log('💰 Total revenue:', totalRevenue);
    } catch (err) {
      console.log('❌ Error fetching stats:', err);
      // ถ้าเกิดข้อผิดพลาด ค่าเริ่มต้นจะเป็น 0 อยู่แล้ว
    }
    
    const result = {
      products: productsCount,
      orders: ordersCount,
      customers: customersCount,
      revenue: totalRevenue
    };
    
    console.log('✅ Final dashboard stats:', result);
    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ===========================================
// CUSTOMER AUTH ROUTES (/api/auth/*)
// ===========================================

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

const GOOGLE_CLIENT_IDS = (process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

if (GOOGLE_CLIENT_IDS.length > 0) {
  console.log(`[Google OAuth] Configured client IDs: ${GOOGLE_CLIENT_IDS.join(', ')}`);
} else {
  console.warn('[Google OAuth] No GOOGLE_CLIENT_ID set. Falling back to generic verification. Add GOOGLE_CLIENT_ID in backend .env for stricter checks.');
}

let googleOAuthClient: OAuth2Client | null = null;

function ensureGoogleClient(): OAuth2Client {
  if (!googleOAuthClient) {
    googleOAuthClient = GOOGLE_CLIENT_IDS.length > 0 ? new OAuth2Client(GOOGLE_CLIENT_IDS[0]) : new OAuth2Client();
  }
  return googleOAuthClient;
}

function signUserToken(user: { id: number; role?: string | null }) {
  return jwt.sign({ userId: user.id, role: user.role || 'customer' }, JWT_SECRET, { expiresIn: '7d' });
}

// Register
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'กรอกข้อมูลให้ครบถ้วน (name, email, password)' });
    }
    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: { name, email, password: hashed, role: 'customer', auth_provider: 'local', created_at: new Date(), updated_at: new Date() }
    });
    const token = signUserToken(user);
    return res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar || null } });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'ไม่สามารถสมัครสมาชิกได้' });
  }
});

// Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'กรอกข้อมูลให้ครบถ้วน (email, password)' });
    }
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }
    await prisma.users.update({ where: { id: user.id }, data: { last_login: new Date(), updated_at: new Date() } });
    const token = signUserToken(user);
    return res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar || null } });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'ไม่สามารถเข้าสู่ระบบได้' });
  }
});

// Verify
app.get('/api/auth/verify', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'ไม่ได้รับอนุญาต' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = await prisma.users.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ success: false, message: 'ไม่ได้รับอนุญาต' });
    return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar || null } });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token ไม่ถูกต้อง' });
  }
});

// Refresh
app.post('/api/auth/refresh', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'ไม่ได้รับอนุญาต' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = await prisma.users.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ success: false, message: 'ไม่ได้รับอนุญาต' });
    const newToken = signUserToken(user);
    return res.json({ success: true, token: newToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar || null } });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token ไม่ถูกต้อง' });
  }
});

// Logout (stateless)
app.post('/api/auth/logout', (_req: Request, res: Response) => {
  return res.json({ success: true });
});

// Google login
app.post('/api/auth/google', async (req: Request, res: Response) => {
  try {
    const client = ensureGoogleClient();

    const { credential } = req.body || {};
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ success: false, message: 'Missing Google credential.' });
    }

    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_IDS.length > 0 ? GOOGLE_CLIENT_IDS : undefined,
      });
    } catch (verifyError) {
      console.error('Google token verification failed:', verifyError);
      if (GOOGLE_CLIENT_IDS.length === 0) {
        return res.status(500).json({
          success: false,
          message: 'Google token verification failed and no GOOGLE_CLIENT_ID is configured on the server. Please add GOOGLE_CLIENT_ID to the backend environment.',
        });
      }
      throw verifyError;
    }
    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({ success: false, message: 'Invalid Google token payload.' });
    }

    const email = payload.email;
    const googleId = payload.sub;
    if (!email || !googleId) {
      return res.status(400).json({ success: false, message: 'Google account must include an email address.' });
    }

    const displayName = payload.name || `${payload.given_name || ''} ${payload.family_name || ''}`.trim() || email;
    const avatarUrl = payload.picture || undefined;
    const emailVerified = payload.email_verified ?? true;

    let user = await prisma.users.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.users.create({
        data: {
          name: displayName,
          email,
          password: null,
          role: 'customer',
          auth_provider: 'google',
          auth_provider_id: googleId,
          avatar: avatarUrl,
          is_email_verified: emailVerified,
          created_at: new Date(),
          updated_at: new Date(),
          last_login: new Date(),
        },
      });
    } else {
      user = await prisma.users.update({
        where: { id: user.id },
        data: {
          auth_provider: 'google',
          auth_provider_id: googleId,
          name: user.name || displayName,
          avatar: avatarUrl ?? user.avatar ?? undefined,
          is_email_verified: emailVerified ?? user.is_email_verified ?? true,
          last_login: new Date(),
          updated_at: new Date(),
        },
      });
    }

    const token = signUserToken(user);
    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null,
      },
    });
  } catch (error) {
    console.error('Google login error:', error);
    if (error instanceof Error) {
      return res.status(401).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Google login failed' });
  }
});

app.get('/api/_diag/google', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    configuredIds: GOOGLE_CLIENT_IDS,
    hasClient: googleOAuthClient !== null,
    message: GOOGLE_CLIENT_IDS.length > 0
      ? 'Google client IDs loaded. If login still fails, confirm the OAuth console has this origin allowed.'
      : 'No Google client IDs configured. Set GOOGLE_CLIENT_ID in the backend environment for stricter validation.',
  });
});

// ===========================================
// USER PROFILE & ADDRESSES
// ===========================================

// Profile
app.get('/api/user/profile', auth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.users.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar || null } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'ไม่สามารถดึงข้อมูลผู้ใช้ได้' });
  }
});

app.put('/api/user/profile', auth, async (req: Request, res: Response) => {
  try {
    const { name, avatar } = req.body || {};
    const updated = await prisma.users.update({ where: { id: req.user!.id }, data: { name: name ?? undefined, avatar: avatar ?? undefined, updated_at: new Date() } });
    return res.json({ success: true, user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, avatar: updated.avatar || null } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'อัปเดตโปรไฟล์ไม่สำเร็จ' });
  }
});

// Addresses
app.get('/api/user/addresses', auth, async (req: Request, res: Response) => {
  try {
    const addresses = await prisma.user_addresses.findMany({ where: { user_id: req.user!.id }, orderBy: { updated_at: 'desc' } });
    return res.json({ success: true, addresses });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'ไม่สามารถดึงที่อยู่ได้' });
  }
});

app.post('/api/user/addresses', auth, async (req: Request, res: Response) => {
  try {
    const { name, phone, address_line1, address_line2, district, city, province, postal_code, is_default } = req.body || {};
    if (!name || !phone || !address_line1 || !district || !city || !province || !postal_code) {
      return res.status(400).json({ success: false, message: 'กรอกข้อมูลที่อยู่ให้ครบ' });
    }
    if (is_default) {
      await prisma.user_addresses.updateMany({ where: { user_id: req.user!.id, is_default: true }, data: { is_default: false } });
    }
    const created = await prisma.user_addresses.create({
      data: { user_id: req.user!.id, name, phone, address_line1, address_line2, district, city, province, postal_code, is_default: !!is_default, created_at: new Date(), updated_at: new Date() }
    });
    return res.status(201).json({ success: true, address: created });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'ไม่สามารถเพิ่มที่อยู่ได้' });
  }
});

app.put('/api/user/addresses/:id', auth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID ไม่ถูกต้อง' });
    const address = await prisma.user_addresses.findUnique({ where: { id } });
    if (!address || address.user_id !== req.user!.id) return res.status(404).json({ success: false, message: 'ไม่พบที่อยู่' });
    const { is_default, ...rest } = req.body || {};
    if (is_default) {
      await prisma.user_addresses.updateMany({ where: { user_id: req.user!.id, is_default: true }, data: { is_default: false } });
    }
    const updated = await prisma.user_addresses.update({ where: { id }, data: { ...rest, is_default: !!is_default, updated_at: new Date() } });
    return res.json({ success: true, address: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'อัปเดตที่อยู่ไม่สำเร็จ' });
  }
});

app.delete('/api/user/addresses/:id', auth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID ไม่ถูกต้อง' });
    const address = await prisma.user_addresses.findUnique({ where: { id } });
    if (!address || address.user_id !== req.user!.id) return res.status(404).json({ success: false, message: 'ไม่พบที่อยู่' });
    await prisma.user_addresses.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'ลบที่อยู่ไม่สำเร็จ' });
  }
});

app.get('/api/user/addresses/default', auth, async (req: Request, res: Response) => {
  try {
    const def = await prisma.user_addresses.findFirst({ where: { user_id: req.user!.id, is_default: true } });
    return res.json({ success: true, address: def || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'ไม่สามารถดึงที่อยู่เริ่มต้นได้' });
  }
});

app.get('/api/user/addresses/check', auth, async (req: Request, res: Response) => {
  try {
    const count = await prisma.user_addresses.count({ where: { user_id: req.user!.id } });
    return res.json({ success: true, hasAddress: count > 0, count });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'ตรวจสอบที่อยู่ไม่สำเร็จ' });
  }
});

// User stats
app.get('/api/user/stats', auth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const [orders, totalSpentAgg] = await Promise.all([
      prisma.orders.findMany({
        where: { user_id: userId },
        select: { payment_status: true, order_status: true }
      }),
      prisma.orders.aggregate({
        _sum: { total_amount: true },
        where: { user_id: userId, payment_status: 'paid' }
      })
    ]);

    const totalOrders = orders.length;

    const completedStatuses = ['completed', 'delivered', 'success', 'shipped'];
    const cancelledStatuses = ['cancelled', 'refunded', 'failed'];

    const completedOrders = orders.filter(order =>
      order.payment_status === 'paid' || (order.order_status ? completedStatuses.includes(order.order_status.toLowerCase()) : false)
    ).length;

    const pendingOrders = orders.filter(order => {
      const status = order.order_status ? order.order_status.toLowerCase() : '';
      const paymentStatus = order.payment_status ? order.payment_status.toLowerCase() : '';

      const isCompleted = paymentStatus === 'paid' || completedStatuses.includes(status);
      const isCancelled = cancelledStatuses.includes(status) || ['refunded', 'cancelled', 'failed'].includes(paymentStatus);

      return !isCompleted && !isCancelled;
    }).length;

    const totalSpent = Number(totalSpentAgg._sum.total_amount || 0);

    return res.json({
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        completedOrders,
        totalSpent
      },
      ordersCount: totalOrders,
      totalSpent
    });
  } catch (error) {
    console.error('User stats error:', error);
    return res.status(500).json({ success: false, message: 'ไม่สามารถดึงสถิติผู้ใช้ได้' });
  }
});
app.get('/api/_diag/db', async (_req: Request, res: Response) => {
  try {
    const [total, visible] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { deleted_at: null } }),
    ]);

    let host: string | null = null;
    let name: string | null = null;
    try {
      const u = new URL(process.env.DATABASE_URL || '');
      host = u.host;
      name = u.pathname?.replace('/', '') || null;
    } catch {}

    return res.json({ ok: true, products: { total, visible }, database_url: { host, name } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'diag failed' });
  }
});
// API สำหรับดึงสินค้าทั้งหมด
app.get('/api/products', async (req: Request, res: Response) => {
  try {

     res.setHeader('X-API-REV', 'products-limit-1000');
    res.setHeader('Cache-Control', 'no-store');

    const limitRaw = req.query.limit;
    const offsetRaw = req.query.offset;
    const idParam = req.query.id;
    if (idParam !== undefined) {
      const id = Number(idParam);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid product id' });

      const p = await prisma.product.findUnique({
        where: { id },
        include: { product_categories: { include: { categories: true } } },
      });
      if (!p || p.deleted_at) return res.status(404).json({ error: 'Product not found' });

      return res.json({
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        image_url: p.image_url,
        image_url_two: p.image_url_two,
        image_url_three: p.image_url_three,
        image_url_four: p.image_url_four,
        stock: p.stock,
        category: p.product_categories[0]?.categories?.name ?? 'ทั่วไป',
        shipping_cost_bangkok: p.shipping_cost_bangkok ? Number(p.shipping_cost_bangkok) : 0,
      shipping_cost_provinces: p.shipping_cost_provinces ? Number(p.shipping_cost_provinces) : 0,
      has_special_shipping: p.has_special_shipping,
      special_shipping_base: p.special_shipping_base ? Number(p.special_shipping_base) : null,
      special_shipping_qty: p.special_shipping_qty,
      special_shipping_extra: p.special_shipping_extra ? Number(p.special_shipping_extra) : null,
      });
    } 
 const limit = limitRaw != null ? Number(limitRaw) : 1000; // default 1000
    const offset = offsetRaw != null ? Number(offsetRaw) : 0;
    
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 1000) : 1000;
    const safeOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0;

    const products = await prisma.product.findMany({
      where: { deleted_at: null },
      orderBy: { id: 'desc' },
      skip: safeOffset,
      take: safeLimit,
      include: { product_categories: { include: { categories: true } } },
    });

    return res.json(products.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      image_url: p.image_url,
      image_url_two: p.image_url_two,
      image_url_three: p.image_url_three,
      image_url_four: p.image_url_four,
      stock: p.stock,
      category: p.product_categories[0]?.categories?.name ?? 'ทั่วไป',
      shipping_cost_bangkok: p.shipping_cost_bangkok ? Number(p.shipping_cost_bangkok) : 0,
      shipping_cost_provinces: p.shipping_cost_provinces ? Number(p.shipping_cost_provinces) : 0,
      has_special_shipping: p.has_special_shipping,
      special_shipping_base: p.special_shipping_base ? Number(p.special_shipping_base) : null,
      special_shipping_qty: p.special_shipping_qty,
      special_shipping_extra: p.special_shipping_extra ? Number(p.special_shipping_extra) : null,
    })));
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
});



app.get('/api/products/:id(\\d+)', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid product id' });

    const p = await prisma.product.findUnique({
      where: { id },
      include: { product_categories: { include: { categories: true } } },
    });
    if (!p || p.deleted_at) return res.status(404).json({ error: 'Product not found' });

    return res.json({
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      image_url: p.image_url,
      image_url_two: p.image_url_two,
      image_url_three: p.image_url_three,
      image_url_four: p.image_url_four,
      stock: p.stock,
      category: p.product_categories[0]?.categories?.name ?? 'ทั่วไป',
      shipping_cost_bangkok: p.shipping_cost_bangkok ? Number(p.shipping_cost_bangkok) : 0,
      shipping_cost_provinces: p.shipping_cost_provinces ? Number(p.shipping_cost_provinces) : 0,
      shipping_cost_remote: p.shipping_cost_remote ? Number(p.shipping_cost_remote) : 0,
      free_shipping_threshold: p.free_shipping_threshold ? Number(p.free_shipping_threshold) : null,
      delivery_time: p.delivery_time,
      has_special_shipping: p.has_special_shipping,
      special_shipping_base: p.special_shipping_base ? Number(p.special_shipping_base) : null,
      special_shipping_qty: p.special_shipping_qty,
      special_shipping_extra: p.special_shipping_extra ? Number(p.special_shipping_extra) : null,
    });
  } catch (error) {
    console.error('Error fetching product by id:', error);
    return res.status(500).json({ error: 'Failed to fetch product' });
  }
});
// API สำหรับดึงสินค้ายอดนิยม
app.get('/api/products/popular', async (req: Request, res: Response) => {
  try {
    const limit = parseInt((req.query.limit as string) || '8');
    const products = await prisma.product.findMany({
      where: { is_popular: true, deleted_at: null },
      orderBy: { id: 'desc' },
      take: isNaN(limit) ? 8 : limit,
    });

    const normalized = products.map((p: any) => ({
      ...p,
      price: p?.price != null ? Number(p.price) : p.price,
      shipping_cost_bangkok: p?.shipping_cost_bangkok != null ? Number(p.shipping_cost_bangkok) : p.shipping_cost_bangkok,
      shipping_cost_provinces: p?.shipping_cost_provinces != null ? Number(p.shipping_cost_provinces) : p.shipping_cost_provinces,
      shipping_cost_remote: p?.shipping_cost_remote != null ? Number(p.shipping_cost_remote) : p.shipping_cost_remote,
      special_shipping_base: p?.special_shipping_base != null ? Number(p.special_shipping_base) : p.special_shipping_base,
      special_shipping_extra: p?.special_shipping_extra != null ? Number(p.special_shipping_extra) : p.special_shipping_extra,
      free_shipping_threshold: p?.free_shipping_threshold != null ? Number(p.free_shipping_threshold) : p.free_shipping_threshold,
    }));

    return res.json(normalized);
  } catch (error) {
    console.error('Error fetching popular products:', error);
    return res.status(500).json({ error: 'Failed to fetch popular products' });
  }
});

 app.post('/api/products/shipping', async (req: Request, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? (req.body.ids as any[]).map((v) => Number(v)).filter((n) => Number.isFinite(n))
      : [];
    if (ids.length === 0) {
      return res.status(400).json({ success: false, error: 'missing_ids' });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: ids } as any },
      select: {
        id: true,
        name: true,
        has_special_shipping: true,
        special_shipping_base: true,
        special_shipping_qty: true,
        special_shipping_extra: true,
        shipping_cost_provinces: true,
        shipping_cost_bangkok: true,
        shipping_cost_remote: true,
      },
    });

    return res.json({ success: true, products });
  } catch (e) {
    console.error('products/shipping error:', e);
    return res.status(500).json({ success: false, error: 'server_error' });
  }
});

// ...existing code...

// สร้าง API สำหรับดึงข้อมูลคำสั่งซื้อล่าสุด
app.get('/api/orders/recent', async (req: Request, res: Response) => {
  try {
    // ดึงข้อมูลจริงจากตาราง orders
    const recentOrders = await prisma.orders.findMany({
      take: 5, // จำนวนรายการที่ต้องการดึง
      orderBy: {
        order_number: 'desc' // เรียงตาม order_number จากมากไปน้อย
      },
      include: {
        users: true, // รวมข้อมูลผู้ใช้ด้วย
        user_addresses: true // รวมข้อมูลที่อยู่ด้วย
      }
    });
    
    // แปลงข้อมูลให้อยู่ในรูปแบบที่ต้องการส่งให้ frontend
    const formattedOrders = recentOrders.map((order: any) => {
      // แก้ไข #1: ใช้ฟิลด์ name แทน full_name ตามโครงสร้างตาราง
      const customerName = order.users?.name || order.users?.email || 'ไม่ระบุ';
      
      // แปลงวันที่เป็นรูปแบบไทย
      const orderDate = order.created_at 
        ? new Date(order.created_at).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        : 'ไม่ระบุ';
      
      // แก้ไข #2: แปลง Decimal เป็น number โดยใช้ Number() แทน parseFloat
      const totalAmount = order.total_amount 
        ? Number(order.total_amount) 
        : 0;
      
      return {
        id: order.id,
        orderNumber: order.order_number,
        customer: customerName,
        total: totalAmount,
        status: order.order_status || 'ไม่ระบุ',
        paymentStatus: order.payment_status || 'ไม่ระบุ',
        date: orderDate
      };
    });
    
    res.json(formattedOrders);
  } catch (error: any) {
    console.error('Error fetching recent orders:', error);
    res.status(500).json({ 
      error: 'Failed to fetch recent orders',
      details: error?.message || 'Unknown error'
    });
  }
});

// API สำหรับดึงหมวดหมู่ทั้งหมด
app.get('/api/categories', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.categories.findMany({
      orderBy: { id: 'desc' },
      select: {
        id: true,
        name: true,
        image_url_cate: true,
        is_active: true,
        _count: { select: { product_categories: true } }
      }
    });

    const formatted = categories.map((c) => ({
      id: c.id,
      name: c.name,
      image_url_cate: c.image_url_cate,
      is_active: c.is_active,
      products_count: c._count?.product_categories ?? 0
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});


// API สำหรับสร้างหมวดหมู่ใหม่
// CREATE CATEGORY (เพิ่ม slug)
// CREATE CATEGORY (เพิ่ม slug + debug log)
app.post('/api/categories', (req, res, next) => {
  (async () => {
    try {
      const { name, image_url_cate, is_active, slug } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'ต้องระบุ name' });

      const existingByName = await prisma.categories.findFirst({ where: { name } });
      if (existingByName) return res.status(409).json({ success: false, message: 'ชื่อหมวดหมู่ซ้ำ' });

      let finalSlug = slug && String(slug).trim() ? toSlug(slug) : await generateUniqueSlug(name);
      if (!finalSlug) finalSlug = await generateUniqueSlug(`cat-${Date.now()}`);

      const dup = await prisma.categories.findFirst({ where: { slug: finalSlug } });
      if (dup) finalSlug = await generateUniqueSlug(name);

      console.log('[categories:create] name=', name, 'finalSlug=', finalSlug);

      const category = await prisma.categories.create({
        data: {
          name,
          slug: finalSlug,
          image_url_cate: image_url_cate || null,
          is_active: is_active !== undefined ? !!is_active : true
        }
      });

      res.json({ success: true, category });
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ success: false, error: 'Failed to create category' });
    }
  })().catch(next);
});

// API สำหรับดึงหมวดหมู่ตาม ID
app.get('/api/categories/:id(\\d+)', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const categoryId = parseInt(req.params.id);

      if (isNaN(categoryId)) {
        return res.status(400).json({ error: 'Invalid category ID' });
      }

      const category = await prisma.categories.findUnique({
        where: { id: categoryId },
        include: {
          _count: {
            select: {
              product_categories: true
            }
          }
        }
      });

      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      res.json({
        ...category,
        products_count: category._count.product_categories
      });
    } catch (error) {
      console.error('Error fetching category:', error);
      res.status(500).json({ error: 'Failed to fetch category' });
    }
  })().catch(next);
});

// API สำหรับอัปเดตหมวดหมู่
app.put('/api/categories/:id(\\d+)', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const categoryId = parseInt(req.params.id);
      const { name, image_url_cate, is_active, slug, regenerateSlug } = req.body;

      if (isNaN(categoryId)) {
        return res.status(400).json({ success: false, message: 'ID ไม่ถูกต้อง' });
      }

      const existing = await prisma.categories.findUnique({ where: { id: categoryId } });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'ไม่พบหมวดหมู่' });
      }

      // ตรวจสอบชื่อซ้ำ (ยกเว้นตัวเอง)
      if (name && name !== existing.name) {
        const dupName = await prisma.categories.findFirst({ where: { name } });
        if (dupName) {
          return res.status(409).json({ success: false, message: 'ชื่อหมวดหมู่ซ้ำ' });
        }
      }

      let finalSlug = existing.slug;

      // ถ้าผู้ใช้ส่ง slug ใหม่ หรือขอ regenerateSlug หรือชื่อเปลี่ยนแต่ไม่มี slug ส่งมา
      if (slug && slug !== existing.slug) {
        const candidate = toSlug(slug);
        const dupSlug = await prisma.categories.findFirst({ where: { slug: candidate } });
        finalSlug = dupSlug ? await generateUniqueSlug(slug) : candidate;
      } else if (regenerateSlug) {
        finalSlug = await generateUniqueSlug(name || existing.name);
      } else if (name && name !== existing.name && !slug) {
        // เปลี่ยนชื่อแต่ไม่ส่ง slug → sync slug ตามชื่อใหม่ (ไม่ชน)
        const candidate = toSlug(name);
        const dupSlug = await prisma.categories.findFirst({ where: { slug: candidate } });
        finalSlug = dupSlug ? await generateUniqueSlug(name) : candidate;
      }

      const updated = await prisma.categories.update({
        where: { id: categoryId },
        data: {
          name: name ?? existing.name,
          slug: finalSlug,
            image_url_cate: image_url_cate !== undefined ? image_url_cate || null : existing.image_url_cate,
          is_active: is_active !== undefined ? !!is_active : existing.is_active,
          updated_at: new Date()
        }
      });

      res.json({ success: true, category: updated });
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update category'
      });
    }
  })().catch(next);
});

// API สำหรับลบหมวดหมู่
app.delete('/api/categories/:id(\\d+)', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const categoryId = parseInt(req.params.id);

      if (isNaN(categoryId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category ID'
        });
      }

      // ตรวจสอบว่ามีสินค้าในหมวดหมู่นี้หรือไม่
      const productsInCategory = await prisma.product_categories.count({
        where: { category_id: categoryId }
      });

      if (productsInCategory > 0) {
        return res.status(400).json({
          success: false,
          error: 'ไม่สามารถลบหมวดหมู่ที่มีสินค้าอยู่ได้'
        });
      }

      // ลบหมวดหมู่
      await prisma.categories.delete({
        where: { id: categoryId }
      });

      res.json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete category'
      });
    }
  })().catch(next);
});

// Root route
app.get('/', (req: Request, res: Response) => {
  res.send('Welcome to AquaRoom Admin API');
});

// Lightweight diagnostics: storage readiness
app.get('/api/_diag/storage', async (_req: Request, res: Response) => {
  try {
    const hasUrl = !!process.env.SUPABASE_URL;
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_BUCKET || '';

    // Avoid exposing secrets
    let ensureResult: boolean | string = 'skipped (no bucket name)';
    if (bucket) {
      try {
        ensureResult = await ensureBucketExists(bucket);
      } catch (e: any) {
        ensureResult = `error: ${e?.message || 'unknown'}`;
      }
    }

    res.json({
      success: true,
      env: {
        SUPABASE_URL: hasUrl,
        SUPABASE_SERVICE_ROLE_KEY: hasServiceKey,
        SUPABASE_BUCKET: bucket || null,
      },
      ensureBucket: ensureResult,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'diag failed' });
  }
});

// API สำหรับสร้างสินค้ารายการใหม่
// แก้ไข API สำหรับสร้างสินค้าใหม่
app.post('/api/products', (req: Request, res: Response, next) => {
  (async () => {
    try {
      console.log('📥 Received product data:', req.body);
      
      const { 
        name, 
        description, 
        price, 
        stock, 
        categoryId, 
        popular, 
        images,
        
        // การตั้งค่าการจัดส่งปกติ
        shipping_cost_bangkok,
        shipping_cost_provinces,
        shipping_cost_remote,
        free_shipping_threshold,
        delivery_time,
        shipping_notes,
        special_handling,
        
        // 🐠 การตั้งค่าการจัดส่งพิเศษ
        has_special_shipping,
        special_shipping_base,
        special_shipping_qty,
        special_shipping_extra,
        special_shipping_notes
      } = req.body;

      // Validation พื้นฐาน
      if (!name || price === undefined || stock === undefined) {
        return res.status(400).json({ 
          success: false, 
          error: 'ข้อมูลไม่ครบถ้วน: ต้องมีชื่อสินค้า, ราคา, และจำนวนสต็อก' 
        });
      }

      if (price < 0 || stock < 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'ราคาและจำนวนสต็อกต้องไม่ติดลบ' 
        });
      }

      // ตรวจสอบข้อมูลการจัดส่งพิเศษ
      if (has_special_shipping) {
        if (!special_shipping_base || !special_shipping_qty || special_shipping_extra === undefined) {
          return res.status(400).json({ 
            success: false, 
            error: 'ข้อมูลการตั้งค่าการจัดส่งพิเศษไม่ครบถ้วน' 
          });
        }
      }

      // จัดการรูปภาพ
      const [image_url, image_url_two, image_url_three, image_url_four] = images || [];

      // แปลงข้อมูล
      const parsedPrice = typeof price === 'string' ? parseFloat(price) : price;
      const parsedStock = typeof stock === 'string' ? parseInt(stock) : stock;
      const parsedCategoryId = categoryId ? (typeof categoryId === 'string' ? parseInt(categoryId) : categoryId) : null;

      // จัดการค่า popular
      let isPopular = false;
      if (popular === true || popular === 'true' || popular === 1 || popular === '1' || popular === 'on') {
        isPopular = true;
      }

      console.log('🔧 Processed data:', {
        name,
        price: parsedPrice,
        stock: parsedStock,
        categoryId: parsedCategoryId,
        has_special_shipping,
        special_shipping_base,
        special_shipping_qty,
        special_shipping_extra
      });

      // สร้างสินค้าใหม่
      const newProduct = await prisma.product.create({
        data: {
          name,
          description: description || null,
          price: parsedPrice,
          stock: parsedStock,
          image_url: image_url || null,
          image_url_two: image_url_two || null,
          image_url_three: image_url_three || null,
          image_url_four: image_url_four || null,
          is_popular: isPopular,
          
          // การตั้งค่าการจัดส่งปกติ
          shipping_cost_bangkok: has_special_shipping ? null : (shipping_cost_bangkok !== undefined ? parseFloat(shipping_cost_bangkok) : 0),
          shipping_cost_provinces: has_special_shipping ? null : (shipping_cost_provinces !== undefined ? parseFloat(shipping_cost_provinces) : 50),
          shipping_cost_remote: has_special_shipping ? null : (shipping_cost_remote !== undefined ? parseFloat(shipping_cost_remote) : 100),
          free_shipping_threshold: free_shipping_threshold ? parseFloat(free_shipping_threshold) : null,
          delivery_time: delivery_time || '2-3 วัน',
          shipping_notes: shipping_notes || null,
          special_handling: special_handling || false,
          
          // 🐠 การตั้งค่าการจัดส่งพิเศษ
          has_special_shipping: has_special_shipping || false,
          special_shipping_base: has_special_shipping ? parseFloat(special_shipping_base) : null,
          special_shipping_qty: has_special_shipping ? parseInt(special_shipping_qty) : null,
          special_shipping_extra: has_special_shipping ? parseFloat(special_shipping_extra) : null,
          special_shipping_notes: has_special_shipping ? special_shipping_notes : null,
          
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      console.log('✅ Product created with ID:', newProduct.id);

      // เชื่อมโยงกับหมวดหมู่ (ถ้ามี)
      if (parsedCategoryId && !isNaN(parsedCategoryId)) {
        try {
          await prisma.product_categories.create({
            data: {
              product_id: newProduct.id,
              category_id: parsedCategoryId
            }
          });
          console.log('✅ Category linked:', parsedCategoryId);
        } catch (categoryError) {
          console.error('⚠️ Failed to link category:', categoryError);
          // ไม่ให้ fail ทั้งหมดถ้าเชื่อมหมวดหมู่ไม่สำเร็จ
        }
      }

      // ส่งผลลัพธ์กลับ
      res.json({ 
        success: true, 
        id: newProduct.id, 
        message: `เพิ่มสินค้าเรียบร้อยแล้ว ${has_special_shipping ? '(รวมการตั้งค่าการจัดส่งพิเศษ)' : '(รวมการตั้งค่าการจัดส่ง)'}`,
        product: {
          ...newProduct,
          price: Number(newProduct.price), // แปลง Decimal เป็น Number
          shipping_cost_bangkok: newProduct.shipping_cost_bangkok ? Number(newProduct.shipping_cost_bangkok) : null,
          shipping_cost_provinces: newProduct.shipping_cost_provinces ? Number(newProduct.shipping_cost_provinces) : null,
          shipping_cost_remote: newProduct.shipping_cost_remote ? Number(newProduct.shipping_cost_remote) : null,
          special_shipping_base: newProduct.special_shipping_base ? Number(newProduct.special_shipping_base) : null,
          special_shipping_extra: newProduct.special_shipping_extra ? Number(newProduct.special_shipping_extra) : null,
          free_shipping_threshold: newProduct.free_shipping_threshold ? Number(newProduct.free_shipping_threshold) : null
        }
      });

    } catch (error) {
      console.error('❌ Error creating product:', error);
      
      // จัดการ error ต่างๆ
      if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'P2002') {
        return res.status(400).json({ 
          success: false, 
          error: 'ชื่อสินค้าซ้ำ กรุณาใช้ชื่ออื่น' 
        });
      }
      
      if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'P2003') {
        return res.status(400).json({ 
          success: false, 
          error: 'หมวดหมู่ที่เลือกไม่มีอยู่ในระบบ' 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: 'ไม่สามารถสร้างสินค้าได้: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  })().catch(next);
});

// const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload', handleFileUploadWithBusboy, (req: Request, res: Response, next) => {
  (async () => {
    try {
      const files = (req as any).files as any[];
      
      console.log('Upload request received');
      console.log('Number of files:', files?.length || 0);
      console.log('Supabase URL:', process.env.SUPABASE_URL);
      console.log('Supabase Bucket:', process.env.SUPABASE_BUCKET);
      
      if (!files || files.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No files uploaded' 
        });
      }

      // ตรวจสอบ environment variables
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_BUCKET) {
        console.error('Missing Supabase environment variables');
        return res.status(500).json({ 
          success: false, 
          error: 'Server configuration error: Missing Supabase credentials' 
        });
      }

      // ตรวจสอบและสร้าง bucket ถ้าจำเป็น
      const bucketReady = await ensureBucketExists(process.env.SUPABASE_BUCKET);
      if (!bucketReady) {
        console.warn('Bucket ensure reported false; attempting upload anyway');
      }

      const urls: string[] = [];
      
      for (const file of files) {
        try {
          console.log('Processing file:', file.originalname, 'Size:', file.size, 'Type:', file.mimetype);
          
          // ตรวจสอบ file type
          if (!file.mimetype.startsWith('image/')) {
            throw new Error(`Invalid file type: ${file.mimetype}. Only images are allowed.`);
          }

          // ตรวจสอบ file size (5MB limit)
          if (file.size > 5 * 1024 * 1024) {
            throw new Error(`File too large: ${file.size} bytes. Maximum size is 5MB.`);
          }
          
          const fileExt = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
          
          console.log('Uploading to bucket:', process.env.SUPABASE_BUCKET, 'as', fileName);
          
          const { data, error } = await supabase
            .storage
            .from(process.env.SUPABASE_BUCKET!)
            .upload(fileName, file.buffer, {
              contentType: file.mimetype,
              upsert: false,
              cacheControl: '3600'
            });

          if (error) {
            console.error('Supabase upload error:', error);
            // Provide actionable message for common auth misconfig
            const msg = (error as any)?.message || '';
            const status = (error as any)?.statusCode || (error as any)?.status;
            if (String(status) === '403' || /signature verification failed/i.test(msg)) {
              throw new Error(
                'Upload failed: Supabase rejected the credentials (signature verification failed). ' +
                'Please verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend, and ensure you are using the Service Role key (not the anon public key).'
              );
            }
            throw new Error(`Upload failed: ${msg || 'Unknown error'}`);
          }

          console.log('Upload successful:', data);

          const { data: publicUrlData } = supabase
            .storage
            .from(process.env.SUPABASE_BUCKET!)
            .getPublicUrl(fileName);

          if (!publicUrlData.publicUrl) {
            throw new Error('Failed to generate public URL');
          }

          console.log('Public URL generated:', publicUrlData.publicUrl);
          urls.push(publicUrlData.publicUrl);
        } catch (fileError: any) {
          console.error('Error processing file:', file.originalname, fileError);
          throw fileError;
        }
      }

      console.log('All files processed successfully. URLs:', urls);
      res.json({ 
        success: true, 
        urls 
      });
    } catch (error: any) {
      console.error('Upload endpoint error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Upload failed',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  })().catch(next);
});

// ลบสินค้า (DELETE /api/products/:id)
app.delete('/api/products/:id', (req: Request, res: Response, next) => {
  (async () => {
    const productId = Number(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ success: false, message: 'รหัสสินค้าไม่ถูกต้อง' });
    }

    // Soft delete: อัปเดต deleted_at แทนการลบจริง
    await prisma.product.update({
      where: { id: productId },
      data: { deleted_at: new Date() }
    });

    res.json({ success: true, message: 'ลบสินค้า (soft delete) เรียบร้อยแล้ว' });
  })().catch(error => {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบสินค้า' });
  });
});



// GET homepage setting
app.get('/api/homepage-setting', async (req: Request, res: Response) => {
  try {
    const setting = await prisma.homepage_setting.findFirst({
      orderBy: { id: 'desc' }
    });
    res.json(setting || {});
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch homepage setting' });
  }
});

// POST/UPDATE homepage setting
app.post('/api/homepage-setting', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    // ถ้ามี record อยู่แล้ว ให้ update, ถ้าไม่มีก็ create
    const existing = await prisma.homepage_setting.findFirst();
    let result;
    if (existing) {
      result = await prisma.homepage_setting.update({
        where: { id: existing.id },
        data
      });
    } else {
      result = await prisma.homepage_setting.create({ data });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save homepage setting' });
  }
});

// GET about setting
app.get('/api/about-setting', async (req: Request, res: Response) => {
  try {
    const setting = await prisma.about_setting.findFirst({
      orderBy: { id: 'desc' }
    });
    res.json(setting || {});
  } catch (error) {
    console.error('Error fetching about setting:', error);
    res.status(500).json({ error: 'Failed to fetch about setting' });
  }
});

// POST/UPDATE about setting
app.post('/api/about-setting', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    // ถ้ามี record อยู่แล้ว ให้ update, ถ้าไม่มีก็ create
    const existing = await prisma.about_setting.findFirst();
    let result;
    if (existing) {
      result = await prisma.about_setting.update({
        where: { id: existing.id },
        data
      });
    } else {
      result = await prisma.about_setting.create({ data });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error saving about setting:', error);
    res.status(500).json({ success: false, error: 'Failed to save about setting' });
  }
});

// API สำหรับดึงคำสั่งซื้อทั้งหมด (สำหรับ Admin)
app.get('/api/admin/orders', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const search = req.query.search as string;
    
    const skip = (page - 1) * limit;
    
    // สร้าง where clause
    const whereClause: any = {};
    if (status && status !== 'all') {
      whereClause.order_status = status;
    }
    if (search) {
      whereClause.OR = [
        { order_number: { contains: search } },
        { users: { name: { contains: search } } },
        { users: { email: { contains: search } } }
      ];
    }
    
    const [orders, totalCount] = await Promise.all([
      prisma.orders.findMany({
        where: whereClause,
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          user_addresses: true,
          order_items: {
            include: {
              products: {
                select: {
                  id: true,
                  name: true,
                  image_url: true
                }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.orders.count({ where: whereClause })
    ]);
    
    // แปลงข้อมูลให้อยู่ในรูปแบบที่ต้องการ
    const formattedOrders = orders.map(order => ({
      id: order.id,
      orderNumber: order.order_number,
      customer: {
        name: order.users?.name || 'ไม่ระบุ',
        email: order.users?.email || 'ไม่ระบุ'
      },
      totalAmount: Number(order.total_amount),
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      orderStatus: order.order_status,
      trackingNumber: order.tracking_number,
      shippingCompany: order.shipping_company,
      items: order.order_items.map(item => ({
        id: item.id,
        productName: item.products?.name || 'ไม่ระบุ',
        quantity: item.quantity,
        price: Number(item.price),
        total: Number(item.total),
        imageUrl: item.products?.image_url
      })),
      shippingAddress: order.user_addresses,
      createdAt: order.created_at,
      updatedAt: order.updated_at
    }));
    
    res.json({
      success: true,
      orders: formattedOrders,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch orders' 
    });
  }
});

// API สำหรับอัพเดทสถานะคำสั่งซื้อ
app.put('/api/admin/orders/:id/status', async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id);
    const { orderStatus, paymentStatus, trackingNumber, shippingCompany } = req.body;
    
    const updateData: any = {
      updated_at: new Date()
    };
    
    if (orderStatus) updateData.order_status = orderStatus;
    if (paymentStatus) updateData.payment_status = paymentStatus;
    if (trackingNumber) updateData.tracking_number = trackingNumber;
    if (shippingCompany) updateData.shipping_company = shippingCompany;
    
    const updatedOrder = await prisma.orders.update({
      where: { id: orderId },
      data: updateData,
      include: {
        users: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });
    
    res.json({
      success: true,
      message: 'อัพเดทสถานะเรียบร้อยแล้ว',
      order: updatedOrder
    });
    
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update order status' 
    });
  }
});

// API สำหรับดูรายละเอียดคำสั่งซื้อ
app.get('/api/admin/orders/:id', async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id);
    
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        user_addresses: true,
        order_items: {
          include: {
            products: {
              select: {
                id: true,
                name: true,
                image_url: true,
                price: true
              }
            }
          }
        },
        payment_proofs: true
      }
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบคำสั่งซื้อที่ระบุ'
      });
    }
    
    res.json({
      success: true,
      order: {
        ...order,
        totalAmount: Number(order.total_amount),
        subtotal: Number(order.subtotal),
        shippingFee: Number(order.shipping_fee),
        discount: Number(order.discount)
      }
    });
    
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch order details' 
    });
  }
});



// API สำหรับดึงข้อมูลสินค้าเพื่อแก้ไข (สำหรับ Admin)
app.get('/api/products/:id/edit', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const productId = parseInt(req.params.id);
      
      if (isNaN(productId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid product ID' 
        });
      }
      
      console.log('🔍 Fetching product for edit, ID:', productId);
      
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          product_categories: {
            include: {
              categories: true
            }
          }
        }
      });
      
      if (!product) {
        return res.status(404).json({ 
          success: false, 
          error: 'Product not found' 
        });
      }
      
      console.log('📦 Raw product data:', {
        id: product.id,
        name: product.name,
        has_special_shipping: product.has_special_shipping,
        shipping_cost_bangkok: product.shipping_cost_bangkok,
        shipping_cost_provinces: product.shipping_cost_provinces,
        shipping_cost_remote: product.shipping_cost_remote,
        special_shipping_base: product.special_shipping_base,
        special_shipping_qty: product.special_shipping_qty,
        special_shipping_extra: product.special_shipping_extra,
        special_shipping_notes: product.special_shipping_notes,
        delivery_time: product.delivery_time,
        shipping_notes: product.shipping_notes,
        special_handling: product.special_handling,
        free_shipping_threshold: product.free_shipping_threshold
      });
      
      // จัดรูปแบบข้อมูลให้เหมาะกับการแก้ไข (รวมข้อมูลการจัดส่งครบถ้วน)
      const formattedProduct = {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        stock: product.stock,
        is_popular: product.is_popular,
        image_url: product.image_url,
        image_url_two: product.image_url_two,
        image_url_three: product.image_url_three,
        image_url_four: product.image_url_four,
        category: product.product_categories[0]?.categories || null,
        created_at: product.created_at,
        
        // 🚚 ข้อมูลการจัดส่งปกติ - ตรวจสอบ null/undefined
        shipping_cost_bangkok: product.shipping_cost_bangkok !== null ? Number(product.shipping_cost_bangkok) : 0,
        shipping_cost_provinces: product.shipping_cost_provinces !== null ? Number(product.shipping_cost_provinces) : 50,
        shipping_cost_remote: product.shipping_cost_remote !== null ? Number(product.shipping_cost_remote) : 100,
        free_shipping_threshold: product.free_shipping_threshold !== null ? Number(product.free_shipping_threshold) : null,
        delivery_time: product.delivery_time || '2-3 วัน',
        shipping_notes: product.shipping_notes || null,
        special_handling: Boolean(product.special_handling),
        
        // 🐠 ข้อมูลการจัดส่งพิเศษ - ตรวจสอบ null/undefined
        has_special_shipping: Boolean(product.has_special_shipping),
        special_shipping_base: product.special_shipping_base !== null ? Number(product.special_shipping_base) : 80,
        special_shipping_qty: product.special_shipping_qty || 4,
        special_shipping_extra: product.special_shipping_extra !== null ? Number(product.special_shipping_extra) : 10,
        special_shipping_notes: product.special_shipping_notes || null
      };
      
      console.log('✅ Formatted product data for edit:', formattedProduct);
      
      res.json({
        success: true,
        product: formattedProduct
      });
      
    } catch (error) {
      console.error('❌ Error fetching product for edit:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch product' 
      });
    }
  })().catch(next);
});
// API สำหรับอัพเดทสินค้า
// แทนที่ API PUT /api/products/:id ที่มีอยู่
app.put('/api/products/:id', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const productId = parseInt(req.params.id);
      const { 
        name, 
        description, 
        price, 
        stock, 
        popular, 
        images, 
        categoryId,
        
        // ข้อมูลการจัดส่งพื้นฐาน
        delivery_time,
        shipping_notes,
        special_handling,
        free_shipping_threshold,
        
        // ข้อมูลการจัดส่งปกติ
        shipping_cost_bangkok,
        shipping_cost_provinces,
        shipping_cost_remote,
        
        // ข้อมูลการจัดส่งพิเศษ
        has_special_shipping,
        special_shipping_base,
        special_shipping_qty,
        special_shipping_extra,
        special_shipping_notes
      } = req.body;
      
      if (isNaN(productId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid product ID' 
        });
      }
      
      // ตรวจสอบว่าสินค้ามีอยู่จริง
      const existingProduct = await prisma.product.findUnique({
        where: { id: productId }
      });
      
      if (!existingProduct) {
        return res.status(404).json({ 
          success: false, 
          error: 'Product not found' 
        });
      }
      
      // ตรวจสอบข้อมูลที่จำเป็น
      if (!name || !description || price === undefined || stock === undefined) {
        return res.status(400).json({ 
          success: false, 
          error: 'ข้อมูลไม่ครบถ้วน กรุณาใส่ชื่อสินค้า คำอธิบาย ราคา และจำนวนสินค้า' 
        });
      }
      
      // จัดการรูปภาพ
      const [image_url, image_url_two, image_url_three, image_url_four] = images || [];
      
      // แปลงข้อมูล
      const parsedPrice = typeof price === 'string' ? parseFloat(price) : price;
      const parsedStock = typeof stock === 'string' ? parseInt(stock) : stock;
      
      let isPopular = false;
      if (popular === true || popular === 'true' || popular === 1 || popular === '1' || popular === 'on') {
        isPopular = true;
      }
      
      // เตรียมข้อมูลสำหรับอัปเดต (รวมการจัดส่ง)
      const updateData: any = {
        name,
        description,
        price: parsedPrice,
        stock: parsedStock,
        is_popular: isPopular,
        
        // อัปเดตรูปภาพ (ถ้ามี)
        image_url: image_url || existingProduct.image_url,
        image_url_two: image_url_two || existingProduct.image_url_two,
        image_url_three: image_url_three || existingProduct.image_url_three,
        image_url_four: image_url_four || existingProduct.image_url_four,
        
        // ข้อมูลการจัดส่งพื้นฐาน
        delivery_time: delivery_time || '2-3 วัน',
        shipping_notes: shipping_notes || null,
        special_handling: special_handling || false,
        free_shipping_threshold: free_shipping_threshold ? parseFloat(free_shipping_threshold) : null,
        
        // ข้อมูลการจัดส่งพิเศษ
        has_special_shipping: has_special_shipping || false,
        
        updated_at: new Date()
      };
      
      // เพิ่มข้อมูลการจัดส่งตามประเภท
      if (has_special_shipping) {
        // การจัดส่งพิเศษ
        updateData.special_shipping_base = special_shipping_base ? parseFloat(special_shipping_base) : null;
        updateData.special_shipping_qty = special_shipping_qty ? parseInt(special_shipping_qty) : null;
        updateData.special_shipping_extra = special_shipping_extra ? parseFloat(special_shipping_extra) : null;
        updateData.special_shipping_notes = special_shipping_notes || null;
        
        // เคลียร์ข้อมูลการจัดส่งปกติ
        updateData.shipping_cost_bangkok = null;
        updateData.shipping_cost_provinces = null;
        updateData.shipping_cost_remote = null;
      } else {
        // การจัดส่งปกติ
        updateData.shipping_cost_bangkok = shipping_cost_bangkok ? parseFloat(shipping_cost_bangkok) : 0;
        updateData.shipping_cost_provinces = shipping_cost_provinces ? parseFloat(shipping_cost_provinces) : 50;
        updateData.shipping_cost_remote = shipping_cost_remote ? parseFloat(shipping_cost_remote) : 100;
        
        // เคลียร์ข้อมูลการจัดส่งพิเศษ
        updateData.special_shipping_base = null;
        updateData.special_shipping_qty = null;
        updateData.special_shipping_extra = null;
        updateData.special_shipping_notes = null;
      }
      
      // อัพเดทข้อมูลสินค้า
      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: updateData
      });
      
      // อัพเดทหมวดหมู่ (ถ้ามีการเปลี่ยนแปลง)
      if (categoryId) {
        // ลบหมวดหมู่เก่า
        await prisma.product_categories.deleteMany({
          where: { product_id: productId }
        });
        
        // เพิ่มหมวดหมู่ใหม่
        await prisma.product_categories.create({
          data: {
            product_id: productId,
            category_id: parseInt(categoryId)
          }
        });
      }
      
      console.log('✅ Product updated with shipping data:', updatedProduct.id);
      
      res.json({
        success: true,
        message: 'อัพเดทสินค้าเรียบร้อยแล้ว (รวมการตั้งค่าการจัดส่ง)',
        product: updatedProduct
      });
      
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update product' 
      });
    }
  })().catch(next);
});

// ===========================================
// CUSTOMER MANAGEMENT APIs
// ===========================================

// API สำหรับดึงรายชื่อลูกค้าทั้งหมด (Admin)
app.get('/api/admin/customers', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string || '';
      const sortBy = req.query.sortBy as string || 'created_at';
      const sortOrder = req.query.sortOrder as string || 'desc';
      
      const skip = (page - 1) * limit;
      
      // สร้าง where condition สำหรับการค้นหา
      const whereCondition: any = {};
      
      if (search) {
        whereCondition.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } }
        ];
      }
      
      // ดึงข้อมูลลูกค้าพร้อม pagination
      const [customers, totalCount] = await Promise.all([
        prisma.users.findMany({
          where: whereCondition,
          skip: skip,
          take: limit,
          orderBy: {
            [sortBy]: sortOrder
          },
          include: {
            orders: {
              select: {
                id: true,
                total_amount: true,
                order_status: true,
                created_at: true
              },
              orderBy: {
                created_at: 'desc'
              }
            },
            user_addresses: {
              where: {
                is_default: true
              },
              take: 1
            }
          }
        }),
        prisma.users.count({
          where: whereCondition
        })
      ]);
      
      // จัดรูปแบบข้อมูล
      const formattedCustomers = customers.map(customer => {
        const totalOrders = customer.orders.length;
        const totalSpent = customer.orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
        const lastOrder = customer.orders[0];
        const defaultAddress = customer.user_addresses[0];
        
        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          created_at: customer.created_at,
          updated_at: customer.updated_at,
          role: customer.role,
          is_active: customer.is_active,
          avatar: customer.avatar,
          last_login: customer.last_login,
          auth_provider: customer.auth_provider,
          is_email_verified: customer.is_email_verified,
          // สถิติ
          total_orders: totalOrders,
          total_spent: totalSpent,
          last_order_date: lastOrder?.created_at || null,
          last_order_status: lastOrder?.order_status || null,
          // ที่อยู่
          default_address: defaultAddress ? {
            name: defaultAddress.name,
            phone: defaultAddress.phone,
            address_line1: defaultAddress.address_line1,
            address_line2: defaultAddress.address_line2,
            district: defaultAddress.district,
            city: defaultAddress.city,
            province: defaultAddress.province,
            postal_code: defaultAddress.postal_code
          } : null
        };
      });
      
      const totalPages = Math.ceil(totalCount / limit);
      
      res.json({
        success: true,
        data: formattedCustomers,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_count: totalCount,
          limit: limit,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      });
      
    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch customers' 
      });
    }
  })().catch(next);
});

// API สำหรับดึงข้อมูลลูกค้าแค่คนเดียว (Admin)
app.get('/api/admin/customers/:id', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const customerId = parseInt(req.params.id);
      
      if (isNaN(customerId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid customer ID' 
        });
      }
      
      const customer = await prisma.users.findUnique({
        where: { id: customerId },
        include: {
          orders: {
            include: {
              order_items: {
                include: {
                  products: {
                    select: {
                      id: true,
                      name: true,
                      image_url: true
                    }
                  }
                }
              }
            },
            orderBy: {
              created_at: 'desc'
            }
          },
          user_addresses: {
            orderBy: {
              is_default: 'desc'
            }
          }
        }
      });
      
      if (!customer) {
        return res.status(404).json({ 
          success: false, 
          error: 'Customer not found' 
        });
      }
      
      // คำนวณสถิติ
      const totalOrders = customer.orders.length;
      const totalSpent = customer.orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
      const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
      
      // สถิติตามสถานะ
      const ordersByStatus = customer.orders.reduce((acc, order) => {
        acc[order.order_status] = (acc[order.order_status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // สินค้าที่ซื้อบ่อย
      const productPurchases = customer.orders.flatMap(order => 
        order.order_items.map(item => ({
          product_id: item.product_id,
          product_name: item.products?.name || 'Unknown',
          quantity: item.quantity,
          image_url: item.products?.image_url
        }))
      );
      
      const productStats = productPurchases.reduce((acc, purchase) => {
        const key = purchase.product_id;
        if (!acc[key]) {
          acc[key] = {
            product_id: purchase.product_id,
            product_name: purchase.product_name,
            image_url: purchase.image_url,
            total_quantity: 0,
            purchase_count: 0
          };
        }
        acc[key].total_quantity += purchase.quantity;
        acc[key].purchase_count += 1;
        return acc;
      }, {} as Record<string, any>);
      
      const topProducts = Object.values(productStats)
        .sort((a: any, b: any) => b.total_quantity - a.total_quantity)
        .slice(0, 5);
      
      const formattedCustomer = {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        role: customer.role,
        is_active: customer.is_active,
        avatar: customer.avatar,
        is_email_verified: customer.is_email_verified,
        auth_provider: customer.auth_provider,
        last_login: customer.last_login,
        created_at: customer.created_at,
        updated_at: customer.updated_at,
        login_attempts: customer.login_attempts,
        last_failed_login: customer.last_failed_login,
        account_locked_until: customer.account_locked_until,
        // สถิติ
        statistics: {
          total_orders: totalOrders,
          total_spent: totalSpent,
          average_order_value: avgOrderValue,
          orders_by_status: ordersByStatus,
          first_order_date: customer.orders[customer.orders.length - 1]?.created_at || null,
          last_order_date: customer.orders[0]?.created_at || null
        },
        // ประวัติคำสั่งซื้อ
        orders: customer.orders.map(order => ({
          id: order.id,
          order_number: order.order_number,
          total_amount: Number(order.total_amount),
          subtotal: Number(order.subtotal),
          shipping_fee: Number(order.shipping_fee),
          discount: Number(order.discount),
          order_status: order.order_status,
          payment_status: order.payment_status,
          payment_method: order.payment_method,
          created_at: order.created_at,
          tracking_number: order.tracking_number,
          shipping_company: order.shipping_company,
          estimated_delivery: order.estimated_delivery,
          items_count: order.order_items.length,
          items: order.order_items.map(item => ({
            product_name: item.products?.name || 'Unknown',
            quantity: item.quantity,
            price: Number(item.price),
            total: Number(item.total)
          }))
        })),
        // ที่อยู่
        addresses: customer.user_addresses.map(addr => ({
          id: addr.id,
          name: addr.name,
          phone: addr.phone,
          address_line1: addr.address_line1,
          address_line2: addr.address_line2,
          district: addr.district,
          city: addr.city,
          province: addr.province,
          postal_code: addr.postal_code,
          is_default: addr.is_default,
          full_address: `${addr.address_line1}${addr.address_line2 ? ' ' + addr.address_line2 : ''} ${addr.district} ${addr.city} ${addr.province} ${addr.postal_code}`
        })),
        // สินค้าที่ซื้อบ่อย
        favorite_products: topProducts
      };
      
      res.json({
        success: true,
        data: formattedCustomer
      });
      
    } catch (error) {
      console.error('Error fetching customer details:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch customer details' 
      });
    }
  })().catch(next);
});

// API สำหรับอัพเดทสถานะลูกค้า (Admin)
app.put('/api/admin/customers/:id/status', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const customerId = parseInt(req.params.id);
      const { is_active } = req.body;
      
      if (isNaN(customerId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid customer ID' 
        });
      }
      
      if (typeof is_active !== 'boolean') {
        return res.status(400).json({ 
          success: false, 
          error: 'is_active must be boolean' 
        });
      }
      
      const updatedCustomer = await prisma.users.update({
        where: { id: customerId },
        data: { 
          is_active: is_active,
          updated_at: new Date()
        }
      });
      
      res.json({
        success: true,
        message: `Customer ${is_active ? 'activated' : 'deactivated'} successfully`,
        data: {
          id: updatedCustomer.id,
          is_active: updatedCustomer.is_active
        }
      });
      
    } catch (error) {
      console.error('Error updating customer status:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update customer status' 
      });
    }
  })().catch(next);
});

// API สำหรับลบลูกค้า (Admin) - Soft delete
app.delete('/api/admin/customers/:id', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const customerId = parseInt(req.params.id);
      
      if (isNaN(customerId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid customer ID' 
        });
      }
      
      // ตรวจสอบว่าลูกค้ามีคำสั่งซื้อหรือไม่
      const customerWithOrders = await prisma.users.findUnique({
        where: { id: customerId },
        include: {
          orders: {
            select: { id: true }
          }
        }
      });
      
      if (!customerWithOrders) {
        return res.status(404).json({ 
          success: false, 
          error: 'Customer not found' 
        });
      }
      
      if (customerWithOrders.orders.length > 0) {
        // ถ้ามีคำสั่งซื้อ ทำ soft delete (deactivate)
        await prisma.users.update({
          where: { id: customerId },
          data: { 
            is_active: false,
            updated_at: new Date()
          }
        });
        
        res.json({
          success: true,
          message: 'Customer deactivated (has existing orders)',
          type: 'deactivated'
        });
      } else {
        // ถ้าไม่มีคำสั่งซื้อ สามารถลบได้
        await prisma.users.delete({
          where: { id: customerId }
        });
        
        res.json({
          success: true,
          message: 'Customer deleted successfully',
          type: 'deleted'
        });
      }
      
    } catch (error) {
      console.error('Error deleting customer:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to delete customer' 
      });
    }
  })().catch(next);
});

// API สำหรับสถิติลูกค้า (Admin Dashboard)
app.get('/api/admin/customers/stats', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const [
        totalCustomers,
        activeCustomers,
        newCustomersThisMonth,
        topCustomers
      ] = await Promise.all([
        // จำนวนลูกค้าทั้งหมด
        prisma.users.count(),
        
        // จำนวนลูกค้าที่ใช้งานอยู่
        prisma.users.count({
          where: { is_active: true }
        }),
        
        // ลูกค้าใหม่เดือนนี้
        prisma.users.count({
          where: {
            created_at: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          }
        }),
        
        // ลูกค้าที่ซื้อมากที่สุด (Top 10)
        prisma.users.findMany({
          include: {
            orders: {
              select: {
                total_amount: true
              }
            }
          },
          take: 10
        })
      ]);
      
      // คำนวณลูกค้าที่ซื้อมากที่สุด
      const customersWithSpending = topCustomers.map(customer => {
        const totalSpent = customer.orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          total_spent: totalSpent,
          total_orders: customer.orders.length
        };
      }).sort((a, b) => b.total_spent - a.total_spent);
      
      res.json({
        success: true,
        data: {
          total_customers: totalCustomers,
          active_customers: activeCustomers,
          inactive_customers: totalCustomers - activeCustomers,
          new_customers_this_month: newCustomersThisMonth,
          top_customers: customersWithSpending
        }
      });
      
    } catch (error) {
      console.error('Error fetching customer stats:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch customer statistics' 
      });
    }
  })().catch(next);
});

// ===========================================
// ANALYTICS & REPORTS APIs
// ===========================================

// API สำหรับสถิติยอดขายรายวัน/เดือน/ปี
app.get('/api/admin/analytics/sales', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const period = req.query.period as string || 'month'; // day, week, month, year
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      let dateFilter: any = {};
      const now = new Date();
      
      // กำหนดช่วงเวลาตาม period
      switch (period) {
        case 'day':
          dateFilter = {
            created_at: {
              gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
              lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
            }
          };
          break;
        case 'week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - 7);
          dateFilter = {
            created_at: {
              gte: weekStart,
              lt: new Date()
            }
          };
          break;
        case 'month':
          dateFilter = {
            created_at: {
              gte: new Date(now.getFullYear(), now.getMonth(), 1),
              lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
            }
          };
          break;
        case 'year':
          dateFilter = {
            created_at: {
              gte: new Date(now.getFullYear(), 0, 1),
              lt: new Date(now.getFullYear() + 1, 0, 1)
            }
          };
          break;
        case 'custom':
          if (startDate && endDate) {
            dateFilter = {
              created_at: {
                gte: new Date(startDate),
                lt: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000)
              }
            };
          }
          break;
      }
      
      // ดึงข้อมูลยอดขาย (ใช้ข้อมูลจริงจาก Prisma)
      const [ordersCount, totalRevenue, avgOrderValue] = await Promise.all([
        // จำนวนคำสั่งซื้อในช่วงเวลาที่เลือก
        prisma.orders.count({
          where: {
            payment_status: 'paid',
            ...dateFilter
          }
        }),
        
        // รายได้รวมในช่วงเวลาที่เลือก
        prisma.orders.aggregate({
          where: {
            payment_status: 'paid',
            ...dateFilter
          },
          _sum: {
            total_amount: true
          }
        }),
        
        // ค่าเฉลี่ยต่อออเดอร์
        prisma.orders.aggregate({
          where: {
            payment_status: 'paid',
            ...dateFilter
          },
          _avg: {
            total_amount: true
          }
        })
      ]);
      
      // สร้าง daily sales data (mock สำหรับการทดสอบ)
      const dailySales = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dailySales.push({
          date: date.toISOString().split('T')[0],
          orders_count: Math.floor(Math.random() * 20) + 5,
          total_sales: Math.floor(Math.random() * 50000) + 10000,
          avg_order_value: Math.floor(Math.random() * 3000) + 500
        });
      }
      
      // เปรียบเทียบกับช่วงเวลาก่อนหน้า
      let previousPeriodFilter: any = {};
      if (dateFilter.created_at) {
        const periodMs = new Date(dateFilter.created_at.lt).getTime() - new Date(dateFilter.created_at.gte).getTime();
        
        previousPeriodFilter = {
          created_at: {
            gte: new Date(new Date(dateFilter.created_at.gte).getTime() - periodMs),
            lt: dateFilter.created_at.gte
          }
        };
      }
      
      const [previousRevenue, previousOrders] = await Promise.all([
        prisma.orders.aggregate({
          where: {
            payment_status: 'paid',
            ...previousPeriodFilter
          },
          _sum: {
            total_amount: true
          }
        }),
        
        prisma.orders.count({
          where: {
            payment_status: 'paid',
            ...previousPeriodFilter
          }
        })
      ]);
      
      // คำนวณอัตราการเติบโต
      const currentRevenue = Number(totalRevenue._sum.total_amount) || 0;
      const prevRevenue = Number(previousRevenue._sum.total_amount) || 0;
      const revenueGrowth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;
      
      const ordersGrowth = previousOrders > 0 ? ((ordersCount - previousOrders) / previousOrders) * 100 : 0;
      
      res.json({
        success: true,
        data: {
          period,
          current_period: {
            total_revenue: currentRevenue,
            total_orders: ordersCount,
            avg_order_value: Number(avgOrderValue._avg.total_amount) || 0,
            revenue_growth: revenueGrowth,
            orders_growth: ordersGrowth
          },
          daily_sales: dailySales
        }
      });
      
    } catch (error) {
      console.error('Error fetching sales analytics:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch sales analytics' 
      });
    }
  })().catch(next);
});

// API สำหรับสถิติสินค้า
app.get('/api/admin/analytics/products', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const period = req.query.period as string || 'month';
      const limit = parseInt(req.query.limit as string) || 10;
      
      // กำหนดช่วงเวลา
      let dateFilter: any = {};
      const now = new Date();
      
      switch (period) {
        case 'week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - 7);
          dateFilter = { created_at: { gte: weekStart } };
          break;
        case 'month':
          dateFilter = {
            created_at: {
              gte: new Date(now.getFullYear(), now.getMonth(), 1)
            }
          };
          break;
        case 'year':
          dateFilter = {
            created_at: {
              gte: new Date(now.getFullYear(), 0, 1)
            }
          };
          break;
      }
        // สินค้าขายดี
      const topSellingProducts = await prisma.$queryRaw`
        SELECT 
          p.id,
          p.name,
          p.image_url,
          p.price::numeric,
          p.stock,
          SUM(oi.quantity)::integer as total_sold,
          SUM(oi.total)::numeric as total_revenue,
          COUNT(DISTINCT o.id)::integer as orders_count
        FROM products p
        INNER JOIN order_items oi ON p.id = oi.product_id
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE o.payment_status = 'paid'
          ${period !== 'all' ? `AND o.created_at >= NOW() - INTERVAL '30 days'` : ''}
        GROUP BY p.id, p.name, p.image_url, p.price, p.stock
        ORDER BY total_sold DESC
        LIMIT ${limit}
      `;
      
      // สินค้าขายไม่ดี (มีสต็อกแต่ขายน้อย)
      const poorSellingProducts = await prisma.$queryRaw`
        SELECT 
          p.id,
          p.name,
          p.image_url,
          p.price::numeric,
          p.stock,
          COALESCE(SUM(oi.quantity), 0)::integer as total_sold,
          COALESCE(SUM(oi.total), 0)::numeric as total_revenue
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id AND o.payment_status = 'paid'
          ${period !== 'all' ? `AND o.created_at >= NOW() - INTERVAL '30 days'` : ''}
        WHERE p.stock > 0
        GROUP BY p.id, p.name, p.image_url, p.price, p.stock
        ORDER BY total_sold ASC, p.stock DESC
        LIMIT ${limit}
      `;
      
      // สถิติสินค้าทั่วไป
      const [totalProducts, activeProducts, outOfStockProducts, lowStockProducts] = await Promise.all([
        prisma.product.count(),
        prisma.product.count({ where: { stock: { gt: 0 } } }),
        prisma.product.count({ where: { stock: 0 } }),
        prisma.product.count({ where: { stock: { gt: 0, lte: 5 } } })
      ]);
        // สินค้าตามหมวดหมู่
      const categoryStats = await prisma.$queryRaw`
        SELECT 
          c.name as category_name,
          COUNT(p.id)::integer as products_count,
          SUM(p.stock)::integer as total_stock,
          COALESCE(SUM(oi.quantity), 0)::integer as total_sold
        FROM categories c
        LEFT JOIN product_categories pc ON c.id = pc.category_id
        LEFT JOIN products p ON pc.product_id = p.id
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id AND o.payment_status = 'paid'
          ${period !== 'all' ? `AND o.created_at >= NOW() - INTERVAL '30 days'` : ''}
        GROUP BY c.id, c.name
        ORDER BY total_sold DESC
      `;
      
      res.json({
        success: true,
        data: {
          overview: {
            total_products: totalProducts,
            active_products: activeProducts,
            out_of_stock: outOfStockProducts,
            low_stock: lowStockProducts,
            stock_turnover_rate: activeProducts > 0 ? (outOfStockProducts / activeProducts * 100) : 0
          },
          top_selling: (topSellingProducts as any[]).map(product => ({
            id: product.id,
            name: product.name,
            image_url: product.image_url,
            price: Number(product.price),
            stock: product.stock,
            total_sold: Number(product.total_sold),
            total_revenue: Number(product.total_revenue),
            orders_count: Number(product.orders_count)
          })),
          poor_selling: (poorSellingProducts as any[]).map(product => ({
            id: product.id,
            name: product.name,
            image_url: product.image_url,
            price: Number(product.price),
            stock: product.stock,
            total_sold: Number(product.total_sold),
            total_revenue: Number(product.total_revenue)
          })),
          by_category: (categoryStats as any[]).map(cat => ({
            category_name: cat.category_name,
            products_count: Number(cat.products_count),
            total_stock: Number(cat.total_stock),
            total_sold: Number(cat.total_sold)
          }))
        }
      });
      
    } catch (error) {
      console.error('Error fetching products analytics:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch products analytics' 
      });
    }
  })().catch(next);
});

// API สำหรับสถิติลูกค้า
app.get('/api/admin/analytics/customers', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const period = req.query.period as string || 'month';
      
      // กำหนดช่วงเวลา
      let dateFilter: any = {};
      const now = new Date();
      
      switch (period) {
        case 'week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - 7);
          dateFilter = { created_at: { gte: weekStart } };
          break;
        case 'month':
          dateFilter = {
            created_at: {
              gte: new Date(now.getFullYear(), now.getMonth(), 1)
            }
          };
          break;
        case 'year':
          dateFilter = {
            created_at: {
              gte: new Date(now.getFullYear(), 0, 1)
            }
          };
          break;
      }
        // สถิติลูกค้าทั่วไป
      const [
        totalCustomers,
        newCustomers,
        activeCustomers
      ] = await Promise.all([
        prisma.users.count(),
        prisma.users.count({ where: dateFilter }),
        prisma.users.count({ 
          where: { 
            orders: { 
              some: { 
                payment_status: 'paid',
                ...dateFilter 
              } 
            } 
          } 
        })
      ]);
      
      // ลูกค้าที่กลับมาซื้อซ้ำ - ใช้ Raw SQL เพื่อหา users ที่มี orders > 1
      const returningCustomersResult = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT u.id)::integer as count
        FROM users u
        WHERE u.id IN (
          SELECT o.user_id 
          FROM orders o 
          WHERE o.payment_status = 'paid'
          GROUP BY o.user_id 
          HAVING COUNT(o.id) > 1
        )
      `;
      
      const returningCustomers = returningCustomersResult[0]?.count || 0;
        // ลูกค้าที่ซื้อมากที่สุด
      const topCustomers = await prisma.$queryRaw`
        SELECT 
          u.id,
          u.name,
          u.email,
          COUNT(o.id)::integer as total_orders,
          SUM(o.total_amount)::numeric as total_spent,
          AVG(o.total_amount)::numeric as avg_order_value,
          MAX(o.created_at) as last_order_date
        FROM users u
        INNER JOIN orders o ON u.id = o.user_id
        WHERE o.payment_status = 'paid'
          ${period !== 'all' ? `AND o.created_at >= NOW() - INTERVAL '30 days'` : ''}
        GROUP BY u.id, u.name, u.email
        ORDER BY total_spent DESC
        LIMIT 10
      `;
        // การเติบโตของลูกค้าใหม่รายเดือน
      const customerGrowth = await prisma.$queryRaw`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*)::integer as new_customers
        FROM users 
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month DESC
      `;
      
      // สถิติพฤติกรรมลูกค้า
      const behaviorStats = await prisma.$queryRaw`
        SELECT 
          CASE 
            WHEN order_count = 1 THEN 'One-time'
            WHEN order_count BETWEEN 2 AND 5 THEN 'Regular'
            WHEN order_count > 5 THEN 'Loyal'
          END as customer_type,
          COUNT(*) as customer_count,
          AVG(total_spent) as avg_spending
        FROM (
          SELECT 
            u.id,
            COUNT(o.id) as order_count,
            SUM(o.total_amount) as total_spent
          FROM users u
          LEFT JOIN orders o ON u.id = o.user_id AND o.payment_status = 'paid'
          GROUP BY u.id
          HAVING order_count > 0
        ) customer_summary
        GROUP BY customer_type
        ORDER BY customer_count DESC
      `;
      
      res.json({
        success: true,
        data: {
          overview: {
            total_customers: totalCustomers,
            new_customers: newCustomers,
            active_customers: activeCustomers,
            returning_customers: returningCustomers,
            retention_rate: totalCustomers > 0 ? (returningCustomers / totalCustomers * 100) : 0
          },
          top_customers: (topCustomers as any[]).map(customer => ({
            id: customer.id,
            name: customer.name,
            email: customer.email,
            total_orders: Number(customer.total_orders),
            total_spent: Number(customer.total_spent),
            avg_order_value: Number(customer.avg_order_value),
            last_order_date: customer.last_order_date
          })),
          growth_trend: (customerGrowth as any[]).map(item => ({
            month: item.month,
            new_customers: Number(item.new_customers)
          })),
          behavior_analysis: (behaviorStats as any[]).map(stat => ({
            customer_type: stat.customer_type,
            customer_count: Number(stat.customer_count),
            avg_spending: Number(stat.avg_spending)
          }))
        }
      });
      
    } catch (error) {
      console.error('Error fetching customers analytics:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch customers analytics' 
      });
    }
  })().catch(next);
});

// API สำหรับรายงานสต็อก
app.get('/api/admin/analytics/inventory', (req: Request, res: Response, next) => {
  (async () => {
    try {
      // สินค้าหมด/ใกล้หมด
      const [outOfStock, lowStock, overstocked] = await Promise.all([
        prisma.product.findMany({
          where: { stock: 0 },
          select: {
            id: true,
            name: true,
            image_url: true,
            price: true,
            stock: true
          }
        }),
        
        prisma.product.findMany({
          where: { 
            stock: { gt: 0, lte: 5 } 
          },
          select: {
            id: true,
            name: true,
            image_url: true,
            price: true,
            stock: true
          }
        }),
        
        prisma.product.findMany({
          where: { stock: { gte: 100 } },
          select: {
            id: true,
            name: true,
            image_url: true,
            price: true,
            stock: true
          }
        })
      ]);
      
      // มูลค่าสต็อกรวม
      const inventoryValue = await prisma.product.aggregate({
        _sum: {
          stock: true
        }
      });
      
      const totalInventoryValue = await prisma.$queryRaw`
        SELECT SUM(price * stock) as total_value
        FROM products
        WHERE stock > 0
      `;
        // สถิติการหมุนเวียนสต็อก
      const stockTurnover = await prisma.$queryRaw`
        SELECT 
          p.id,
          p.name,
          p.stock,
          COALESCE(SUM(oi.quantity), 0)::integer as total_sold,
          CASE 
            WHEN p.stock > 0 THEN COALESCE(SUM(oi.quantity), 0)::numeric / p.stock
            ELSE 0
          END as turnover_ratio
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id 
          AND o.payment_status = 'paid'
          AND o.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY p.id, p.name, p.stock
        HAVING p.stock > 0
        ORDER BY turnover_ratio DESC
        LIMIT 20
      `;
      
      res.json({
        success: true,
        data: {
          overview: {
            total_products: await prisma.product.count(),
            out_of_stock_count: outOfStock.length,
            low_stock_count: lowStock.length,
            overstocked_count: overstocked.length,
            total_stock_units: Number(inventoryValue._sum.stock) || 0,
            total_inventory_value: Number((totalInventoryValue as any[])[0]?.total_value) || 0
          },
          alerts: {
            out_of_stock: outOfStock,
            low_stock: lowStock,
            overstocked: overstocked
          },
          turnover_analysis: (stockTurnover as any[]).map(item => ({
            id: item.id,
            name: item.name,
            current_stock: item.stock,
            total_sold: Number(item.total_sold),
            turnover_ratio: Number(item.turnover_ratio)
          }))
        }
      });
      
    } catch (error) {
      console.error('Error fetching inventory analytics:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch inventory analytics' 
      });
    }
  })().catch(next);
});

// Analytics API Routes
app.get('/api/admin/analytics/overview', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // กำหนดช่วงเวลาเริ่มต้น (7 วันล่าสุด)
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    // ข้อมูลรวม - ใช้ข้อมูลจริงจาก Database
    const [
      totalOrders,
      totalRevenue,
      totalCustomers,
      totalProducts
    ] = await Promise.all([
      // จำนวนคำสั่งซื้อในช่วงเวลาที่เลือก
      prisma.orders.count({
        where: {
          created_at: {
            gte: start,
            lte: end
          }
        }
      }),
      
      // รายได้รวม (เฉพาะที่ชำระแล้ว)
      prisma.orders.aggregate({
        where: {
          created_at: {
            gte: start,
            lte: end
          },
          payment_status: 'paid'
        },
        _sum: {
          total_amount: true
        }
      }),
      
      // จำนวนลูกค้าในช่วงเวลาที่เลือก
      prisma.users.count({
        where: {
          created_at: {
            gte: start,
            lte: end
          }
        }
      }),
      
      // จำนวนสินค้าทั้งหมด
      prisma.product.count()
    ]);
    
    // ข้อมูลเปรียบเทียบช่วงก่อนหน้า
    const periodDuration = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodDuration);
    const previousEnd = start;
    
    const [
      previousOrders,
      previousRevenue
    ] = await Promise.all([
      prisma.orders.count({
        where: {
          created_at: {
            gte: previousStart,
            lte: previousEnd
          }
        }
      }),
      
      prisma.orders.aggregate({
        where: {
          created_at: {
            gte: previousStart,
            lte: previousEnd
          },
          payment_status: 'paid'
        },
        _sum: {
          total_amount: true
        }
      })
    ]);
    
    // คำนวณ growth rate
    const ordersGrowth = previousOrders > 0 ? ((totalOrders - previousOrders) / previousOrders) * 100 : 0;
    const currentRevenue = Number(totalRevenue._sum.total_amount) || 0;
    const prevRevenue = Number(previousRevenue._sum.total_amount) || 0;
    const revenueGrowth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue: currentRevenue,
        totalCustomers,
        totalProducts,
        growth: {
          orders: ordersGrowth,
          revenue: revenueGrowth
        },
        period: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ'
    });
  }
});

// กราฟยอดขายรายวัน - ใช้ข้อมูลจริง
app.get('/api/admin/analytics/sales-chart', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    // ดึงข้อมูลการขายรายวันจริงจาก Database โดยใช้ Raw SQL
    const salesData = await prisma.$queryRaw<Array<{
      date: string;
      total_sales: number;
      order_count: number;
    }>>`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0)::numeric as total_sales,
        COUNT(*)::integer as order_count
      FROM orders 
      WHERE payment_status = 'paid'
        AND created_at >= ${start}
        AND created_at <= ${end}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;
    
    // สร้าง array ของวันที่ในช่วงที่เลือก
    const dateRange = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      dateRange.push(new Date(currentDate).toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // รวมข้อมูลกับวันที่ที่ไม่มีข้อมูล
    const chartData = dateRange.map(date => {
      const data = salesData.find(item => item.date === date);
      
      return {
        date,
        total_sales: data ? Number(data.total_sales) : 0,
        order_count: data ? Number(data.order_count) : 0
      };
    });
    
    res.json({
      success: true,
      data: chartData
    });
    
  } catch (error) {
    console.error('Sales chart error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลกราฟการขาย'
    });
  }
});

// สินค้าขายดี - ใช้ข้อมูลจริงและสถิติการขาย
app.get('/api/admin/analytics/top-products', async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    // ดึงสินค้าขายดีจริงจากข้อมูล order_items
    const topProducts = await prisma.$queryRaw<Array<{
      product_id: number;
      name: string;
      image_url: string | null;
      price: number;
      stock: number;
      total_quantity: number;
      total_revenue: number;
      order_count: number;
    }>>`
      SELECT 
        p.id as product_id,
        p.name,
        p.image_url,
        p.price::numeric as price,
        p.stock,
        COALESCE(SUM(oi.quantity), 0)::integer as total_quantity,
        COALESCE(SUM(oi.total), 0)::numeric as total_revenue,
        COUNT(DISTINCT o.id)::integer as order_count
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
     
      LEFT JOIN orders o ON oi.order_id = o.id
        AND o.payment_status = 'paid'
        AND o.created_at >= ${start}
        AND o.created_at <= ${end}
      GROUP BY p.id, p.name, p.image_url, p.price, p.stock
      HAVING COALESCE(SUM(oi.quantity), 0) > 0
      ORDER BY total_quantity DESC
      LIMIT ${Number(limit)}
    `;
    
    res.json({
      success: true,
      data: topProducts.map(product => ({
        product_id: product.product_id,
        name: product.name,
        image_url: product.image_url,
        price: Number(product.price),
        stock: product.stock,
        total_quantity: Number(product.total_quantity),
        total_revenue: Number(product.total_revenue),
        order_count: Number(product.order_count)
      }))
    });
    
  } catch (error) {
    console.error('Top products error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสินค้าขายดี'
    });
  }
});

// สถิติลูกค้า - ใช้ข้อมูลจริงจาก users และ orders
app.get('/api/admin/analytics/customers-stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    // สถิติลูกค้าจริงจาก Database
    const [
      newCustomers,
      returningCustomers,
      topCustomers
    ] = await Promise.all([
      // ลูกค้าใหม่ในช่วงเวลาที่เลือก
      prisma.users.count({
        where: {
          created_at: {
            gte: start,
            lte: end
          }
        }
      }),
      
      // ลูกค้าที่กลับมาซื้อซ้ำ (มีคำสั่งซื้อมากกว่า 1)
      prisma.users.count({
        where: {
          orders: {
            some: {
              payment_status: 'paid'
            }
          }
        }
      }),
      
      // ลูกค้าที่ซื้อมากที่สุด
      prisma.$queryRaw<Array<{
        user_id: number;
        name: string;
        email: string;
        total_orders: number;
        total_spent: number;
      }>>`
        SELECT 
          u.id,
          u.name,
          u.email,
          COUNT(o.id)::integer as total_orders,
          COALESCE(SUM(o.total_amount), 0)::numeric as total_spent,
          AVG(o.total_amount)::numeric as avg_order_value,
          MAX(o.created_at) as last_order_date
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id 
          AND o.payment_status = 'paid'
          AND o.created_at >= ${start}
          AND o.created_at <= ${end}
        GROUP BY u.id, u.name, u.email
        HAVING COUNT(o.id) > 0
        ORDER BY total_spent DESC
        LIMIT 10
      `
    ]);
    
    res.json({
      success: true,
      data: {
        newCustomers,
        returningCustomers,
        topCustomers: topCustomers.map(customer => ({
          user_id: customer.user_id,
          name: customer.name,
          email: customer.email,
          total_orders: Number(customer.total_orders),
          total_spent: Number(customer.total_spent)
        }))
      }
    });
    
  } catch (error) {
    console.error('Customers stats error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติลูกค้า'
    });
  }
});

// รายงานสต็อก - ใช้ข้อมูลจริง
app.get('/api/admin/analytics/inventory-report', async (req, res) => {
  try {
    // ใช้ข้อมูลจริงจาก Product table
    const [
      lowStockProducts,
      outOfStockProducts,
      totalProducts
    ] = await Promise.all([
      // สินค้าที่เหลือน้อย (< 10 ชิ้น)
      prisma.product.findMany({
        where: {
          stock: {
            lt: 10,
            gt: 0
          }
        },
        select: {
          id: true,
          name: true,
          stock: true,
          price: true,
          image_url: true
        },
        orderBy: {
          stock: 'asc'
        }
      }),
      
      // สินค้าที่หมดแล้ว
      prisma.product.findMany({
        where: {
          stock: 0
        },
        select: {
          id: true,
          name: true,
          stock: true,
          price: true,
          image_url: true
        }
      }),
      
      // จำนวนสินค้าทั้งหมด
      prisma.product.count()
    ]);
    
    // แปลง field names ให้ตรงกับ frontend
    const formatProducts = (products: any[]) => products.map(product => ({
      id: product.id,
      name: product.name,
      stock_quantity: product.stock,
      price: Number(product.price),
      image_url: product.image_url
    }));
    
    res.json({
      success: true,
      data: {
        lowStockProducts: formatProducts(lowStockProducts),
        outOfStockProducts: formatProducts(outOfStockProducts),
        totalProducts,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length
      }
    });
    
  } catch (error) {
    console.error('Inventory report error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานสต็อก'
    });
  }
});


// เพิ่มใน index.ts หลัง checkAndCreateAlert function

// Get Stock Movement History
app.get('/api/admin/inventory/movements', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const productId = req.query.product_id ? parseInt(req.query.product_id as string) : null;
    const movementType = req.query.movement_type as string || '';
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    
    const offset = (page - 1) * limit;
    
    let whereCondition: any = {};
    
    if (productId) {
      whereCondition.product_id = productId;
    }
    
    if (movementType) {
      whereCondition.movement_type = movementType;
    }
    
    if (startDate && endDate) {
      whereCondition.created_at = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    const [movements, totalCount] = await Promise.all([
      prisma.stock_movements.findMany({
        where: whereCondition,
        include: {
          product: {
            select: {
              name: true,
              image_url: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit
      }),
      
      prisma.stock_movements.count({ where: whereCondition })
    ]);
    
    res.json({
      success: true,
      data: movements,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalCount / limit),
        total_count: totalCount,
        limit: limit,
        has_next: page * limit < totalCount,
        has_prev: page > 1
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching stock movements:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการเคลื่อนไหวสต็อก'
    });
  }
});

// Get Inventory Alerts
app.get('/api/admin/inventory/alerts', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const alertType = req.query.alert_type as string || '';
    const isRead = req.query.is_read === 'true';
    
    const offset = (page - 1) * limit;
    
    let whereCondition: any = {
      is_active: true
    };
    
    if (alertType) {
      whereCondition.alert_type = alertType;
    }
    
    if (req.query.is_read !== undefined) {
      whereCondition.is_read = isRead;
    }
    
    const [alerts, totalCount] = await Promise.all([
      prisma.inventory_alerts.findMany({
        where: whereCondition,
        include: {
          product: {
            select: {
              name: true,
              image_url: true,
              stock: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { created_at: 'desc' }
        ],
        skip: offset,
        take: limit
      }),
      
      prisma.inventory_alerts.count({ where: whereCondition })
    ]);
    
    res.json({
      success: true,
      data: alerts,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalCount / limit),
        total_count: totalCount,
        limit: limit,
        has_next: page * limit < totalCount,
        has_prev: page > 1
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching inventory alerts:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลแจ้งเตือน'
    });
  }
});

// Mark Alert as Read
app.put('/api/admin/inventory/alerts/:id/read', async (req: Request, res: Response) => {
  try {
    const alertId = parseInt(req.params.id);
    
    if (isNaN(alertId)) {
      return res.status(400).json({
        success: false,
        message: 'Alert ID ไม่ถูกต้อง'
      });
    }
    
    const alert = await prisma.inventory_alerts.update({
      where: { id: alertId },
      data: {
        is_read: true,
        read_at: new Date()
      }
    });
    
    res.json({
      success: true,
      message: 'อ่านแจ้งเตือนแล้ว',
      data: alert
    });
    
  } catch (error) {
    console.error('❌ Error marking alert as read:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัพเดทแจ้งเตือน'
    });
  }
});

// Mark Multiple Alerts as Read
app.put('/api/admin/inventory/alerts/bulk-read', async (req: Request, res: Response) => {
  try {
    const { alertIds } = req.body;
    
    if (!alertIds || !Array.isArray(alertIds)) {
      return res.status(400).json({
        success: false,
        message: 'Alert IDs ไม่ถูกต้อง'
      });
    }
    
    const result = await prisma.inventory_alerts.updateMany({
      where: {
        id: {
          in: alertIds.map((id: any) => parseInt(id))
        }
      },
      data: {
        is_read: true,
        read_at: new Date()
      }
    });
    
    res.json({
      success: true,
      message: `อ่านแจ้งเตือน ${result.count} รายการแล้ว`,
      data: { updated_count: result.count }
    });
    
  } catch (error) {
    console.error('❌ Error bulk marking alerts as read:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัพเดทแจ้งเตือน'
    });
  }
});

// Get Product Stock History
app.get('/api/admin/inventory/products/:id/history', async (req: Request, res: Response) => {
  try {
    const productId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Product ID ไม่ถูกต้อง'
      });
    }
    
    const offset = (page - 1) * limit;
    
    const [movements, totalCount, product] = await Promise.all([
      prisma.stock_movements.findMany({
        where: { product_id: productId },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit
      }),
      
      prisma.stock_movements.count({
        where: { product_id: productId }
      }),
      
      prisma.product.findUnique({
        where: { id: productId },
        select: {
          name: true,
          stock: true,
          image_url: true
        }
      })
    ]);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบสินค้า'
      });
    }
    
    res.json({
      success: true,
      data: {
        product: product,
        movements: movements,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(totalCount / limit),
          total_count: totalCount,
          limit: limit,
          has_next: page * limit < totalCount,
          has_prev: page > 1
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching product stock history:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงประวัติสต็อกสินค้า'
    });
  }
});

// Get Low Stock Alert Summary
app.get('/api/admin/inventory/alerts/summary', async (req: Request, res: Response) => {
  try {
    const [
      totalAlerts,
      unreadAlerts,
      criticalAlerts,
      warningAlerts,
      recentAlerts
    ] = await Promise.all([
      // แจ้งเตือนทั้งหมดที่ยังใช้งานอยู่
      prisma.inventory_alerts.count({
        where: { is_active: true }
      }),
      
      // แจ้งเตือนที่ยังไม่ได้อ่าน
      prisma.inventory_alerts.count({
        where: {
          is_active: true,
          is_read: false
        }
      }),
      
      // แจ้งเตือนระดับวิกฤต
      prisma.inventory_alerts.count({
        where: {
          is_active: true,
          alert_level: 'critical'
        }
      }),
      
      // แจ้งเตือนระดับเตือน
      prisma.inventory_alerts.count({
        where: {
          is_active: true,
          alert_level: 'warning'
        }
      }),
      
      // แจ้งเตือนล่าสุด
      prisma.inventory_alerts.findMany({
        where: { is_active: true },
        include: {
          product: {
            select: {
              name: true,
              image_url: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 5
      })
    ]);
    
    res.json({
      success: true,
      data: {
        summary: {
          total_alerts: totalAlerts,
          unread_alerts: unreadAlerts,
          critical_alerts: criticalAlerts,
          warning_alerts: warningAlerts
        },
        recent_alerts: recentAlerts
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching alerts summary:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงสรุปแจ้งเตือน'
    });
  }
});

// Auto-generate alerts for all products (Manual trigger)
app.post('/api/admin/inventory/alerts/generate', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Generating inventory alerts...');
    
    // ดึงสินค้าทั้งหมดพร้อมการตั้งค่า
    const products = await prisma.product.findMany({
      include: {
        inventory_setting: true
      }
    });
    
    let alertsCreated = 0;
    
    for (const product of products) {
      const minStock = product.inventory_setting?.min_stock || 5;
      
      // ตรวจสอบและสร้างแจ้งเตือน
      if (product.stock === 0 || product.stock <= minStock) {
        try {
          await checkAndCreateAlert(product.id, product.stock, minStock);
          alertsCreated++;
        } catch (error) {
          console.error(`Error creating alert for product ${product.id}:`, error);
        }
      }
    }
    
    res.json({
      success: true,
      message: `สร้างแจ้งเตือน ${alertsCreated} รายการเรียบร้อยแล้ว`,
      data: {
        products_checked: products.length,
        alerts_created: alertsCreated
      }
    });
    
  } catch (error) {
    console.error('❌ Error generating alerts:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างแจ้งเตือน'
    });
  }
});




// ===========================================
// API ROUTES - Protected Routes
// ===========================================

// (Removed third duplicate /admin catch-all)



// ===========================================
// COUPON MANAGEMENT API ROUTES
// ===========================================

// GET /api/admin/coupons - ดึงรายการคูปองทั้งหมด
app.get('/api/admin/coupons', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string || '';
    const status = req.query.status as string || 'all';
    const type = req.query.type as string || 'all';
    const sort = req.query.sort as string || 'created_at';
    const order = req.query.order as string || 'desc';

    console.log('🎫 Loading coupons with params:', {
      page, limit, search, status, type, sort, order
    });

    const offset = (page - 1) * limit;

    // สร้าง where condition
    let whereCondition: any = {};

    // Filter ตามการค้นหา
    if (search) {
      whereCondition.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Filter ตามสถานะ
    if (status !== 'all') {
      const now = new Date();
      switch (status) {
        case 'active':
          whereCondition.AND = [
            { is_active: true },
            { start_date: { lte: now } },
            { end_date: { gte: now } }
          ];
          break;
        case 'inactive':
          whereCondition.is_active = false;
          break;
        case 'expired':
          whereCondition.end_date = { lt: now };
          break;
      }
    }

    // Filter ตามประเภท
    if (type !== 'all') {
      whereCondition.discount_type = type;
    }

    // สร้าง orderBy
    const orderBy: any = {};
    orderBy[sort] = order;

    // ดึงข้อมูลจาก database
    const [coupons, totalCount] = await Promise.all([
      prisma.coupon.findMany({
        where: whereCondition,
        orderBy: orderBy,
        skip: offset,
        take: limit,
        include: {
          _count: {
            select: {
              coupon_usages: true
            }
          }
        }
      }),
      prisma.coupon.count({ where: whereCondition })
    ]);

    // Format ข้อมูล
    const formattedCoupons = coupons.map(coupon => ({
      ...coupon,
      usage_count: coupon._count.coupon_usages,
      discount_value: Number(coupon.discount_value),
      min_order_amount: coupon.min_order_amount ? Number(coupon.min_order_amount) : null,
      max_discount_amount: coupon.max_discount_amount ? Number(coupon.max_discount_amount) : null
    }));

    const totalPages = Math.ceil(totalCount / limit);

    console.log(`✅ Loaded ${coupons.length} coupons, total: ${totalCount}`);

    res.json({
      success: true,
      data: formattedCoupons,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_count: totalCount,
        limit: limit,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Error loading coupons:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถดึงรายการคูปองได้: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

// POST /api/admin/coupons - สร้างคูปองใหม่
app.post('/api/admin/coupons', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    console.log('🎫 Creating new coupon:', body);

    // Validation
    if (!body.code || !body.name || !body.discount_type || !body.discount_value) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่ครบถ้วน: ต้องมีรหัสคูปอง, ชื่อ, ประเภทส่วนลด, และค่าส่วนลด'
      });
    }

    // ตรวจสอบรหัสคูปองซ้ำ
    const existingCoupon = await prisma.coupon.findUnique({
      where: { code: body.code.toUpperCase() }
    });

    if (existingCoupon) {
      return res.status(409).json({
        success: false,
        message: 'รหัสคูปองนี้มีอยู่แล้ว'
      });
    }

    // ตรวจสอบวันที่
    const startDate = new Date(body.start_date);
    const endDate = new Date(body.end_date);

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: 'วันหมดอายุต้องหลังจากวันเริ่มใช้งาน'
      });
    }

    // สร้างคูปองใหม่
    const newCoupon = await prisma.coupon.create({
      data: {
        code: body.code.toUpperCase(),
        name: body.name,
        description: body.description || null,
        discount_type: body.discount_type,
        discount_value: parseFloat(body.discount_value),
        min_order_amount: body.min_order_amount ? parseFloat(body.min_order_amount) : null,
        max_discount_amount: body.max_discount_amount ? parseFloat(body.max_discount_amount) : null,
        usage_limit: body.usage_limit ? parseInt(body.usage_limit) : null,
        usage_limit_per_user: body.usage_limit_per_user ? parseInt(body.usage_limit_per_user) : null,
        minimum_quantity: body.minimum_quantity ? parseInt(body.minimum_quantity) : null,
        start_date: startDate,
        end_date: endDate,
        is_active: body.is_active !== undefined ? body.is_active : true,
        usage_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log('✅ Coupon created successfully:', newCoupon.code);

    res.json({
      success: true,
      data: {
        ...newCoupon,
        discount_value: Number(newCoupon.discount_value),
        min_order_amount: newCoupon.min_order_amount ? Number(newCoupon.min_order_amount) : null,
        max_discount_amount: newCoupon.max_discount_amount ? Number(newCoupon.max_discount_amount) : null
      },
      message: 'สร้างคูปองเรียบร้อยแล้ว'
    });

  } catch (error) {
    console.error('❌ Error creating coupon:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถสร้างคูปองได้: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});




// GET /api/admin/coupons/stats - ดึงสถิติคูปอง
app.get('/api/admin/coupons/stats', async (req: Request, res: Response) => {
  try {
    console.log('📊 Loading coupon statistics...');

    const [
      totalCoupons,
      activeCoupons,
      expiredCoupons,
      usedCount,
      topUsedCoupons
    ] = await Promise.all([
      // จำนวนคูปองทั้งหมด
      prisma.coupon.count(),
      
      // จำนวนคูปองที่ยังใช้งานได้
      prisma.coupon.count({
        where: {
          is_active: true,
          start_date: { lte: new Date() },
          end_date: { gte: new Date() }
        }
      }),
      
      // จำนวนคูปองที่หมดอายุ
      prisma.coupon.count({
        where: {
          end_date: { lt: new Date() }
        }
      }),
      
      // จำนวนการใช้งานทั้งหมด
      prisma.couponUsage.count(),
      
      // คูปองที่ถูกใช้มากที่สุด
      prisma.coupon.findMany({
        include: {
          _count: {
            select: {
              coupon_usages: true
            }
          }
        },
        orderBy: {
          usage_count: 'desc'
        },
        take: 5
      })
    ]);

    const stats = {
      total_coupons: totalCoupons,
      active_coupons: activeCoupons,
      expired_coupons: expiredCoupons,
      used_count: usedCount,
      top_used: topUsedCoupons.map((coupon: any) => ({
        code: coupon.code,
        name: coupon.name,
        usage_count: coupon._count.coupon_usages
      }))
    };

    console.log('✅ Coupon stats loaded:', stats);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error fetching coupon stats:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถดึงสถิติคูปองได้: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

// GET /api/admin/coupons/:id - ดึงคูปองตาม ID
app.get('/api/admin/coupons/:id', async (req: Request, res: Response) => {
  try {
    const couponId = parseInt(req.params.id);
    
    console.log('🎫 Loading coupon by ID:', couponId);
    
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        _count: {
          select: {
            coupon_usages: true
          }
        }
      }
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบคูปองที่ต้องการ'
      });
    }

    console.log('✅ Coupon found:', coupon.code);

    res.json({
      success: true,
      data: {
        ...coupon,
        usage_count: coupon._count.coupon_usages
      }
    });

  } catch (error) {
    console.error('❌ Error fetching coupon:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถดึงข้อมูลคูปองได้: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

// PUT /api/admin/coupons/:id - อัปเดตคูปอง
app.put('/api/admin/coupons/:id', async (req: Request, res: Response) => {
  try {
    const couponId = parseInt(req.params.id);
    const body = req.body;

    console.log('🎫 Updating coupon:', couponId, body);

    // Check if coupon exists
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId }
    });

    if (!existingCoupon) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบคูปองที่ต้องการ'
      });
    }

    // Check if code is unique (exclude current coupon)
    if (body.code && body.code !== existingCoupon.code) {
      const duplicateCoupon = await prisma.coupon.findUnique({
        where: { code: body.code.toUpperCase() }
      });

      if (duplicateCoupon) {
        return res.status(409).json({
          success: false,
          message: 'รหัสคูปองนี้มีอยู่แล้ว'
        });
      }
    }

    // Update coupon
    const updatedCoupon = await prisma.coupon.update({
      where: { id: couponId },
      data: {
        code: body.code?.toUpperCase() || existingCoupon.code,
        name: body.name || existingCoupon.name,
        description: body.description !== undefined ? body.description : existingCoupon.description,
        discount_type: body.discount_type || existingCoupon.discount_type,
        discount_value: body.discount_value ? parseFloat(body.discount_value) : existingCoupon.discount_value,
        min_order_amount: body.min_order_amount !== undefined ? (body.min_order_amount ? parseFloat(body.min_order_amount) : null) : existingCoupon.min_order_amount,
        max_discount_amount: body.max_discount_amount !== undefined ? (body.max_discount_amount ? parseFloat(body.max_discount_amount) : null) : existingCoupon.max_discount_amount,
        usage_limit: body.usage_limit !== undefined ? (body.usage_limit ? parseInt(body.usage_limit) : null) : existingCoupon.usage_limit,
        usage_limit_per_user: body.usage_limit_per_user !== undefined ? (body.usage_limit_per_user ? parseInt(body.usage_limit_per_user) : null) : existingCoupon.usage_limit_per_user,
        minimum_quantity: body.minimum_quantity !== undefined ? (body.minimum_quantity ? parseInt(body.minimum_quantity) : null) : existingCoupon.minimum_quantity,
        start_date: body.start_date ? new Date(body.start_date) : existingCoupon.start_date,
        end_date: body.end_date ? new Date(body.end_date) : existingCoupon.end_date,
        is_active: body.is_active !== undefined ? body.is_active : existingCoupon.is_active,
        updated_at: new Date()
      }
    });

    console.log('✅ Coupon updated successfully:', updatedCoupon.code);

    res.json({
      success: true,
      data: updatedCoupon,
      message: 'อัปเดตคูปองเรียบร้อยแล้ว'
    });

  } catch (error) {
    console.error('❌ Error updating coupon:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถอัปเดตคูปองได้: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

// DELETE /api/admin/coupons/:id - ลบคูปอง
app.delete('/api/admin/coupons/:id', async (req: Request, res: Response) => {
  try {
    const couponId = parseInt(req.params.id);

    console.log('🗑️ Deleting coupon:', couponId);

    // Check if coupon exists and has been used
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        _count: {
          select: {
            coupon_usages: true
          }
        }
      }
    });

    if (!existingCoupon) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบคูปองที่ต้องการ'
      });
    }

    // Check if coupon has been used
    if (existingCoupon._count.coupon_usages > 0) {
      return res.status(409).json({
        success: false,
        message: 'ไม่สามารถลบคูปองที่มีการใช้งานแล้ว'
      });
    }

    // Delete coupon
    await prisma.coupon.delete({
      where: { id: couponId }
    });

    console.log('✅ Coupon deleted successfully');

    res.json({
      success: true,
      message: 'ลบคูปองเรียบร้อยแล้ว'
    });

  } catch (error) {
    console.error('❌ Error deleting coupon:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถลบคูปองได้: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

// PUT /api/admin/coupons/:id/status - เปลี่ยนสถานะคูปอง
app.put('/api/admin/coupons/:id/status', async (req: Request, res: Response) => {
  try {
    const couponId = parseInt(req.params.id);
    const { is_active } = req.body;

    console.log('🔄 Toggling coupon status:', couponId, 'to', is_active);

    const updatedCoupon = await prisma.coupon.update({
      where: { id: couponId },
      data: {
        is_active: is_active,
        updated_at: new Date()
      }
    });

    console.log('✅ Coupon status updated successfully');

    res.json({
      success: true,
      data: updatedCoupon,
      message: `${is_active ? 'เปิด' : 'ปิด'}ใช้งานคูปองเรียบร้อยแล้ว`
    });

  } catch (error) {
    console.error('❌ Error updating coupon status:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถเปลี่ยนสถานะคูปองได้: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

// ===========================================
// 🎫 COUPON VALIDATION API (สำหรับ Frontend)
// ===========================================

// POST /api/coupons/validate - ตรวจสอบและใช้คูปอง
app.post('/api/coupons/validate', async (req: Request, res: Response) => {
  try {
    const { code, subtotal = 0, user_id = null, email = null } = req.body || {};
    const couponCode = String(code || '').trim().toUpperCase();

    if (!couponCode) {
      return res.status(400).json({ success: false, code: 'MISSING_CODE', message: 'กรุณาระบุรหัสคูปอง' });
    }

    const now = new Date();
    // ใช้ตาราง coupon (เดี่ยว) ให้ตรงกับสคีมาในโปรเจกต์
    const coupon = await (prisma as any).coupon.findFirst({
      where: {
        code: couponCode,
        is_active: true,
        start_date: { lte: now },
        end_date: { gte: now },
      },
    });

    if (!coupon) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'ไม่พบคูปองหรือคูปองหมดอายุแล้ว' });
    }

    // ตรวจขั้นต่ำยอดสั่งซื้อ
    const minSubtotal = Number(coupon.min_order_amount ?? 0);
    if (minSubtotal > 0 && Number(subtotal) < minSubtotal) {
      return res.status(400).json({
        success: false,
        code: 'MIN_SUBTOTAL',
        message: `ยอดสั่งซื้อขั้นต่ำ ${minSubtotal.toLocaleString('th-TH')} บาท`,
        min_subtotal: minSubtotal,
      });
    }

    // จำกัดจำนวนใช้ทั้งหมด
    const maxUses = Number(coupon.usage_limit ?? 0) || null;
    const usedCount = Number(coupon.usage_count ?? 0) || 0;
    if (maxUses != null && usedCount >= maxUses) {
      return res.status(400).json({ success: false, code: 'MAX_USES', message: 'คูปองนี้ถูกใช้งานครบจำนวนแล้ว' });
    }

    // จำกัดต่อผู้ใช้ (ถ้ามี)
    if (coupon.usage_limit_per_user && (user_id || email)) {
      const perUserUsed = await prisma.couponUsage.count({
        where: {
          coupon_id: coupon.id,
          OR: [
            ...(user_id ? [{ user_id }] : []),
            ...(email ? [{ email }] : []),
          ],
        },
      });
      if (perUserUsed >= Number(coupon.usage_limit_per_user)) {
        return res.status(400).json({ success: false, code: 'USER_LIMIT', message: 'คุณใช้คูปองนี้ครบจำนวนแล้ว' });
      }
    }

    // คำนวณส่วนลด
    const type = String(coupon.discount_type || '').toLowerCase(); // 'percentage' | 'amount'
    const value = Number(coupon.discount_value ?? 0);
    let discount = 0;
    if (type === 'percentage') {
      discount = Math.max(0, Math.floor(Number(subtotal) * value / 100));
      const cap = coupon.max_discount_amount != null ? Number(coupon.max_discount_amount) : null;
      if (cap != null && discount > cap) discount = cap;
    } else {
      discount = Math.max(0, value);
    }
    if (discount > Number(subtotal)) discount = Number(subtotal);

    return res.json({
      success: true,
      data: {
        coupon_id: coupon.id,
        code: coupon.code,
        type,
        value,
        discount_amount: discount,
        min_subtotal: minSubtotal || 0,
      },
      message: `ใช้คูปอง ${coupon.code} สำเร็จ ส่วนลด ${discount.toLocaleString('th-TH')} บาท`,
    });
  } catch (e: any) {
    console.error('Validate coupon error:', e);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

// POST /api/coupons/use - บันทึกการใช้คูปอง
app.post('/api/coupons/use', async (req: Request, res: Response) => {
  try {
    const { coupon_id, user_id, email, order_id, order_amount, discount_amount } = req.body;

    console.log('🎫 Recording coupon usage:', { coupon_id, user_id, email, order_id });

    // Validate input
    if (!coupon_id || !order_amount || !discount_amount) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่ครบถ้วน'
      });
    }

    // Find coupon
    const coupon = await prisma.coupon.findUnique({
      where: { id: coupon_id }
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบคูปองที่ระบุ'
      });
    }

    // Record usage
    const usage = await prisma.couponUsage.create({
      data: {
        coupon_id: coupon_id,
        user_id: user_id || null,
        email: email || null,
        order_id: order_id || null,
        order_amount: parseFloat(order_amount),
        discount_amount: parseFloat(discount_amount)
      }
    });

    // Update coupon usage count
    await prisma.coupon.update({
      where: { id: coupon_id },
      data: {
        usage_count: {
          increment: 1
        }
      }
    });

    console.log('✅ Coupon usage recorded successfully');

    res.json({
      success: true,
      data: usage,
      message: 'บันทึกการใช้คูปองเรียบร้อยแล้ว'
    });

  } catch (error) {
    console.error('❌ Error recording coupon usage:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการบันทึกการใช้คูปอง: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

// GET /api/admin/coupons/:id/usage - ดูประวัติการใช้คูปอง
app.get('/api/admin/coupons/:id/usage', async (req: Request, res: Response) => {
  try {
    const couponId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    if (isNaN(couponId)) {
      return res.status(400).json({
        success: false,
        message: 'Coupon ID ไม่ถูกต้อง'
      });
    }

    const offset = (page - 1) * limit;

    const [usages, totalCount, coupon] = await Promise.all([
      prisma.couponUsage.findMany({
        where: { coupon_id: couponId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          order: {
            select: {
              id: true,
              order_number: true,
              order_status: true,
              payment_status: true
            }
          }
        },
        orderBy: { used_at: 'desc' },
        skip: offset,
        take: limit
      }),

      prisma.couponUsage.count({
        where: { coupon_id: couponId }
      }),

      prisma.coupon.findUnique({
        where: { id: couponId },
        select: {
          code: true,
          name: true,
          usage_limit: true,
          usage_count: true
        }
      })
    ]);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบคูปองที่ต้องการ'
      });
    }

    res.json({
      success: true,
      data: {
        coupon: coupon,
        usages: usages,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(totalCount / limit),
          total_count: totalCount,
          per_page: limit
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching coupon usage:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถดึงประวัติการใช้คูปองได้: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

// ===========================================
// จบส่วน COUPON API ROUTES
// ===========================================


// ===========================================
// 📊 ANALYTICS API (Mock Version)
// ===========================================

// GET /api/admin/analytics/page-views - Mock Analytics Data
app.get('/api/admin/analytics/page-views', async (req: Request, res: Response) => {
  try {
    const { period = 'today' } = req.query;
    
    console.log('📊 Mock Analytics API called, period:', period);
    
    // สร้างข้อมูลจำลอง
    const mockData = {
      summary: {
        total_views: Math.floor(Math.random() * 100) + 50,
        unique_visitors: Math.floor(Math.random() * 50) + 20,
        avg_pages_per_visitor: (Math.random() * 3 + 1).toFixed(1),
        period: period
      },
      top_pages: [
        { url: '/', views: 45, percentage: '35.0' },
        { url: '/products', views: 32, percentage: '25.0' },
        { url: '/checkout', views: 23, percentage: '18.0' },
        { url: '/about', views: 15, percentage: '12.0' },
        { url: '/contact', views: 13, percentage: '10.0' }
      ],
      recent_views: [
        { created_at: new Date().toISOString(), page_url: '/', ip_masked: '192.168.1.xxx' },
        { created_at: new Date(Date.now() - 300000).toISOString(), page_url: '/products', ip_masked: '10.0.0.xxx' },
        { created_at: new Date(Date.now() - 600000).toISOString(), page_url: '/checkout', ip_masked: '172.16.0.xxx' },
        { created_at: new Date(Date.now() - 900000).toISOString(), page_url: '/about', ip_masked: '192.168.2.xxx' }
      ]
    };
    
    res.json({
      success: true,
      data: mockData
    });
    
  } catch (error) {
    console.error('Error in mock analytics API:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถดึงข้อมูลสถิติได้'
    });
  }
});

// GET /api/admin/analytics/daily-stats - Mock Daily Stats
app.get('/api/admin/analytics/daily-stats', async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    
    console.log('📊 Mock Daily Stats API called, days:', days);
    
    // สร้างข้อมูลจำลองสำหรับกราฟ
    const dailyStats = [];
    const numDays = parseInt(days as string);
    
    for (let i = numDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      dailyStats.push({
        date: date.toISOString().split('T')[0],
        total_views: Math.floor(Math.random() * 100) + 20,
        unique_views: Math.floor(Math.random() * 50) + 10,
        new_users: Math.floor(Math.random() * 10) + 1,
        orders_count: Math.floor(Math.random() * 5),
        revenue: Math.floor(Math.random() * 5000) + 1000
      });
    }
    
    const mockChanges = {
      views_change: (Math.random() * 20 - 10).toFixed(1), // -10% ถึง +10%
      visitors_change: (Math.random() * 15 - 7.5).toFixed(1)
    };
    
    res.json({
      success: true,
      data: {
        daily_stats: dailyStats,
        changes: mockChanges,
        summary: {
          total_days: dailyStats.length,
          avg_daily_views: dailyStats.reduce((sum, day) => sum + day.total_views, 0) / dailyStats.length,
          avg_daily_visitors: dailyStats.reduce((sum, day) => sum + day.unique_views, 0) / dailyStats.length
        }
      }
    });
    
  } catch (error) {
    console.error('Error in mock daily stats API:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถดึงข้อมูลสถิติรายวันได้'
    });
  }
});




// ===========================================
// LOGO MANAGEMENT API ROUTES
// ===========================================

// GET /api/admin/logo - ดึงการตั้งค่า Logo
app.get('/api/admin/logo', async (req: Request, res: Response) => {
  try {
    console.log('🖼️ Loading logo settings...');
    
    const logoSettings = await prisma.homepage_setting.findFirst({
      select: {
        logo_url: true,
        logo_alt_text: true,
        logo_width: true,
        logo_height: true,
        dark_logo_url: true
      },
      orderBy: { id: 'desc' }
    });

    // ส่งค่าเริ่มต้นถ้าไม่มีข้อมูล
    const defaultLogo = {
      logo_url: null,
      logo_alt_text: 'AquaRoom Logo',
      logo_width: 120,
      logo_height: 40,
      dark_logo_url: null
    };

    const result = logoSettings ? {
      ...defaultLogo,
      ...logoSettings
    } : defaultLogo;

    console.log('✅ Logo settings loaded:', result);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Error loading logo settings:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถดึงการตั้งค่า Logo ได้'
    });
  }
});

// POST /api/admin/logo - บันทึกการตั้งค่า Logo
app.post('/api/admin/logo', async (req: Request, res: Response) => {
  try {
    const { logo_url, logo_alt_text, logo_width, logo_height, dark_logo_url } = req.body;

    console.log('🖼️ Saving logo settings:', req.body);

    // Validate input
    if (logo_width && (logo_width < 50 || logo_width > 300)) {
      return res.status(400).json({
        success: false,
        message: 'ความกว้าง Logo ต้องอยู่ระหว่าง 50-300 พิกเซล'
      });
    }

    if (logo_height && (logo_height < 20 || logo_height > 100)) {
      return res.status(400).json({
        success: false,
        message: 'ความสูง Logo ต้องอยู่ระหว่าง 20-100 พิกเซล'
      });
    }

    // ตรวจสอบว่ามีข้อมูล homepage_setting อยู่แล้วหรือไม่
    const existingSetting = await prisma.homepage_setting.findFirst();

    const logoData = {
      logo_url: logo_url || null,
      logo_alt_text: logo_alt_text || 'AquaRoom Logo',
      logo_width: logo_width || 120,
      logo_height: logo_height || 40,
      dark_logo_url: dark_logo_url || null,
      updated_at: new Date()
    };

    let result;

    if (existingSetting) {
      // อัปเดตข้อมูลที่มีอยู่
      result = await prisma.homepage_setting.update({
        where: { id: existingSetting.id },
        data: logoData
      });
    } else {
      // สร้างข้อมูลใหม่
      result = await prisma.homepage_setting.create({
        data: {
          ...logoData,
          created_at: new Date()
        }
      });
    }

    console.log('✅ Logo settings saved successfully');

    res.json({
      success: true,
      data: {
        logo_url: result.logo_url,
        logo_alt_text: result.logo_alt_text,
        logo_width: result.logo_width,
        logo_height: result.logo_height,
        dark_logo_url: result.dark_logo_url
      },
      message: 'บันทึกการตั้งค่า Logo เรียบร้อยแล้ว'
    });

  } catch (error) {
    console.error('❌ Error saving logo settings:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถบันทึกการตั้งค่า Logo ได้'
    });
  }
});

// POST /api/admin/logo/upload - อัปโหลด Logo ไฟล์
app.post('/api/admin/logo/upload', handleFileUploadWithBusboy, async (req: Request, res: Response) => {
  try {
    const files = (req as any).files as any[];
    const { logo_alt_text, logo_width, logo_height } = req.body;

    console.log('🖼️ Uploading logo files...');
    console.log('Files received:', files?.length || 0);

    let logoUrl = null;
    let darkLogoUrl = null;

    // หา logo files ตาม fieldname
    const logoFile = files?.find(f => f.fieldname === 'logo');
    const darkLogoFile = files?.find(f => f.fieldname === 'darkLogo');

    // ตรวจสอบและเตรียม bucket
    if (!process.env.SUPABASE_BUCKET) {
      return res.status(500).json({ success: false, message: 'Server missing SUPABASE_BUCKET' });
    }
    await ensureBucketExists(process.env.SUPABASE_BUCKET);

    // อัปโหลด Logo หลัก
    if (logoFile) {
      console.log('Uploading main logo:', logoFile.originalname);

      // ตรวจสอบไฟล์
      if (!logoFile.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          message: 'ไฟล์ Logo ต้องเป็นรูปภาพเท่านั้น'
        });
      }

      if (logoFile.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'ไฟล์ Logo ต้องมีขนาดไม่เกิน 5MB'
        });
      }

      // สร้างชื่อไฟล์
      const fileExt = logoFile.originalname.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `logo-${Date.now()}.${fileExt}`;

      // อัปโหลดไป Supabase
      const { data, error } = await supabase
        .storage
        .from(process.env.SUPABASE_BUCKET!)
        .upload(`logos/${fileName}`, logoFile.buffer, {
          contentType: logoFile.mimetype,
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({
          success: false,
          message: 'ไม่สามารถอัปโหลด Logo ได้'
        });
      }

      // สร้าง Public URL
      const { data: publicUrlData } = supabase
        .storage
        .from(process.env.SUPABASE_BUCKET!)
        .getPublicUrl(`logos/${fileName}`);

      logoUrl = publicUrlData.publicUrl;
      console.log('✅ Main logo uploaded:', logoUrl);
    }

  // อัปโหลด Dark Logo
    if (darkLogoFile) {
      console.log('Uploading dark logo:', darkLogoFile.originalname);

      // ตรวจสอบไฟล์
      if (!darkLogoFile.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          message: 'ไฟล์ Dark Logo ต้องเป็นรูปภาพเท่านั้น'
        });
      }

      if (darkLogoFile.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'ไฟล์ Dark Logo ต้องมีขนาดไม่เกิน 5MB'
        });
      }

      // สร้างชื่อไฟล์
      const fileExt = darkLogoFile.originalname.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `dark-logo-${Date.now()}.${fileExt}`;

      // อัปโหลดไป Supabase
      const { data, error } = await supabase
        .storage
        .from(process.env.SUPABASE_BUCKET!)
        .upload(`logos/${fileName}`, darkLogoFile.buffer, {
          contentType: darkLogoFile.mimetype,
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({
          success: false,
          message: 'ไม่สามารถอัปโหลด Dark Logo ได้'
        });
      }

      // สร้าง Public URL
      const { data: publicUrlData } = supabase
        .storage
        .from(process.env.SUPABASE_BUCKET!)
        .getPublicUrl(`logos/${fileName}`);

      darkLogoUrl = publicUrlData.publicUrl;
      console.log('✅ Dark logo uploaded:', darkLogoUrl);
    }

    // บันทึกลงฐานข้อมูลถ้ามีไฟล์อัปโหลด
    if (logoUrl || darkLogoUrl) {
      const existingSetting = await prisma.homepage_setting.findFirst();

      const updateData: any = {
        updated_at: new Date()
      };

      if (logoUrl) updateData.logo_url = logoUrl;
      if (darkLogoUrl) updateData.dark_logo_url = darkLogoUrl;
      if (logo_alt_text) updateData.logo_alt_text = logo_alt_text;
      if (logo_width) updateData.logo_width = parseInt(logo_width);
      if (logo_height) updateData.logo_height = parseInt(logo_height);

      let result;

      if (existingSetting) {
        result = await prisma.homepage_setting.update({
          where: { id: existingSetting.id },
          data: updateData
        });
      } else {
        result = await prisma.homepage_setting.create({
          data: {
            ...updateData,
            logo_alt_text: logo_alt_text || 'AquaRoom Logo',
            logo_width: logo_width ? parseInt(logo_width) : 120,
            logo_height: logo_height ? parseInt(logo_height) : 40,
            created_at: new Date()
          }
        });
      }

      console.log('✅ Logo settings updated in database');
    }

    res.json({
      success: true,
      data: {
        logo_url: logoUrl,
        dark_logo_url: darkLogoUrl
      },
      message: `อัปโหลด Logo เรียบร้อยแล้ว${logoUrl && darkLogoUrl ? ' (ทั้ง 2 แบบ)' : ''}`
    });

  } catch (error) {
    console.error('❌ Error uploading logo:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปโหลด Logo'
    });
  }
});

// DELETE /api/admin/logo/:type - ลบ Logo
app.delete('/api/admin/logo/:type', async (req: Request, res: Response) => {
  try {
    const logoType = req.params.type; // 'main' หรือ 'dark'

    if (!['main', 'dark'].includes(logoType)) {
      return res.status(400).json({
        success: false,
        message: 'ประเภท Logo ไม่ถูกต้อง'
      });
    }

    console.log('🗑️ Deleting logo:', logoType);

    const existingSetting = await prisma.homepage_setting.findFirst();

    if (!existingSetting) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่า Logo'
      });
    }

    // อัปเดตฐานข้อมูล
    const updateData: any = {
      updated_at: new Date()
    };

    if (logoType === 'main') {
      updateData.logo_url = null;
    } else {
      updateData.dark_logo_url = null;
    }

    await prisma.homepage_setting.update({
      where: { id: existingSetting.id },
      data: updateData
    });

    console.log('✅ Logo deleted successfully');

    res.json({
      success: true,
      message: `ลบ ${logoType === 'main' ? 'Logo หลัก' : 'Dark Logo'} เรียบร้อยแล้ว`
    });

  } catch (error) {
    console.error('❌ Error deleting logo:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบ Logo'
    });
  }
});

// ===========================================
// จบส่วน LOGO API ROUTES
// ===========================================

// ===========================================
// PAYMENT SETTINGS API ROUTES
// ===========================================

// GET /api/admin/payment-settings - ดึงการตั้งค่าวิธีการชำระเงิน
app.get('/api/admin/payment-settings', async (req: Request, res: Response) => {
  try {
    console.log('💳 Loading payment settings...');
    
    const settings = await prisma.payment_settings.findFirst({
      orderBy: { id: 'desc' },
      include: {
        bank_accounts: {
          where: { is_active: true },
          orderBy: { sort_order: 'asc' }
        } as any
      }
    });

    console.log('📄 Raw settings from database:', settings);

    // ส่งค่าเริ่มต้นถ้าไม่มีข้อมูล
    const defaultSettings = {
      promptpay_enabled: false,
      promptpay_id: '',
      promptpay_name: '',
      promptpay_qr_type: 'phone',
      bank_transfer_enabled: true,
      bank_accounts: [],
      cod_enabled: false,
      cod_fee: 0,
      cod_max_amount: 0,
      auto_verify_enabled: false,
      payment_timeout_hours: 24,
      require_payment_proof: true
    };
  let result;
    if (settings) {
      // ✅ ใช้ relation bank_accounts ไม่ต้อง parse JSON
      const bankAccountsArray = (settings.bank_accounts as any[] || []).map(account => ({
        bank_name: account.bank_name,
        account_name: account.account_name,
        account_number: account.account_number,
        branch: account.branch,
        bank_icon: account.bank_icon
      }));

      result = {
        ...defaultSettings,
        ...settings,
        bank_accounts: bankAccountsArray
      };
    } else {
      result = defaultSettings;
    }

    console.log('📤 Final result being sent:', result);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Error loading payment settings:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถดึงการตั้งค่าวิธีการชำระเงินได้'
    });
  }
});



app.post('/api/admin/payment-settings', async (req: Request, res: Response) => {
  try {
    const data = req.body;

    // หา record เดิม
    const existing = await prisma.payment_settings.findFirst();

    let result;
    if (existing) {
      // อัปเดตเฉพาะฟิลด์ที่อยู่ใน payment_settings
      result = await prisma.payment_settings.update({
        where: { id: existing.id },
        data: {
          promptpay_enabled: data.promptpay_enabled,
          promptpay_qr_type: data.promptpay_qr_type,
          promptpay_id: data.promptpay_id,
          promptpay_name: data.promptpay_name,
          bank_transfer_enabled: data.bank_transfer_enabled,
          credit_card_enabled: data.credit_card_enabled,
          cod_enabled: data.cod_enabled,
          cod_fee: data.cod_fee,
          cod_max_amount: data.cod_max_amount,
          auto_verify_enabled: data.auto_verify_enabled,
          payment_timeout_hours: data.payment_timeout_hours,
          require_payment_proof: data.require_payment_proof,
          updated_at: new Date()
        }
      });

      // ✅ อัปเดต bank_accounts แยกต่างหาก
      // ลบ bank_accounts เดิมทั้งหมด (ถ้าใช้แบบลบหมดแล้วเพิ่มใหม่)
      await prisma.bank_accounts.deleteMany({
        where: { payment_setting_id: existing.id }
      });

      // เพิ่ม bank_accounts ใหม่
      if (Array.isArray(data.bank_accounts)) {
        for (const account of data.bank_accounts) {
          await prisma.bank_accounts.create({
            data: {
              payment_setting_id: existing.id,
              bank_name: account.bank_name,
              account_name: account.account_name,
              account_number: account.account_number,
              branch: account.branch,
              bank_icon: account.bank_icon,
              sort_order: account.sort_order || 0,
              is_active: true
            }
          });
        }
      }
    } else {
      // สร้างใหม่
      result = await prisma.payment_settings.create({
        data: {
          promptpay_enabled: data.promptpay_enabled,
          promptpay_qr_type: data.promptpay_qr_type,
          promptpay_id: data.promptpay_id,
          promptpay_name: data.promptpay_name,
          bank_transfer_enabled: data.bank_transfer_enabled,
          credit_card_enabled: data.credit_card_enabled,
          cod_enabled: data.cod_enabled,
          cod_fee: data.cod_fee,
          cod_max_amount: data.cod_max_amount,
          auto_verify_enabled: data.auto_verify_enabled,
          payment_timeout_hours: data.payment_timeout_hours,
          require_payment_proof: data.require_payment_proof,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      // เพิ่ม bank_accounts ใหม่
      if (Array.isArray(data.bank_accounts)) {
        for (const account of data.bank_accounts) {
          await prisma.bank_accounts.create({
            data: {
              payment_setting_id: result.id,
              bank_name: account.bank_name,
              account_name: account.account_name,
              account_number: account.account_number,
              branch: account.branch,
              bank_icon: account.bank_icon,
              sort_order: account.sort_order || 0,
              is_active: true
            }
          });
        }
      }
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Error saving payment settings:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถบันทึกการตั้งค่าวิธีการชำระเงินได้'
    });
  }
});


// ✅ API สำหรับ frontend - ใช้ตารางใหม่
app.get('/api/payment-settings', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Loading payment settings with bank accounts...');
    
    // ดึงข้อมูลการตั้งค่าพร้อมบัญชีธนาคาร
    const settings = await prisma.payment_settings.findFirst({
      include: {
        bank_accounts: {
          where: { is_active: true },
          orderBy: { sort_order: 'asc' }
        } as any // <--- เพิ่ม as any เพื่อแก้ TS2322
      },
      orderBy: { id: 'desc' }
    });

    console.log('📊 Settings from database:', settings);

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่าการชำระเงิน'
      });
    }

    // ✅ แปลง bank_accounts เป็น format เดิมเพื่อความเข้ากันได้
const bankAccountsArray = (settings?.bank_accounts as any[] || []).map((account: any) => ({
      bank_name: account.bank_name,
      account_name: account.account_name,
      account_number: account.account_number,
      branch: account.branch,
      bank_icon: account.bank_icon
    }));

    const result = {
      bank_transfer_enabled: settings.bank_transfer_enabled,
      credit_card_enabled: settings.credit_card_enabled,
      cod_enabled: settings.cod_enabled,
      cod_fee: settings.cod_fee ? Number(settings.cod_fee) : 30,
      cod_maximum: settings.cod_max_amount ? Number(settings.cod_max_amount) : 0,
      payment_timeout_hours: settings.payment_timeout_hours,
      require_payment_proof: settings.require_payment_proof,
      currency: 'THB',
      bank_accounts: bankAccountsArray
    };

    console.log('📤 Result with bank accounts:', {
      bank_accounts_count: result.bank_accounts.length,
      accounts: result.bank_accounts.map(acc => ({
        bank: acc.bank_name,
        has_icon: !!acc.bank_icon
      }))
    });

   res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Error loading payment settings:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถโหลดการตั้งค่าการชำระเงินได้'
    });
  }
});








// ✅ API สำหรับ Admin - จัดการธนาคารแยก
app.get('/api/admin/bank-accounts', async (req: Request, res: Response) => {
  try {
    const bankAccounts = await (prisma as any).bank_accounts.findMany({
      include: {
        payment_setting: true
      },
      orderBy: [
        { payment_setting_id: 'desc' },
        { sort_order: 'asc' }
      ]
    });

    res.json({
      success: true,
      data: bankAccounts
    });
  } catch (error) {
    console.error('❌ Error loading bank accounts:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถโหลดข้อมูลบัญชีธนาคารได้'
    });
  }
});

// ✅ API สำหรับเพิ่มบัญชีธนาคาร
app.post('/api/admin/bank-accounts', async (req: Request, res: Response) => {
  try {
    const {
      payment_setting_id,
      bank_name,
      account_name,
      account_number,
      branch,
      bank_icon,
      sort_order
    } = req.body;

     const newBankAccount = await (prisma as any).bank_accounts.create({
      data: {
        payment_setting_id: payment_setting_id || 1,
        bank_name,
        account_name,
        account_number,
        branch,
        bank_icon,
        sort_order: sort_order || 0
      }
    });

    res.json({
      success: true,
      message: 'เพิ่มบัญชีธนาคารเรียบร้อยแล้ว',
      data: newBankAccount
    });
  } catch (error) {
    console.error('❌ Error creating bank account:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการเพิ่มบัญชีธนาคาร'
    });
  }
});


// ✅ API สำหรับอัปเดตบัญชีธนาคาร
app.put('/api/admin/bank-accounts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      bank_name,
      account_name,
      account_number,
      branch,
      bank_icon,
      sort_order,
      is_active
    } = req.body;

    const updatedBankAccount = await (prisma as any).bank_accounts.update({
      where: { id: parseInt(id) },
      data: {
        bank_name,
        account_name,
        account_number,
        branch,
        bank_icon,
        sort_order,
        is_active
      }
    });

    res.json({
      success: true,
      message: 'อัปเดตบัญชีธนาคารเรียบร้อยแล้ว',
      data: updatedBankAccount
    });
  } catch (error) {
    console.error('❌ Error updating bank account:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตบัญชีธนาคาร'
    });
  }
});

// ✅ API สำหรับลบบัญชีธนาคาร
app.delete('/api/admin/bank-accounts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await (prisma as any).bank_accounts.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'ลบบัญชีธนาคารเรียบร้อยแล้ว'
    });
  } catch (error) {
    console.error('❌ Error deleting bank account:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบบัญชีธนาคาร'
    });
  }
});

// ✅ API สำหรับอัปโหลดไอคอนธนาคาร
app.post('/api/admin/bank-accounts/:id/upload-icon', handleFileUploadWithBusboy, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const files = (req as any).files as any[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบไฟล์ที่อัปโหลด'
      });
    }
    const file = files[0];
    const iconPath = `/uploads/${file.originalname}`;

    // อัปเดต bank_icon ในฐานข้อมูล
    const updatedAccount = await (prisma as any).bank_accounts.update({
      where: { id: parseInt(id) },
      data: { bank_icon: iconPath }
    });

    res.json({
      success: true,
      message: 'อัปโหลดไอคอนธนาคารสำเร็จ',
      data: {
        iconPath,
        bank_account: updatedAccount
      }
    });
  } catch (error) {
    console.error('❌ Error uploading bank icon:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปโหลดไอคอน'
    });
  }
});



// GET contact setting
app.get('/api/admin/contact-setting', async (req, res) => {
  try {
    const setting = await prisma.contact_setting.findFirst({ orderBy: { id: 'desc' } });
    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดข้อมูลติดต่อ' });
  }
});

// POST/PUT contact setting (admin)
app.post('/api/admin/contact-setting', async (req, res) => {
  try {
    const data = req.body;
    let setting = await prisma.contact_setting.findFirst();
    if (setting) {
      setting = await prisma.contact_setting.update({
        where: { id: setting.id },
        data: { ...data, updated_at: new Date() }
      });
    } else {
      setting = await prisma.contact_setting.create({ data });
    }
    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: 'ไม่สามารถบันทึกข้อมูลติดต่อ' });
  }
});
app.get('/api/contact-setting', async (req, res) => {
  try {
    const setting = await prisma.contact_setting.findFirst({ orderBy: { id: 'desc' } });
    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดข้อมูลติดต่อ' });
  }
});



// =====================================
// API สำหรับ แนบหลักฐานการโอน
// =====================================
// เพิ่มใน index.ts
app.post('/api/upload/payment-proof', handleFileUploadWithBusboy, async (req: Request, res: Response) => {
  try {
    const files = (req as any).files as any[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No files uploaded' 
      });
    }

    const file = files[0];
    console.log('Uploading payment proof:', file.originalname);

    // ตรวจสอบ file type
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        error: 'กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น'
      });
    }

    // ตรวจสอบ file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'ไฟล์มีขนาดใหญ่เกิน 5MB'
      });
    }

    const fileExt = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `payment-proof-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    if (!process.env.SUPABASE_BUCKET) {
      return res.status(500).json({ success: false, error: 'Server missing SUPABASE_BUCKET' });
    }
    const bucketReadyPP = await ensureBucketExists(process.env.SUPABASE_BUCKET);
    if (!bucketReadyPP) {
      console.warn('Bucket ensure (payment-proof) reported false; attempting upload anyway');
    }

    // อัปโหลดไป Supabase
    const { data, error } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET!)
      .upload(`payment-proofs/${fileName}`, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
        cacheControl: '3600'
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({
        success: false,
        error: 'ไม่สามารถอัปโหลดไฟล์ได้'
      });
    }

    // สร้าง Public URL
    const { data: publicUrlData } = supabase
      .storage
      .from(process.env.SUPABASE_BUCKET!)
      .getPublicUrl(`payment-proofs/${fileName}`);

    const publicUrl = publicUrlData.publicUrl;

    console.log('✅ Payment proof uploaded:', publicUrl);

    res.json({ 
      success: true, 
      file_url: publicUrl,
      file_name: fileName
    });

  } catch (error: any) {
    console.error('Payment proof upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Upload failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});




// POST /api/admin/payment-settings/upload-bank-icon - อัปโหลดไอคอนธนาคาร
app.post('/api/admin/payment-settings/upload-bank-icon', handleFileUploadWithBusboy, async (req: Request, res: Response) => {
  try {
    console.log('📤 Uploading bank icon...');
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบไฟล์ที่อัปโหลด'
      });
    }

    const file = req.files[0];
    const accountIndex = req.body.accountIndex;

    console.log('📝 File info:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      accountIndex: accountIndex
    });

    // ตรวจสอบประเภทไฟล์
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น'
      });
    }

    // ตรวจสอบขนาดไฟล์ (1MB)
    if (file.size > 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'ไฟล์มีขนาดใหญ่เกิน 1MB'
      });
    }

    // อัปโหลดไป Supabase แทนการเก็บ local
    const fileExt = file.originalname.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `bank-icon-${accountIndex}-${Date.now()}.${fileExt}`;

    if (!process.env.SUPABASE_BUCKET) {
      return res.status(500).json({ success: false, message: 'Server missing SUPABASE_BUCKET' });
    }
    const bucketReadyIcon = await ensureBucketExists(process.env.SUPABASE_BUCKET);
    if (!bucketReadyIcon) {
      console.warn('Bucket ensure (bank-icon) reported false; attempting upload anyway');
    }

    const { data, error } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET!)
      .upload(`bank-icons/${fileName}`, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({
        success: false,
        message: 'ไม่สามารถอัปโหลดไอคอนได้'
      });
    }

    // สร้าง Public URL
    const { data: publicUrlData } = supabase
      .storage
      .from(process.env.SUPABASE_BUCKET!)
      .getPublicUrl(`bank-icons/${fileName}`);

    const iconUrl = publicUrlData.publicUrl;

    console.log('✅ Bank icon uploaded successfully:', iconUrl);

    res.json({
      success: true,
      iconUrl: iconUrl,
      message: 'อัปโหลดไอคอนธนาคารสำเร็จ'
    });

  } catch (error) {
    console.error('❌ Error uploading bank icon:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถอัปโหลดไอคอนได้: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});
// เพิ่ม static file serving สำหรับ bank icons
app.use('/uploads/bank-icons', express.static(path.join(__dirname, '../uploads/bank-icons')));


// ===================================
// EMAIL NOTIFICATION SETTINGS API
// ===================================
import { sendOrderNotification, sendTestEmail } from './utils/emailService';

// GET /api/admin/settings/email-notifications - ดึงการตั้งค่าอีเมล
app.get('/api/admin/settings/email-notifications', async (req: Request, res: Response) => {
  try {
    console.log('📧 Loading email notification settings...');
    
    const settings = await prisma.email_notification_settings.findFirst({
      orderBy: { id: 'desc' }
    });

    if (!settings) {
      return res.json({
        success: true,
        data: {
          email_service: 'gmail',
          admin_email: '',
          email_user: '',
          order_notification_enabled: false,
          is_configured: false
        }
      });
    }

    // ไม่ส่ง password กลับไปทาง response
    const { email_password, ...safeSettings } = settings;

    res.json({
      success: true,
      data: safeSettings
    });

  } catch (error) {
    console.error('❌ Error loading email settings:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/admin/settings/email-notifications - บันทึกการตั้งค่าอีเมล
app.post('/api/admin/settings/email-notifications', async (req: Request, res: Response) => {
  try {
    console.log('💾 Saving email notification settings...');
    
    const {
      email_service,
      admin_email,
      email_user,
      email_password,
      smtp_host,
      smtp_port,
      smtp_secure,
      order_notification_enabled
    } = req.body;

    // Validate required fields
    if (!email_service || !admin_email || !email_user) {
      return res.status(400).json({
        success: false,
        error: 'กรุณากรอกข้อมูลให้ครบถ้วน'
      });
    }

    // ตรวจสอบว่ามีการตั้งค่าอยู่แล้วหรือไม่
    const existing = await prisma.email_notification_settings.findFirst();

    let result;
    const settingsData: any = {
      email_service,
      admin_email,
      email_user,
      smtp_host: smtp_host || null,
      smtp_port: smtp_port ? parseInt(smtp_port) : 587,
      smtp_secure: smtp_secure === true || smtp_secure === 'true',
      order_notification_enabled: order_notification_enabled === true || order_notification_enabled === 'true',
      is_configured: true
    };

    // อัปเดต password เฉพาะเมื่อมีการส่งมา (ไม่ใช่ placeholder)
    if (email_password && !email_password.includes('••')) {
      settingsData.email_password = email_password;
    }

    if (existing) {
      result = await prisma.email_notification_settings.update({
        where: { id: existing.id },
        data: settingsData
      });
      console.log('✅ Email settings updated');
    } else {
      result = await prisma.email_notification_settings.create({
        data: settingsData
      });
      console.log('✅ Email settings created');
    }

    // ไม่ส่ง password กลับไป
    const { email_password: _, ...safeResult } = result;

    res.json({
      success: true,
      data: safeResult,
      message: 'บันทึกการตั้งค่าสำเร็จ'
    });

  } catch (error) {
    console.error('❌ Error saving email settings:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/admin/settings/test-email - ทดสอบการส่งอีเมล
app.post('/api/admin/settings/test-email', async (req: Request, res: Response) => {
  try {
    console.log('📧 Sending test email...');
    
    const result = await sendTestEmail();

    if (result.success) {
      res.json({
        success: true,
        message: 'ส่งอีเมลทดสอบสำเร็จ กรุณาตรวจสอบกล่องจดหมายของคุณ',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'ไม่สามารถส่งอีเมลทดสอบได้'
      });
    }

  } catch (error) {
    console.error('❌ Error sending test email:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


// Helper: สร้าง slug จากชื่อ
function toSlug(name: string) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ก-๙\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function generateUniqueSlug(baseName: string) {
  const base = toSlug(baseName) || `cat`;
  return (async () => {
    let candidate = base;
    let i = 1;
    while (true) {
      const exists = await prisma.categories.findFirst({ where: { slug: candidate } });
      if (!exists) return candidate;
      candidate = `${base}-${i++}`;
    }
  })();
}

// GET /api/categories/tree - สำหรับ Mega menu
app.get('/api/categories/tree', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.categories.findMany({
      where: { is_active: true as any },
      orderBy: { id: 'asc' },
      include: { _count: { select: { product_categories: true } } }
    });

    const result = categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug || toSlug(c.name),
      image_url: c.image_url || c.image_url_cate || null, // ใช้ image_url เป็นหลัก
      products_count: c._count?.product_categories ?? 0,
      children: [] as any[]
    }));

    return res.json({ success: true, categories: result });
  } catch (error) {
    console.error('Error building categories tree:', error);
    return res.status(500).json({ success: false, message: 'โหลดหมวดหมู่ไม่สำเร็จ' });
  }
});

// API สำหรับคำนวณค่าจัดส่ง

app.post('/api/calculate-shipping', async (req: Request, res: Response) => {
  try {
    const { items, subtotal } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'ไม่มีรายการสินค้า' });
    }

    // รวม id ซ้ำกันก่อน (กัน frontend ส่งแตกบรรทัดเดียวกัน)
    const merged = items.reduce((acc: any[], it: any) => {
      const found = acc.find(a => a.id === it.id);
      if (found) found.quantity += Number(it.quantity || 0);
      else acc.push({ id: it.id, quantity: Number(it.quantity || 0) });
      return acc;
    }, []);

    const details: any[] = [];
    let totalShippingCost = 0;

    const specialProducts: { product: any; quantity: number }[] = [];
    const normalProducts: { product: any; quantity: number }[] = [];

    // โหลดสินค้าทีละตัวและจัดกลุ่ม
    for (const row of merged) {
      const product = await prisma.product.findUnique({
        where: { id: row.id },
        include: {
          product_categories: { include: { categories: { include: { shipping_rule: true } } } }
        }
      });
      if (!product) {
        details.push({ type: 'missing', id: row.id });
        continue;
      }

      if (product.has_special_shipping && product.special_shipping_base != null) {
        specialProducts.push({ product, quantity: row.quantity });
      } else {
        normalProducts.push({ product, quantity: row.quantity });
      }
    }

    // กำหนด config ค่าจัดส่งพิเศษ (ใช้ค่าคงที่ตามโจทย์ หรือจากสินค้าแรกถ้าต้อง)
    let specialConfig = {
      base: 80,                // base ครั้งเดียว
      threshold: 4,             // รวมถึง 4 ชิ้นไม่คิดเพิ่ม
      extra: 10                 // เกินคิดเพิ่มต่อชิ้น
    };
    // ถ้ามี product ตั้งค่าเฉพาะตัว และอยาก override ด้วยค่าแรก
    if (specialProducts.length > 0) {
      const first = specialProducts.find(p => p.product.special_shipping_base != null);
      if (first) {
        specialConfig = {
          base: Number(first.product.special_shipping_base) || specialConfig.base,
          threshold: Number(first.product.special_shipping_qty || specialConfig.threshold),
          extra: Number(first.product.special_shipping_extra || specialConfig.extra)
        };
      }
    }

    // คิดค่าจัดส่งพิเศษแบบรวมครั้งเดียว
    if (specialProducts.length > 0) {
      const totalQty = specialProducts.reduce((sum, p) => sum + p.quantity, 0);
      let cost = specialConfig.base;
      if (totalQty > specialConfig.threshold) {
        cost += (totalQty - specialConfig.threshold) * specialConfig.extra;
      }
      totalShippingCost += cost;
      details.push({
        type: 'special_group',
        products: specialProducts.map(p => ({ id: p.product.id, name: p.product.name, qty: p.quantity })),
        total_qty: totalQty,
        config: specialConfig,
        shipping: cost,
        formula: totalQty <= specialConfig.threshold
          ? `cost = ${specialConfig.base}`
          : `cost = ${specialConfig.base} + (${totalQty - specialConfig.threshold} * ${specialConfig.extra})`
      });
    }

    // คิดสินค้าปกติ (รองรับค่าส่งระดับสินค้า -> กฎหมวดหมู่ -> default)
    const toNum = (v: any): number | null => {
      if (v === null || v === undefined) return null;
      try {
        // Prisma Decimal อาจต้องแปลงเป็น string ก่อน
        const s = typeof v === 'object' && typeof (v as any).toString === 'function' ? (v as any).toString() : v;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
      } catch { return null; }
    };
    for (const { product, quantity } of normalProducts) {
      // 1) ค่าส่งระดับสินค้า (ถ้ากำหนดไว้ ใช้ก่อน)
      const provinces = toNum(product.shipping_cost_provinces);
      const bangkok = toNum(product.shipping_cost_bangkok);
      const remote = toNum(product.shipping_cost_remote);
      const perProductCost = (provinces ?? bangkok ?? remote);

      if (perProductCost != null && perProductCost > 0) {
        const cost = perProductCost; // ต่อหนึ่งรายการสินค้า (สอดคล้อง default behavior เดิม)
        totalShippingCost += cost;
        details.push({
          type: 'product_shipping',
          product: { id: product.id, name: product.name },
          quantity,
          shipping: cost,
          raw: { provinces, bangkok, remote }
        });
        continue;
      }

      // 2) กฎจากหมวดหมู่ (ถ้ามีและเปิดใช้งาน)
      const rule = product.product_categories[0]?.categories?.shipping_rule;
      if (rule?.is_active) {
        let cost = Number(rule.base_cost);
        if (rule.quantity_threshold && rule.extra_cost_per_item && quantity > rule.quantity_threshold) {
          cost += (quantity - rule.quantity_threshold) * Number(rule.extra_cost_per_item);
        }
        totalShippingCost += cost;
        details.push({
          type: 'category_rule',
          product: { id: product.id, name: product.name },
          quantity,
          shipping: cost
        });
      } else {
        // 3) ค่าจัดส่งทั่วไป
        const cost = 50;
        totalShippingCost += cost;
        details.push({
          type: 'default',
          product: { id: product.id, name: product.name },
          quantity,
          shipping: cost
        });
      }
    }

    return res.json({
      success: true,
      version: 'server-shipping-v2',
      shippingCost: totalShippingCost,
      data: {
        totalShippingCost,
        details,
        freeShippingApplied: subtotal >= 1000 && totalShippingCost === 0
      }
    });
  } catch (error) {
    console.error('❌ Calculate shipping error:', error);
    return res.status(500).json({ success: false, error: 'ไม่สามารถคำนวณค่าจัดส่งได้' });
  }
});



app.get('/api/orders', async (req: Request, res: Response) => {
  try {
    let user_id = req.query.user_id as string;
    
    // ถ้าไม่ส่ง user_id มา ให้ลองอ่านจาก Authorization header
    if (!user_id) {
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
          user_id = String(decoded.userId);
        } catch (e) {
          // ignore, will fail below
        }
      }
    }

    console.log('🔍 Loading orders for user:', user_id);
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ user_id'
      });
    }
    
    const userId = parseInt(user_id);
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'user_id ไม่ถูกต้อง'
      });
    }
    
    // ดึงคำสั่งซื้อของ user
    const orders = await prisma.orders.findMany({
      where: { user_id: userId },
      include: {
        user_addresses: {
          select: {
            name: true,
            phone: true,
            address_line1: true,
            address_line2: true,
            district: true,
            city: true,
            province: true,
            postal_code: true
          }
        },
        order_items: {
          include: {
            products: {
              select: {
                id: true,
                name: true,
                image_url: true,
                price: true
              }
            }
          }
        },
        payment_proofs: {
          select: {
            id: true,
            file_path: true,
            status: true,
            uploaded_at: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    
    // จัดรูปแบบข้อมูล
    const formattedOrders = orders.map(order => ({
      id: order.id,
      order_number: order.order_number,
      order_status: order.order_status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      total_amount: Number(order.total_amount),
      subtotal: Number(order.subtotal),
      shipping_fee: Number(order.shipping_fee),
      discount: Number(order.discount),
      tracking_number: order.tracking_number,
      shipping_company: order.shipping_company,
      estimated_delivery: order.estimated_delivery,
      notes: order.notes,
      coupon_code: order.coupon_code,
      created_at: order.created_at,
      updated_at: order.updated_at,
      
      // ที่อยู่จัดส่ง
      shipping_address: order.user_addresses ? {
        name: order.user_addresses.name,
        phone: order.user_addresses.phone,
        full_address: `${order.user_addresses.address_line1}${order.user_addresses.address_line2 ? ' ' + order.user_addresses.address_line2 : ''} ${order.user_addresses.district} ${order.user_addresses.city} ${order.user_addresses.province} ${order.user_addresses.postal_code}`
      } : null,
      
      // รายการสินค้า
      items: order.order_items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name || 'ไม่ระบุ',
        quantity: item.quantity,
        price: Number(item.price),
        total: Number(item.total),
        image_url: item.products?.image_url
      })),
      
      // หลักฐานการชำระเงิน
      payment_proofs: order.payment_proofs,
      
      // สถิติ
      summary: {
        total_items: order.order_items.length,
        total_quantity: order.order_items.reduce((sum, item) => sum + item.quantity, 0),
        has_payment_proof: order.payment_proofs.length > 0
      }
    }));
    
    console.log(`✅ Found ${orders.length} orders for user ${userId}`);
    
    res.json({
      success: true,
      data: formattedOrders,
      total: orders.length
    });
    
  } catch (error) {
    console.error('❌ Error loading user orders:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงคำสั่งซื้อ'
    });
  }
});


// แทนที่โค้ดเดิมใน POST /api/orders 
// แก้ไขใน src/index.ts ส่วน POST /api/orders
app.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const {
      user_id,
      address_id, 
      total_amount,
      payment_method,
      payment_status = 'pending',
      order_status = 'pending', 
      items,
      shipping_fee = 0,
      discount_amount = 0,
      coupon_code,
      notes
    } = req.body;

    console.log('Creating new order:', req.body);

    // แปลงชนิดข้อมูลให้ปลอดภัย
    const uid = Number(user_id);
    const aid = Number(address_id);
    const totalNum = parseFloat(String(total_amount));
    const shipNum = parseFloat(String(shipping_fee || 0)) || 0;
    const discNum = parseFloat(String(discount_amount || 0)) || 0;

    const safeItems = Array.isArray(items)
      ? items
          .map((it: any) => ({
            product_id: Number(it?.product_id ?? it?.id ?? it?.productId ?? it?.product?.id),
            quantity: Number(it?.quantity),
            price: Number(it?.price ?? it?.unit_price ?? it?.product?.price),
          }))
          .filter(
            (it: any) =>
              Number.isFinite(it.product_id) && it.product_id > 0 &&
              Number.isFinite(it.quantity) && it.quantity > 0 &&
              Number.isFinite(it.price) && it.price >= 0
          )
      : [];

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!uid || !aid || !Number.isFinite(totalNum) || safeItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่ครบถ้วน: ต้องมี user_id, address_id, total_amount และ items'
      });
    }

    // ✅ ตรวจสอบสต็อกก่อนสร้างคำสั่งซื้อ
    console.log('🔍 Checking stock availability...');
    for (const item of safeItems) {
      const product = await prisma.product.findUnique({
        where: { id: item.product_id }
      });

      if (!product) {
        return res.status(400).json({
          success: false,
          message: `ไม่พบสินค้า ID: ${item.product_id}`
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `สินค้า "${product.name}" มีสต็อกไม่เพียงพอ (เหลือ ${product.stock} ชิ้น)`
        });
      }
    }

    // ตรวจสอบว่า user และ address มีอยู่จริง
    const [userExists, addressExists] = await Promise.all([
      prisma.users.findUnique({ where: { id: uid } }),
      prisma.user_addresses.findUnique({ where: { id: aid } })
    ]);

    if (!userExists) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูลผู้ใช้'
      });
    }

    if (!addressExists) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบที่อยู่จัดส่ง'
      });
    }

    // สร้าง order number
    const orderNumber = `ORD${Date.now()}`;
    console.log('🏷️ Generated order number:', orderNumber);

    // คำนวณ subtotal
  const calculatedSubtotal = totalNum - shipNum + discNum;

    // ✅ ใช้ Transaction เพื่อให้การสร้างคำสั่งซื้อและการตัดสต็อกเป็น atomic operation
    const result = await prisma.$transaction(async (prisma) => {
      // สร้าง order ใหม่
      const newOrder = await prisma.orders.create({
        data: {
          order_number: orderNumber,
          user_id: uid,
          address_id: aid,
          total_amount: totalNum,
          subtotal: calculatedSubtotal,
          shipping_fee: shipNum || 0,
          discount: discNum || 0,
          payment_method,
          payment_status,
          order_status,
          coupon_code: coupon_code || null,
          notes: notes || null,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      console.log('📋 Created order:', {
        id: newOrder.id,
        order_number: newOrder.order_number,
        total_amount: newOrder.total_amount
      });

      // เพิ่มรายการสินค้าในคำสั่งซื้อ และตัดสต็อก
      if (safeItems && safeItems.length > 0) {
        const orderItemsData = safeItems.map((item: any) => ({
          order_id: newOrder.id,
          product_id: item.product_id,
          quantity: Number(item.quantity),
          price: Number(item.price),
          total: Number(item.price) * Number(item.quantity)
        }));

        // เพิ่ม order items
        await prisma.order_items.createMany({
          data: orderItemsData
        });

        // ✅ ตัดสต็อกสินค้าทีละรายการ
        for (const item of safeItems) {
          const productId = item.product_id;
          const quantity = Number(item.quantity);

          console.log(`📦 Reducing stock for product ${productId} by ${quantity}`);

          // อัปเดตสต็อกสินค้า
          await prisma.product.update({
            where: { id: productId },
            data: {
              stock: {
                decrement: quantity // ลดสต็อกตามจำนวนที่สั่ง
              },
              updated_at: new Date()
            }
          });

          // ✅ บันทึกประวัติการเคลื่อนไหวสต็อก (ถ้ามีตาราง stock_movements)
            try {
              // ดึงข้อมูลสต็อกก่อนและหลังการเปลี่ยนแปลง
              const productBeforeUpdate = await prisma.product.findUnique({
                where: { id: productId },
                select: { stock: true }
              });
              
              const quantityAfterUpdate = productBeforeUpdate?.stock || 0;
              const quantityBefore = quantityAfterUpdate + quantity;
              const quantityAfter = quantityAfterUpdate;
              
            await prisma.stock_movements.create({
              data: {
                product_id: productId,
                movement_type: 'out',
                quantity: quantity,
                quantity_before: quantityBefore,
                quantity_after: quantityAfter,
                reference_type: 'order',
                reference_id: newOrder.id,
                notes: `การสั่งซื้อ #${orderNumber}`,
                created_at: new Date(),
                // เพิ่ม relation ถ้าจำเป็น
               
              }
              });
          } catch (stockError) {
            console.warn('⚠️ Failed to create stock movement record:', stockError);
            // ไม่ให้ stock movement error ทำให้การสั่งซื้อล้มเหลว
          }

          // ✅ ตรวจสอบและสร้างแจ้งเตือนสต็อกต่ำ (ถ้ามี)
          try {
            const updatedProduct = await prisma.product.findUnique({
              where: { id: productId },
              include: { inventory_setting: true }
            });

            if (updatedProduct) {
              const minStock = updatedProduct.inventory_setting?.min_stock || 5;
              await checkAndCreateAlert(productId, updatedProduct.stock, minStock);
            }
          } catch (alertError) {
            console.warn('⚠️ Failed to create inventory alert:', alertError);
          }
        }

        console.log('✅ Stock updated successfully for all items');
      }

      return newOrder;
    });

    console.log('✅ Order created successfully with stock reduction:', result.id);

    // 📧 ส่งอีเมลแจ้งเตือนออเดอร์ใหม่ (ไม่รอผลลัพธ์เพื่อไม่ให้ช้า)
    (async () => {
      try {
        // ดึงข้อมูลเพิ่มเติมสำหรับส่งอีเมล
        const orderWithDetails = await prisma.orders.findUnique({
          where: { id: result.id },
          include: {
            order_items: {
              include: {
                products: true
              }
            },
            user_addresses: true,
            users: true
          }
        });

        if (orderWithDetails) {
          const emailData = {
            orderId: orderWithDetails.id,
            orderNumber: orderWithDetails.order_number,
            customerName: orderWithDetails.user_addresses.name,
            phone: orderWithDetails.user_addresses.phone,
            address: `${orderWithDetails.user_addresses.address_line1}${orderWithDetails.user_addresses.address_line2 ? ' ' + orderWithDetails.user_addresses.address_line2 : ''}, ${orderWithDetails.user_addresses.district}, ${orderWithDetails.user_addresses.city}, ${orderWithDetails.user_addresses.province} ${orderWithDetails.user_addresses.postal_code}`,
            totalAmount: Number(orderWithDetails.total_amount),
            subtotal: Number(orderWithDetails.subtotal),
            shippingFee: Number(orderWithDetails.shipping_fee),
            discount: Number(orderWithDetails.discount),
            items: orderWithDetails.order_items.map((item: any) => ({
              name: item.products.name,
              quantity: item.quantity,
              price: Number(item.price)
            }))
          };

          const emailResult = await sendOrderNotification(emailData);
          if (emailResult.success) {
            console.log('✅ Order notification email sent successfully');
          } else {
            console.warn('⚠️ Failed to send order notification email:', emailResult.error);
          }
        }
      } catch (emailError) {
        console.error('❌ Error sending order notification email:', emailError);
        // ไม่ให้ error ของอีเมลทำให้การสร้างออเดอร์ล้มเหลว
      }
    })();

    // ส่ง response
    res.json({
      success: true,
      message: 'สร้างคำสั่งซื้อสำเร็จ',
      order: {
        id: result.id,
        order_number: result.order_number,
        total_amount: Number(result.total_amount),
        subtotal: Number(result.subtotal),
        shipping_fee: Number(result.shipping_fee),
        discount: Number(result.discount),
        payment_method: result.payment_method,
        payment_status: result.payment_status,
        order_status: result.order_status,
        created_at: result.created_at
      },
      order_id: result.id,
      order_number: result.order_number
    });

  } catch (error: any) {
    console.error('❌ Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างคำสั่งซื้อ',
      error: (error as any)?.message,
      code: (error as any)?.code
    });
  }
});

// ✅ ฟังก์ชันสำหรับตรวจสอบและสร้างแจ้งเตือนสต็อกต่ำ
async function checkAndCreateAlert(productId: number, currentStock: number, minStock: number) {
  try {
    // ลบแจ้งเตือนเก่าที่ไม่จำเป็นแล้ว
    await prisma.inventory_alerts.updateMany({
      where: {
        product_id: productId,
        alert_type: { in: ['low_stock', 'out_of_stock'] },
        is_active: true
      },
      data: { is_active: false }
    });
    
    let alertType = '';
    let alertLevel = 'info';
    let title = '';
    let message = '';
    
    if (currentStock === 0) {
      alertType = 'out_of_stock';
      alertLevel = 'critical';
      title = 'สินค้าหมด';
      message = 'สินค้าหมดแล้ว ต้องเติมสต็อกด่วน';
    } else if (currentStock <= minStock) {
      alertType = 'low_stock';
      alertLevel = 'warning';
      title = 'สต็อกเหลือน้อย';
      message = `สต็อกเหลือ ${currentStock} ชิ้น (ขั้นต่ำ ${minStock} ชิ้น)`;
    }
    
    if (alertType) {
      // ตรวจสอบว่ามีแจ้งเตือนประเภทเดียวกันอยู่แล้วหรือไม่
      const existingAlert = await prisma.inventory_alerts.findFirst({
        where: {
          product_id: productId,
          alert_type: alertType,
          is_active: true,
          is_read: false
        }
      });
      
      if (!existingAlert) {
        await prisma.inventory_alerts.create({
          data: {
            product_id: productId,
            alert_type: alertType,
            alert_level: alertLevel,
            title: title,
            message: message,
            current_stock: currentStock,
            threshold_value: minStock,
            priority: alertLevel === 'critical' ? 5 : alertLevel === 'warning' ? 3 : 1
          }
        });
        
        console.log(`✅ Created ${alertType} alert for product ${productId}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error creating alert:', error);
    throw error;
  }
}
// เพิ่มใน src/index.ts ในส่วน API ROUTES

// ===========================================
// ORDER TRACKING API (สำหรับ Frontend)
// ===========================================

// ลบ/แทนที่บล็อคเดิมของ /api/categories/:slug/products และ /api/categories/:param/products ด้วยบล็อคนี้
app.get('/api/categories/:param/products', async (req, res) => {
  const raw = String(req.params.param || '');
  const decoded = decodeURIComponent(raw);
  const paramSlug = toSlug(decoded);
  try {
    let category = null;

    // ถ้าเป็นตัวเลข ใช้ id
    if (/^\d+$/.test(decoded)) {
      category = await prisma.categories.findUnique({ where: { id: Number(decoded) } });
    }

    // ไม่ใช่ตัวเลข หรือหา id ไม่เจอ -> ลองด้วย slug/name
    if (!category) {
      // หาโดย slug ใน DB ก่อน (หลัง backfill)
      category = await prisma.categories.findFirst({
        where: { OR: [{ slug: decoded }, { slug: paramSlug }, { name: decoded }] }
      });
    }

    if (!category) {
      console.warn('[categories/:param/products] not found', { raw, decoded, paramSlug });
      return res.status(404).json({ success: false, message: 'ไม่พบหมวดหมู่' });
    }

      const products = await prisma.product.findMany({
        where: { product_categories: { some: { category_id: category.id } } , deleted_at: null},
        orderBy: { id: 'desc' },
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
          image_url: true,
          image_url_two: true,
          image_url_three: true,
          image_url_four: true,
    },
  });

     return res.json({
    success: true,
    category: { id: category.id, name: category.name, slug: category.slug || toSlug(category.name) },
    products: products.map(p => ({
      ...p,
      price: p.price != null ? Number(p.price as any) : null
    }))
  });
  } catch (error) {
    console.error('Error fetching category products:', error);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});




// GET /api/orders/{orderId}/items - ดึงรายการสินค้าในคำสั่งซื้อ
app.get('/api/orders/:orderId/items', async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.orderId);
    
    console.log('🛒 Loading order items for order:', orderId);
    
    if (isNaN(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Order ID ไม่ถูกต้อง'
      });
    }
    
    // ตรวจสอบว่าคำสั่งซื้อมีอยู่จริง
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: { id: true, order_number: true, order_status: true }
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบคำสั่งซื้อที่ระบุ'
      });
    }
    
    // ดึงรายการสินค้า
    const orderItems = await prisma.order_items.findMany({
      where: { order_id: orderId },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            description: true,
            image_url: true,
            image_url_two: true,
            image_url_three: true,
            image_url_four: true,
            price: true,
            stock: true
          }
        }
      },
      orderBy: { id: 'asc' }
    });
    
    // จัดรูปแบบข้อมูล
    const formattedItems = orderItems.map(item => {
      const product = item.products;
      
      // หาภาพที่ใช้แสดง
      let displayImage = null;
      if (product) {
        if (product.image_url) {
          displayImage = product.image_url;
        } else if (product.image_url_two) {
          displayImage = product.image_url_two;
        } else if (product.image_url_three) {
          displayImage = product.image_url_three;
        } else if (product.image_url_four) {
          displayImage = product.image_url_four;
        }
      }
      
      return {
        id: item.id,
        product_id: item.product_id,
        product_name: product?.name || 'ไม่ระบุชื่อสินค้า',
        product_description: product?.description || '',
        quantity: item.quantity,
        price: Number(item.price),
        total: Number(item.total),
        
        // ภาพสินค้า
        image_url: displayImage,
        images: product ? {
          primary: product.image_url,
          secondary: product.image_url_two,
          tertiary: product.image_url_three,
          quaternary: product.image_url_four
        } : null,
        
        // ข้อมูลเสริม
        product_stock: product?.stock || 0,
        product_current_price: product?.price ? Number(product.price) : Number(item.price),
        product_exists: !!product,
        has_image: !!displayImage
      };
    });
    
    console.log(`✅ Found ${orderItems.length} items for order ${orderId}`);
    
    
    res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          order_number: order.order_number,
          order_status: order.order_status
        },
        items: formattedItems,
        summary: {
          total_items: formattedItems.length,
          total_quantity: formattedItems.reduce((sum, item) => sum + item.quantity, 0),
          items_with_images: formattedItems.filter(item => item.has_image).length
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error loading order items:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงรายการสินค้า'
    });
  }
});





app.get('/api/orders/track/:orderNumber', async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

    console.log('🔍 Tracking order:', orderNumber);

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุหมายเลขคำสั่งซื้อ'
      });
    }

    // ค้นหาคำสั่งซื้อด้วย order_number พร้อมข้อมูลครบถ้วน
    const order = await prisma.orders.findUnique({
      where: { order_number: orderNumber },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        user_addresses: {
          select: {
            id: true,
            name: true,
            phone: true,
            address_line1: true,
            address_line2: true,
            district: true,
            city: true,
            province: true,
            postal_code: true
          }
        },
        order_items: {
          include: {
            products: {
              select: {
                id: true,
                name: true,
                description: true,
                image_url: true,
                image_url_two: true,
                image_url_three: true,
                image_url_four: true,
                price: true,
                stock: true
              }
            }
          },
          orderBy: {
            id: 'asc'
          }
        },
        payment_proofs: {
          select: {
            id: true,
            file_path: true,
            original_filename: true,
            status: true,
            uploaded_at: true,
            notes: true
          },
          orderBy: {
            uploaded_at: 'desc'
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูลคำสั่งซื้อ'
      });
    }

    console.log('📦 Order found:', {
      id: order.id,
      order_number: order.order_number,
      items_count: order.order_items.length
    });

    // Debug: แสดงข้อมูล order_items
    console.log('🛒 Order items details:', order.order_items.map(item => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.products?.name,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      image_url: item.products?.image_url,
      has_product: !!item.products
    })));

    

    // ส่งข้อมูลคำสั่งซื้อกลับไป พร้อมข้อมูลครบถ้วน
    const response = {
      success: true,
      data: {
        // ข้อมูลคำสั่งซื้อ
        id: order.id,
        order_number: order.order_number,
        order_status: order.order_status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        
        // ยอดเงิน
        total_amount: Number(order.total_amount),
        subtotal: Number(order.subtotal),
        shipping_fee: Number(order.shipping_fee),
        discount: Number(order.discount),
        
        // วันที่
        created_at: order.created_at,
        updated_at: order.updated_at,
        
        // ข้อมูลการจัดส่ง
        tracking_number: order.tracking_number,
        shipping_company: order.shipping_company,
        estimated_delivery: order.estimated_delivery,
        
        // หมายเหตุ
        notes: order.notes,
        coupon_code: order.coupon_code,
        
        // ข้อมูลลูกค้า
        customer: {
          id: order.users?.id,
          name: order.users?.name || 'ไม่ระบุ',
          email: order.users?.email || 'ไม่ระบุ'
        },
        
        // ที่อยู่จัดส่ง
        shipping_address: order.user_addresses ? {
          id: order.user_addresses.id,
          name: order.user_addresses.name,
          phone: order.user_addresses.phone,
          address_line1: order.user_addresses.address_line1,
          address_line2: order.user_addresses.address_line2,
          district: order.user_addresses.district,
          city: order.user_addresses.city,
          province: order.user_addresses.province,
          postal_code: order.user_addresses.postal_code,
          full_address: `${order.user_addresses.address_line1}${order.user_addresses.address_line2 ? ' ' + order.user_addresses.address_line2 : ''} ${order.user_addresses.district} ${order.user_addresses.city} ${order.user_addresses.province} ${order.user_addresses.postal_code}`
        } : null,
        
        // 🛒 รายการสินค้า (แก้ไขส่วนนี้!)
        items: order.order_items.map(item => {
          const product = item.products;
          
          // หาภาพที่ใช้แสดง (เลือกภาพแรกที่มี)
          let displayImage = null;
          if (product) {
            if (product.image_url) {
              displayImage = product.image_url;
            } else if (product.image_url_two) {
              displayImage = product.image_url_two;
            } else if (product.image_url_three) {
              displayImage = product.image_url_three;
            } else if (product.image_url_four) {
              displayImage = product.image_url_four;
            }
          }
          
          return {
            id: item.id,
            product_id: item.product_id,
            product_name: product?.name || 'ไม่ระบุชื่อสินค้า',
            product_description: product?.description || '',
            quantity: item.quantity,
            price: Number(item.price),
            total: Number(item.total),
            
            // ✅ ภาพสินค้า - ส่งทุกภาพที่มี
            image_url: displayImage, // ภาพหลักที่จะแสดง
            images: product ? {
              primary: product.image_url,
              secondary: product.image_url_two,
              tertiary: product.image_url_three,
              quaternary: product.image_url_four
            } : null,
            
            // ข้อมูลเสริม
            product_stock: product?.stock || 0,
            product_current_price: product?.price ? Number(product.price) : Number(item.price),
            
            // สถานะสินค้า
            product_exists: !!product,
            has_image: !!displayImage
          };
        }),
        
        // หลักฐานการชำระเงิน
        payment_proofs: order.payment_proofs.map(proof => ({
          id: proof.id,
          file_path: proof.file_path,
          original_filename: proof.original_filename,
          status: proof.status,
          uploaded_at: proof.uploaded_at,
          notes: proof.notes
        })),
        
        // สถิติ
        summary: {
          total_items: order.order_items.length,
          total_quantity: order.order_items.reduce((sum, item) => sum + item.quantity, 0),
          has_payment_proof: order.payment_proofs.length > 0,
          items_with_images: order.order_items.filter(item => {
            const product = item.products;
            return product && (product.image_url || product.image_url_two || product.image_url_three || product.image_url_four);
          }).length
        }
      }
    };

    console.log('✅ Response prepared:', {
      order_number: response.data.order_number,
      items_count: response.data.items.length,
      items_with_images: response.data.summary.items_with_images,
      payment_proofs_count: response.data.payment_proofs.length
    });

    // Debug: แสดงข้อมูลภาพของแต่ละ item
    console.log('🖼️ Items image info:', response.data.items.map(item => ({
      product_name: item.product_name,
      has_image: item.has_image,
      image_url: item.image_url ? item.image_url.substring(0, 50) + '...' : null
    })));

    res.json(response);   
    
  } catch (error) {
    console.error('❌ Error tracking order:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการติดตามคำสั่งซื้อ',
      error: process.env.NODE_ENV === 'development' ? (error as any).message : undefined
    });
  }
});

// GET /api/orders/search - ค้นหาคำสั่งซื้อด้วยเบอร์โทรหรืออีเมล
app.get('/api/orders/search', async (req: Request, res: Response) => {
  try {
    const { phone, email, order_number } = req.query;

    console.log('🔍 Searching orders with:', { phone, email, order_number });

    if (!phone && !email && !order_number) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุเบอร์โทร อีเมล หรือหมายเลขคำสั่งซื้อ'
      });
    }

    // สร้าง where condition
    const whereCondition: any = {};

    if (order_number) {
      whereCondition.order_number = order_number;
    } else {
      const userConditions: any = {};
      
      if (email) {
        userConditions.email = email;
      }

      const addressConditions: any = {};
      
      if (phone) {
        addressConditions.phone = phone;
      }

      whereCondition.OR = [];

      if (Object.keys(userConditions).length > 0) {
        whereCondition.OR.push({
          users: userConditions
        });
      }

      if (Object.keys(addressConditions).length > 0) {
        whereCondition.OR.push({
          user_addresses: addressConditions
        });
      }
    }

    // ค้นหาคำสั่งซื้อ
    const orders = await prisma.orders.findMany({
      where: whereCondition,
      include: {
        users: {
          select: {
            name: true,
            email: true
          }
        },
        user_addresses: {
          select: {
            name: true,
            phone: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 10 // จำกัดผลลัพธ์ไม่เกิน 10 รายการ
    });

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบคำสั่งซื้อที่ตรงกับข้อมูลที่ระบุ'
      });
    }

    // จัดรูปแบบข้อมูล
    const formattedOrders = orders.map(order => ({
      id: order.id,
      order_number: order.order_number,
      order_status: order.order_status,
      payment_status: order.payment_status,
      total_amount: Number(order.total_amount),
      created_at: order.created_at,
      customer_name: order.users?.name || order.user_addresses?.name || 'ไม่ระบุ',
      customer_email: order.users?.email || 'ไม่ระบุ',
      customer_phone: order.user_addresses?.phone || 'ไม่ระบุ'
    }));

    console.log(`✅ Found ${orders.length} orders`);

    res.json({
      success: true,
      data: formattedOrders,
      total: orders.length
    });

  } catch (error) {
    console.error('❌ Error searching orders:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการค้นหาคำสั่งซื้อ'
    });
  }
});

// POST /api/orders/:orderNumber/upload-payment - อัปโหลดหลักฐานการชำระเงิน
app.post('/api/orders/:orderNumber/upload-payment', handleFileUploadWithBusboy, async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const files = (req as any).files as any[];
    const { notes } = req.body;

    console.log('📤 Uploading payment proof for order:', orderNumber);

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาเลือกไฟล์หลักฐานการชำระเงิน'
      });
    }

    // ตรวจสอบคำสั่งซื้อ
    const order = await prisma.orders.findUnique({
      where: { order_number: orderNumber }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบคำสั่งซื้อหมายเลขนี้'
      });
    }

    const file = files[0];

    // ตรวจสอบไฟล์
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น'
      });
    }

    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'ไฟล์มีขนาดใหญ่เกิน 5MB'
      });
    }

    // อัปโหลดไป Supabase
    const fileExt = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `payment_${order.id}_${Date.now()}.${fileExt}`;

    const { data, error } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET!)
      .upload(`payment-proofs/${fileName}`, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({
        success: false,
        message: 'ไม่สามารถอัปโหลดไฟล์ได้'
      });
    }

    // สร้าง Public URL
    const { data: publicUrlData } = supabase
      .storage
      .from(process.env.SUPABASE_BUCKET!)
      .getPublicUrl(`payment-proofs/${fileName}`);

    const fileUrl = publicUrlData.publicUrl;

    // บันทึกลงฐานข้อมูล
    const paymentProof = await prisma.payment_proofs.create({
      data: {
        order_id: order.id,
        file_path: fileUrl,
        original_filename: file.originalname,
        file_size: file.size,
        notes: notes || null,
        status: 'pending'
      }
    });

    console.log('✅ Payment proof uploaded successfully');

    res.json({
      success: true,
      message: 'อัปโหลดหลักฐานการชำระเงินสำเร็จ',
      data: {
        id: paymentProof.id,
        file_path: paymentProof.file_path,
        uploaded_at: paymentProof.uploaded_at
      }
    });

  } catch (error) {
    console.error('❌ Error uploading payment proof:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปโหลดหลักฐานการชำระเงิน'
    });
  }
});


// ==============================
// API ส่วนของ Login เข้า Addmin 
// ==============================

// แก้ไข POST /api/admin/login
app.post('/api/admin/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    console.log('🔐 Admin login attempt:', username);

    if (!username || !password) {
      return res.json({ 
        success: false, 
        message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' 
      });
    }

    // ค้นหาผู้ใช้
    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { email: username },
          { name: username }
        ],
        role: 'admin',
        is_active: true
      }
    });

    if (!user) {
      return res.json({ 
        success: false, 
        message: 'ไม่พบผู้ใช้หรือไม่มีสิทธิ์เข้าถึง' 
      });
    }

    // เช็ค password
    const isPasswordValid = await bcrypt.compare(password, user.password || '');
    if (!isPasswordValid) {
      return res.json({ 
        success: false, 
        message: 'รหัสผ่านไม่ถูกต้อง' 
      });
    }

    // สร้าง JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        role: user.role, 
        email: user.email 
      },
      process.env.JWT_SECRET || 'admin_token_secret',
      { expiresIn: '1d' }
    );

    // ✅ แก้ไขชื่อ cookie ให้ตรงกัน
    res.cookie('admin_token', token, { 
      httpOnly: true, 
      secure: false,
      maxAge: 24 * 60 * 60 * 1000 // 1 วัน
    });
    
    console.log('✅ Admin login successful:', user.email);
    
    res.json({ 
      success: true, 
      message: 'เข้าสู่ระบบสำเร็จ', 
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error: any) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในระบบ' 
    });
  }
});

// ✅ แก้ไข logout API
app.post('/api/admin/logout', (_req: Request, res: Response) => {
  res.clearCookie('admin_token'); // ใช้ชื่อเดียวกัน
  res.json({ 
    success: true, 
    message: 'ออกจากระบบแล้ว' 
  });
});

// ✅ เพิ่ม API เช็ค session
app.get('/api/admin/me', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.admin_token;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'ไม่ได้เข้าสู่ระบบ'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'admin_token_secret') as any;
    
    // ดึงข้อมูล user ล่าสุด
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true
      }
    });
    
    if (!user || !user.is_active || user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'บัญชีไม่ถูกต้องหรือไม่มีสิทธิ์'
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(401).json({
      success: false,
      message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่'
    });
  }
});

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('admin_token_secret');
  res.json({ success: true });
});


// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Express Server running on port ${PORT}`);
  console.log(`🎛️  Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
  
  // Test Supabase connection
  console.log('Testing Supabase connection...');
  const connectionTest = await testSupabaseConnection();
  if (!connectionTest) {
    console.warn('⚠️  Supabase connection failed. Image upload may not work properly.');
  } else {
    console.log('✅ Supabase connection successful');
    
    // ตรวจสอบ bucket
    if (process.env.SUPABASE_BUCKET) {
      const bucketReady = await ensureBucketExists(process.env.SUPABASE_BUCKET);
      if (bucketReady) {
        console.log('✅ Storage bucket ready');
      } else {
        console.warn('⚠️  Storage bucket not ready');
      }
    }
  }
});

// Handle shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app;