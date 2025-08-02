import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { JwtPayload } from '../types';
import { NextRequest, NextResponse } from 'next/server';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
      };
    }
  }
}

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบ' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

    // แก้ไขตรงนี้: ตาราง user จริงใน Prisma คือ users (ไม่ใช่ user)
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ message: 'ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบใหม่' });
    }

    req.user = {
      id: user.id,
      email: user.email ?? '',
      role: user.role ?? ''
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: 'ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบใหม่' });
  }
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  // ปรับให้รองรับ role เป็น 'ADMIN' หรือ 'admin' หรือ 'ADMINISTRATOR' ได้
  if (!req.user?.role || !['ADMIN', 'admin', 'ADMINISTRATOR'].includes(req.user.role)) {
    return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึง เฉพาะผู้ดูแลระบบเท่านั้น' });
  }
  next();
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ตรวจสอบเฉพาะ route ที่ขึ้นต้นด้วย /admin และไม่ใช่ /admin/login
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      
      // ตรวจสอบ role ต้องเป็น admin
      if (decoded.role !== 'admin') {
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }

      // ถ้าผ่านการตรวจสอบแล้ว ให้ผ่านไป
      return NextResponse.next();

    } catch (error) {
      // Token ไม่ถูกต้อง
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};