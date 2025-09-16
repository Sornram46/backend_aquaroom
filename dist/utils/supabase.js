"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.testSupabaseConnection = testSupabaseConnection;
exports.ensureBucketExists = ensureBucketExists;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
// โหลด environment variables
dotenv_1.default.config();
// ตรวจสอบ environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log('Supabase Config Check:');
console.log('URL:', supabaseUrl ? '✅ Found' : '❌ Missing');
console.log('Service Key:', supabaseServiceKey ? `✅ Found (${supabaseServiceKey.length} chars)` : '❌ Missing');
// ตรวจสอบรูปแบบ URL
if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
    throw new Error('SUPABASE_URL must start with https://');
}
// ตรวจสอบรูปแบบ JWT
if (supabaseServiceKey && !supabaseServiceKey.startsWith('eyJ')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY appears to be invalid. JWT tokens should start with "eyJ"');
}
if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is missing. Please check your .env file');
}
if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing. Please check your .env file');
}
// สร้าง Supabase client สำหรับ server-side ด้วย service role key
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
// Test connection function
async function testSupabaseConnection() {
    try {
        console.log('Testing Supabase connection...');
        console.log('URL:', supabaseUrl);
        console.log('Service Key prefix:', supabaseServiceKey?.substring(0, 20) + '...');
        const { data, error } = await exports.supabase
            .storage
            .listBuckets();
        if (error) {
            console.error('Supabase connection test failed:', error);
            return false;
        }
        console.log('Supabase connection successful. Available buckets:', data?.map(b => b.name));
        return true;
    }
    catch (error) {
        console.error('Supabase connection error:', error);
        return false;
    }
}
// Function to create bucket if not exists
async function ensureBucketExists(bucketName) {
    try {
        console.log(`Checking bucket: ${bucketName}`);
        // ตรวจสอบว่า bucket มีอยู่หรือไม่
        const { data: buckets, error: listError } = await exports.supabase.storage.listBuckets();
        if (listError) {
            // บางสภาพแวดล้อมอาจจำกัดสิทธิ์การ list buckets แต่ยังอัปโหลดได้
            console.warn('Warning: listBuckets failed, proceeding optimistically:', listError);
            return true; // อย่า block การอัปโหลดเพราะ list ผิดพลาด
        }
        const bucket = buckets?.find((b) => b.name === bucketName);
        const bucketExists = !!bucket;
        if (!bucketExists) {
            console.log(`Creating bucket: ${bucketName}`);
            // สร้าง bucket ใหม่ (public)
            const { error } = await exports.supabase.storage.createBucket(bucketName, {
                public: true,
                allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
                fileSizeLimit: 5242880, // 5MB
            });
            if (error) {
                // หาก bucket ถูกสร้างไว้แล้วโดยระบบอื่น ให้ถือว่าสำเร็จ
                const msg = error?.message?.toString().toLowerCase() || '';
                const code = error?.code;
                if (msg.includes('already exists') || code === '409' || code === 409) {
                    console.warn('Bucket already exists (from createBucket): proceeding');
                    return true;
                }
                console.error('Error creating bucket:', error);
                return false;
            }
            console.log('Bucket created successfully:', bucketName);
        }
        else {
            console.log(`Bucket already exists: ${bucketName}`);
            // ทำให้ bucket เป็น public ถ้าจำเป็น
            if (bucket && bucket.public === false) {
                console.warn('Bucket is private; attempting to set public: true');
                const { error: updateError } = await exports.supabase.storage.updateBucket(bucketName, { public: true });
                if (updateError) {
                    console.warn('Failed to update bucket to public. Public URLs may not work:', updateError);
                }
                else {
                    console.log('Bucket visibility updated to public.');
                }
            }
        }
        return true;
    }
    catch (error) {
        console.error('Error ensuring bucket exists:', error);
        // อย่าบล็อกการอัปโหลดด้วย hard failure ในขั้นตอนตรวจสอบ bucket
        return true;
    }
}
