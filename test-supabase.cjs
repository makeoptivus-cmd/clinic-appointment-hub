const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hqjhnwsvgygexfxkcmdt.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxamhud3N2Z3lnZXhmeGtjbWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMDEwMTcsImV4cCI6MjA4Mzc3NzAxN30.Cddtr6AFjVMFzYatyy8WlsC4EQDw_cOjCQMBtNsc1PI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('appointments').select('*').limit(1);
  if (error) {
    console.error('Error fetching appointments:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('Appointments row fields:', Object.keys(data[0]));
    
    // Try update with assessment_images
    const { data: updateData, error: updateError } = await supabase
      .from('appointments')
      .update({ assessment_images: [] })
      .eq('id', data[0].id)
      .select();
      
    if (updateError) {
      console.error('Error updating appointment:', updateError.message, 'Code:', updateError.code);
    } else {
      console.log('Update success');
    }
  } else {
    console.log('No appointments found');
  }
}
test();
