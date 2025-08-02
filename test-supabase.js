const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function validateEnvironmentVariables() {
  console.log('🔍 Environment Variables Validation:');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Found' : '❌ Missing');
  console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Found' : '❌ Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Found' : '❌ Missing');
  console.log('SUPABASE_BUCKET:', process.env.SUPABASE_BUCKET ? '✅ Found' : '❌ Missing');
  
  // Validate URL format
  if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.startsWith('https://')) {
    console.error('❌ SUPABASE_URL must start with https://');
    return false;
  }
  
  // Validate JWT format
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY appears to be invalid. JWT tokens should start with "eyJ"');
    console.log('💡 Hint: Make sure you copied the complete service_role key from Supabase Dashboard');
    return false;
  }
  
  if (process.env.SUPABASE_ANON_KEY && !process.env.SUPABASE_ANON_KEY.startsWith('eyJ')) {
    console.error('❌ SUPABASE_ANON_KEY appears to be invalid. JWT tokens should start with "eyJ"');
    return false;
  }
  
  return true;
}

async function testSupabase() {
  if (!await validateEnvironmentVariables()) {
    return;
  }
  
  if (!process.env.SUPABASE_URL) {
    console.error('❌ SUPABASE_URL is missing in .env file');
    return;
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is missing in .env file');
    return;
  }
  
  try {
    // Test with service role key
    console.log('\n🔧 Testing with Service Role Key...');
    console.log('URL:', process.env.SUPABASE_URL);
    console.log('Key prefix:', process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...');
    
    const supabaseService = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    const { data: buckets, error: bucketsError } = await supabaseService.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError);
      
      if (bucketsError.message?.includes('Invalid Compact JWS')) {
        console.log('\n💡 JWT Token Issue Detected:');
        console.log('1. Go to Supabase Dashboard > Settings > API');
        console.log('2. Make sure you copy the COMPLETE service_role key');
        console.log('3. The key should be very long (usually 150+ characters)');
        console.log('4. It should start with "eyJ" and contain dots (.)');
        console.log('5. Make sure there are no extra spaces or line breaks');
      }
      return;
    }
    
    console.log('✅ Service Role connection successful!');
    console.log('Available buckets:', buckets?.map(b => b.name));
    
    // Test bucket operations
    const bucketName = process.env.SUPABASE_BUCKET || 'aquaroom-images';
    console.log(`\n📁 Testing bucket: ${bucketName}`);
    
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`Creating bucket: ${bucketName}`);
      const { data: newBucket, error: createError } = await supabaseService.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      });
      
      if (createError) {
        console.error('❌ Error creating bucket:', createError);
      } else {
        console.log('✅ Bucket created successfully');
      }
    } else {
      console.log('✅ Bucket already exists');
    }
    
    // Test upload (create a dummy file)
    console.log('\n📤 Testing file upload...');
    const testFileName = `test-${Date.now()}.txt`;
    const testContent = 'This is a test file for AquaRoom admin';
    
    const { data: uploadData, error: uploadError } = await supabaseService
      .storage
      .from(bucketName)
      .upload(testFileName, testContent, {
        contentType: 'text/plain'
      });
    
    if (uploadError) {
      console.error('❌ Upload test failed:', uploadError);
    } else {
      console.log('✅ Upload test successful');
      
      // Get public URL
      const { data: urlData } = supabaseService
        .storage
        .from(bucketName)
        .getPublicUrl(testFileName);
      
      console.log('Public URL:', urlData.publicUrl);
      
      // Clean up test file
      await supabaseService
        .storage
        .from(bucketName)
        .remove([testFileName]);
      console.log('✅ Test file cleaned up');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message?.includes('Invalid Compact JWS')) {
      console.log('\n💡 This error typically means:');
      console.log('- Your JWT token is incomplete or corrupted');
      console.log('- Check your .env file for extra spaces or line breaks');
      console.log('- Re-copy the key from Supabase Dashboard');
    }
  }
}

async function showSupabaseInstructions() {
  console.log('\n📋 How to get your Supabase credentials:');
  console.log('1. Go to https://supabase.com/dashboard');
  console.log('2. Select your project (ympuahmkqiwuvnrqbqqe)');
  console.log('3. Go to Settings > API');
  console.log('4. Copy the following:');
  console.log('   - Project URL → SUPABASE_URL');
  console.log('   - anon public → SUPABASE_ANON_KEY');
  console.log('   - service_role → SUPABASE_SERVICE_ROLE_KEY (click "Reveal" first)');
  console.log('5. Paste them in your .env file');
  console.log('\n⚠️  Important: The service_role key is very long (150+ characters)');
  console.log('Make sure you copy the ENTIRE key without any spaces or line breaks!');
}

// Run tests
console.log('🧪 Supabase Connection Test\n');
testSupabase().then(() => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')) {
    showSupabaseInstructions();
  }
  console.log('\n✅ Test completed');
}).catch((error) => {
  console.error('❌ Test suite failed:', error);
  showSupabaseInstructions();
});
