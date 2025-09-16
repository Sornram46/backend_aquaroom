import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function ensureBucketExists(bucket: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      console.warn('listBuckets failed:', error.message);
      return true; // อย่าบล็อก ให้ไปล้มที่ขั้น upload ถ้ามีปัญหาจริง
    }
    const exists = data?.some(b => b.name === bucket);
    if (!exists) {
      const { error: createErr } = await supabase.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: '10MB',
      });
      if (createErr && !/exists/i.test(createErr.message)) {
        console.error('createBucket error:', createErr.message);
        return false;
      }
    }
    // พยายามตั้งให้ public (ถ้า private)
    await supabase.storage.updateBucket(bucket, { public: true }).catch(() => {});
    return true;
  } catch (e) {
    console.error('ensureBucketExists exception:', e);
    return true; // อย่าบล็อก
  }
}
