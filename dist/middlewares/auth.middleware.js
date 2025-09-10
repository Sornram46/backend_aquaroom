"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.isAdmin = exports.auth = void 0;
exports.middleware = middleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../index");
const server_1 = require("next/server");
const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบ' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // แก้ไขตรงนี้: ตาราง user จริงใน Prisma คือ users (ไม่ใช่ user)
        const user = await index_1.prisma.users.findUnique({
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
    }
    catch (error) {
        return res.status(401).json({ message: 'ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบใหม่' });
    }
};
exports.auth = auth;
const isAdmin = (req, res, next) => {
    // ปรับให้รองรับ role เป็น 'ADMIN' หรือ 'admin' หรือ 'ADMINISTRATOR' ได้
    if (!req.user?.role || !['ADMIN', 'admin', 'ADMINISTRATOR'].includes(req.user.role)) {
        return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึง เฉพาะผู้ดูแลระบบเท่านั้น' });
    }
    next();
};
exports.isAdmin = isAdmin;
function middleware(request) {
    const { pathname } = request.nextUrl;
    // ตรวจสอบเฉพาะ route ที่ขึ้นต้นด้วย /admin และไม่ใช่ /admin/login
    if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
        const token = request.cookies.get('admin_token')?.value;
        if (!token) {
            return server_1.NextResponse.redirect(new URL('/admin/login', request.url));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            // ตรวจสอบ role ต้องเป็น admin
            if (decoded.role !== 'admin') {
                return server_1.NextResponse.redirect(new URL('/admin/login', request.url));
            }
            // ถ้าผ่านการตรวจสอบแล้ว ให้ผ่านไป
            return server_1.NextResponse.next();
        }
        catch (error) {
            // Token ไม่ถูกต้อง
            return server_1.NextResponse.redirect(new URL('/admin/login', request.url));
        }
    }
    return server_1.NextResponse.next();
}
exports.config = {
    matcher: ['/admin/:path*']
};
