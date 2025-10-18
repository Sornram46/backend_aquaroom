"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.testSupabaseConnection = testSupabaseConnection;
exports.ensureBucketExists = ensureBucketExists;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}
// Sanity check: ensure the Service Role key belongs to the same project as SUPABASE_URL
function getProjectRefFromUrl(url) {
    try {
        const u = new URL(url);
        // <ref>.supabase.co
        const host = u.host; // e.g., ympuahmkqiwuvnrqbqqe.supabase.co
        const ref = host.split('.')[0];
        return ref || null;
    }
    catch {
        return null;
    }
}
function decodeJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payload + '==='.slice((payload.length + 3) % 4);
        const json = Buffer.from(padded, 'base64').toString('utf-8');
        return JSON.parse(json);
    }
    catch {
        return null;
    }
}
const urlRef = getProjectRefFromUrl(supabaseUrl);
const payload = decodeJwtPayload(supabaseServiceKey);
const keyRef = payload?.ref || payload?.project_id || null;
if (urlRef && keyRef && urlRef !== keyRef) {
    // Fail fast with actionable error
    throw new Error(`SUPABASE_SERVICE_ROLE_KEY does not belong to project '${urlRef}'. Key is for project '${keyRef}'. ` +
        `Please copy the Service Role key from the same project as SUPABASE_URL.`);
}
if (urlRef) {
    console.log(`[Supabase] Project ref from URL: ${urlRef}${keyRef ? `, key payload ref: ${keyRef}` : ''}`);
    if (keyRef && urlRef === keyRef) {
        console.log('[Supabase] Project ref verified: URL and Service Role key match.');
    }
}
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});
// Simple connection test used at server startup
async function testSupabaseConnection() {
    try {
        const { error } = await exports.supabase.storage.listBuckets();
        if (error) {
            console.warn('Supabase listBuckets warning during connection test:', error.message);
            // Treat as connected but with limited permissions
        }
        return true;
    }
    catch (e) {
        console.error('testSupabaseConnection exception:', e);
        return false;
    }
}
async function ensureBucketExists(bucket) {
    try {
        const { data, error } = await exports.supabase.storage.listBuckets();
        if (error) {
            console.warn('listBuckets failed:', error.message);
            return true; // อย่าบล็อก ให้ไปล้มที่ขั้น upload ถ้ามีปัญหาจริง
        }
        const exists = data?.some(b => b.name === bucket);
        if (!exists) {
            const { error: createErr } = await exports.supabase.storage.createBucket(bucket, {
                public: true,
                fileSizeLimit: '10MB',
            });
            if (createErr && !/exists/i.test(createErr.message)) {
                console.error('createBucket error:', createErr.message);
                return false;
            }
        }
        // พยายามตั้งให้ public (ถ้า private)
        await exports.supabase.storage.updateBucket(bucket, { public: true }).catch(() => { });
        return true;
    }
    catch (e) {
        console.error('ensureBucketExists exception:', e);
        return true; // อย่าบล็อก
    }
}
