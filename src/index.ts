import express, { Request, Response, NextFunction } from 'express';

import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import Busboy from 'busboy';
import fs from 'fs';
import session from 'express-session';
import { supabase, testSupabaseConnection, ensureBucketExists } from './utils/supabase';

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

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/static', express.static(path.join(__dirname, '../public')));
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));


app.use('/js', express.static(path.join(__dirname, '../public/admin/js'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));
app.use(session({
  secret: process.env.JWT_SECRET || 'admin-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
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
      files.push({
        fieldname,
        originalname: filename,
        encoding,
        mimetype: mimeType,
        buffer: Buffer.concat(chunks)
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

// Admin panel routes - สำหรับหน้าอื่นๆ
app.get(/^\/admin(\/.*)?$/, (req: Request, res: Response) => {
  // ส่ง index.html สำหรับหน้าทั้งหมด (ยกเว้น login)
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// ===========================================
// API ROUTES (ไม่ต้อง auth แล้ว)
// ===========================================

app.use('/static', express.static(path.join(__dirname, '../public')));

// Admin panel static files
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// Admin routes - ส่ง index.html สำหรับทุก path ที่เริ่มด้วย /admin
app.get(/^\/admin(\/.*)?$/, (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
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

// API สำหรับดึงสินค้าทั้งหมด
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: {
        id: 'desc'
      },
      take: 10 // เอาแค่ 10 รายการล่าสุด
    });
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

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
      include: {
        _count: {
          select: {
            product_categories: true
          }
        }
      }
    });
    
    // เพิ่มจำนวนสินค้าในแต่ละหมวดหมู่
    const categoriesWithCount = categories.map(category => ({
      ...category,
      products_count: category._count.product_categories
    }));
    
    res.json(categoriesWithCount);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// API สำหรับสร้างหมวดหมู่ใหม่
app.post('/api/categories', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const { name, image_url_cate, is_active } = req.body; // เปลี่ยนจาก image_url
      
      // ตรวจสอบข้อมูลที่จำเป็น
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          error: 'ชื่อหมวดหมู่เป็นข้อมูลที่จำเป็น' 
        });
      }

      // ตรวจสอบว่าชื่อหมวดหมู่ซ้ำหรือไม่
      const existingCategory = await prisma.categories.findFirst({
        where: { name }
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          error: 'ชื่อหมวดหมู่นี้มีอยู่แล้ว'
        });
      }
      
      // สร้างหมวดหมู่ใหม่
      const category = await prisma.categories.create({
        data: {
          name,
          image_url_cate: image_url_cate || null, // เปลี่ยนจาก image_url
          is_active: is_active !== undefined ? is_active : true
        }
      });

      res.json({ success: true, category });
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create category' 
      });
    }
  })().catch(next);
});

// API สำหรับดึงหมวดหมู่ตาม ID
app.get('/api/categories/:id', (req: Request, res: Response, next) => {
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
app.put('/api/categories/:id', (req: Request, res: Response, next) => {
  (async () => {
    try {
      const categoryId = parseInt(req.params.id);
      const { name, image_url_cate, is_active } = req.body; // เปลี่ยนจาก image_url

      if (isNaN(categoryId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category ID'
        });
      }

      // ตรวจสอบว่าหมวดหมู่มีอยู่หรือไม่
      const existingCategory = await prisma.categories.findUnique({
        where: { id: categoryId }
      });

      if (!existingCategory) {
        return res.status(404).json({
          success: false,
          error: 'Category not found'
        });
      }

      // ตรวจสอบชื่อซ้ำ (ยกเว้นรายการปัจจุบัน)
      if (name) {
        const duplicateName = await prisma.categories.findFirst({
          where: {
            name,
            id: { not: categoryId }
          }
        });

        if (duplicateName) {
          return res.status(400).json({
            success: false,
            error: 'ชื่อหมวดหมู่นี้มีอยู่แล้ว'
          });
        }
      }

      // อัปเดตหมวดหมู่
      const category = await prisma.categories.update({
        where: { id: categoryId },
        data: {
          name,
          image_url_cate: image_url_cate || null, // เปลี่ยนจาก image_url
          is_active: is_active !== undefined ? is_active : true
        }
      });

      res.json({ success: true, category });
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
app.delete('/api/categories/:id', (req: Request, res: Response, next) => {
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
        return res.status(500).json({
          success: false,
          error: 'Failed to initialize storage bucket'
        });
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
            throw new Error(`Upload failed: ${error.message}`);
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

    // ลบความสัมพันธ์กับหมวดหมู่ก่อน (ถ้ามี)
    await prisma.product_categories.deleteMany({
      where: { product_id: productId }
    });

    // ลบสินค้า
    await prisma.product.delete({
      where: { id: productId }
    });

    res.json({ success: true });
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

// Update checkAndCreateAlert function to handle errors better
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
    throw error; // Re-throw เพื่อให้ caller handle ได้
  }
}



// ===========================================
// API ROUTES - Protected Routes
// ===========================================

// Admin panel routes
app.get(/^\/admin(\/.*)?$/, (req: Request, res: Response) => {
  // ส่ง index.html สำหรับหน้าทั้งหมด (ไม่มี login แล้ว)
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});



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
    const { code, order_amount, user_id, email } = req.body;

    console.log('🎫 Validating coupon:', code, 'for amount:', order_amount);

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาใส่รหัสคูปอง'
      });
    }

    if (!order_amount || order_amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ยอดสั่งซื้อไม่ถูกต้อง'
      });
    }

    // Find coupon
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบรหัสคูปองที่ระบุ'
      });
    }

    // Check if coupon is active
    if (!coupon.is_active) {
      return res.status(400).json({
        success: false,
        message: 'คูปองนี้ถูกปิดใช้งานแล้ว'
      });
    }

    // Check date range
    const now = new Date();
    if (coupon.start_date > now) {
      return res.status(400).json({
        success: false,
        message: 'คูปองนี้ยังไม่เริ่มใช้งาน'
      });
    }

    if (coupon.end_date < now) {
      return res.status(400).json({
        success: false,
        message: 'คูปองนี้หมดอายุแล้ว'
      });
    }

    // Check usage limit
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return res.status(400).json({
        success: false,
        message: 'คูปองนี้ถูกใช้งานครบจำนวนแล้ว'
      });
    }

    // Check minimum order amount
    if (coupon.min_order_amount && order_amount < coupon.min_order_amount) {
      return res.status(400).json({
        success: false,
        message: `ยอดสั่งซื้อขั้นต่ำ ${Number(coupon.min_order_amount).toLocaleString('th-TH')} บาท`
      });
    }

    // Check usage per user
    if (coupon.usage_limit_per_user && (user_id || email)) {
      const userUsageCount = await prisma.couponUsage.count({
        where: {
          coupon_id: coupon.id,
          OR: [
            ...(user_id ? [{ user_id: user_id }] : []),
            ...(email ? [{ email: email }] : [])
          ]
        }
      });

      if (userUsageCount >= coupon.usage_limit_per_user) {
        return res.status(400).json({
          success: false,
          message: 'คุณใช้คูปองนี้ครบจำนวนแล้ว'
        });
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = (order_amount * Number(coupon.discount_value)) / 100;
      if (coupon.max_discount_amount && discountAmount > Number(coupon.max_discount_amount)) {
        discountAmount = Number(coupon.max_discount_amount);
      }
    } else {
      discountAmount = Number(coupon.discount_value);
    }

    // Make sure discount doesn't exceed order amount
    if (discountAmount > order_amount) {
      discountAmount = order_amount;
    }

    console.log('✅ Coupon validation successful, discount:', discountAmount);

    res.json({
      success: true,
      data: {
        coupon_id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_amount: discountAmount,
        final_amount: order_amount - discountAmount
      },
      message: `ใช้คูปอง ${coupon.code} ประหยัด ${discountAmount.toLocaleString('th-TH')} บาท`
    });

  } catch (error) {
    console.error('❌ Error validating coupon:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการตรวจสอบคูปอง: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
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





// API สำหรับคำนวณค่าจัดส่ง
app.post('/api/calculate-shipping', async (req: Request, res: Response) => {
  try {
    const { items, destination = 'bangkok' } = req.body;
    
    let totalShippingCost = 0;
    const shippingDetails = [];
    
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          product_categories: {
            include: {
              categories: true
            }
          }
        }
      });
      
      if (!product) {
        continue;
      }
      
      let itemShippingCost = 0;
      let calculation = '';
      
      // 🐠 ตรวจสอบว่าเป็นการจัดส่งพิเศษหรือไม่
      if (product.has_special_shipping) {
        const baseCost = Number(product.special_shipping_base) || 80;
        const threshold = product.special_shipping_qty || 4;
        const extraCost = Number(product.special_shipping_extra) || 10;
        const quantity = item.quantity;
        
        if (quantity <= threshold) {
          itemShippingCost = baseCost;
          calculation = `${quantity} ตัว = ${baseCost} บาท (ค่าพื้นฐาน)`;
        } else {
          const extraItems = quantity - threshold;
          itemShippingCost = baseCost + (extraItems * extraCost);
          calculation = `${quantity} ตัว = ${baseCost} + (${extraItems}×${extraCost}) = ${itemShippingCost} บาท`;
        }
        
        shippingDetails.push({
          productName: product.name,
          quantity: quantity,
          shippingType: 'special',
          cost: itemShippingCost,
          calculation: calculation
        });
        
      } else {
        // การจัดส่งปกติ
        let cost = 0;
        switch (destination.toLowerCase()) {
          case 'bangkok':
          case 'กรุงเทพฯ':
            cost = Number(product.shipping_cost_bangkok) || 0;
            break;
          case 'provinces':
          case 'ต่างจังหวัด':
            cost = Number(product.shipping_cost_provinces) || 50;
            break;
          case 'remote':
          case 'เกาะ':
            cost = Number(product.shipping_cost_remote) || 100;
            break;
          default:
            cost = Number(product.shipping_cost_provinces) || 50;
        }
        
        itemShippingCost = cost;
        calculation = `${item.quantity} ชิ้น × ${cost} บาท = ${itemShippingCost} บาท`;
        
        shippingDetails.push({
          productName: product.name,
          quantity: item.quantity,
          shippingType: 'normal',
          cost: itemShippingCost,
          calculation: calculation
        });
      }
      
      totalShippingCost += itemShippingCost;
    }
    
    // ตรวจสอบการจัดส่งฟรี
    const orderTotal = items.reduce((sum: number, item: { price: number; quantity: number }) => sum + (item.price * item.quantity), 0);
    let freeShippingApplied = false;
    
    // ตรวจสอบเงื่อนไขจัดส่งฟรีจากสินค้าแต่ละชิ้น
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });
      
      if (product?.free_shipping_threshold && orderTotal >= Number(product.free_shipping_threshold)) {
        freeShippingApplied = true;
        break;
      }
    }
    
    if (freeShippingApplied) {
      totalShippingCost = 0;
    }
    
    res.json({
      success: true,
      data: {
        totalShippingCost,
        orderTotal,
        freeShippingApplied,
        destination,
        details: shippingDetails,
        summary: {
          message: freeShippingApplied 
            ? 'จัดส่งฟรี เนื่องจากยอดสั่งซื้อเกินเงื่อนไข' 
            : `ค่าจัดส่งรวม ${totalShippingCost} บาท`
        }
      }
    });
    
  } catch (error) {
    console.error('Error calculating shipping:', error);
    res.status(500).json({
      success: false,
      error: 'ไม่สามารถคำนวณค่าจัดส่งได้'
    });
  }
});



// ==============================
// API ส่วนของ Login เข้า Addmin 
// ==============================

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'กรุณาระบุชื่อผู้ใช้และรหัสผ่าน'
    });
  }

  // หา user จาก username หรือ email
  const user = await prisma.users.findFirst({
    where: {
      OR: [
        { name: username }
      ]
    }
  });

  if (!user) {
    return res.json({ success: false, message: 'ไม่พบผู้ใช้งานนี้' });
  }

  // เช็ค role ต้องเป็น admin
  if (user.role !== 'admin') {
    return res.json({ success: false, message: 'บัญชีนี้ไม่ใช่ผู้ดูแลระบบ' });
  }

  // เช็คสถานะ
  if (!user.is_active) {
    return res.json({ success: false, message: 'บัญชีนี้ถูกปิดใช้งาน' });
  }

  // เช็ค password
  const isPasswordValid = await bcrypt.compare(password, user.password || '');
  if (!isPasswordValid) {
    return res.json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
  }

  // สร้าง JWT (หรือจะใช้ session ก็ได้)
  const token = jwt.sign(
    { userId: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET || 'admin_token_secret',
    { expiresIn: '1d' }
  );

  // ส่ง token กลับ (หรือ set cookie)
  res.cookie('admin_token_secret', token, { httpOnly: true, secure: false });
  res.json({ success: true, message: 'เข้าสู่ระบบสำเร็จ', token });
});


app.use('/admin', (req, res, next) => {
  const token = req.cookies.admin_token;
  if (!token) {
    return res.redirect('/admin/login.html');
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'admin_token_secret') as { id: number; email: string; role: string };
    if (typeof decoded !== 'object' || decoded === null || (decoded as any).role !== 'admin') {
      return res.redirect('/admin/login.html');
    }
    req.user = decoded as { id: number; email: string; role: string };
    next();
  } catch (err) {
    return res.redirect('/admin/login.html');
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