const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hqjhnwsvgygexfxkcmdt.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxamhud3N2Z3lnZXhmeGtjbWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMDEwMTcsImV4cCI6MjA4Mzc3NzAxN30.Cddtr6AFjVMFzYatyy8WlsC4EQDw_cOjCQMBtNsc1PI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAmount() {
  const { data, error } = await supabase.from('appointments').select('*').limit(1);
  if (data && data.length > 0) {
    const { data: updateData, error: updateError } = await supabase
      .from('appointments')
      .update({ amount: 0 })
      .eq('id', data[0].id)
      .select();
      
    if (updateError) {
      console.log('Update amount failed:', updateError.message, 'Code:', updateError.code);
    } else {
      console.log('Update amount success');
    }
  }
}
testAmount();
