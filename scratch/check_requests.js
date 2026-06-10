const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://juzzeedrzxfqdltgzpff.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1enplZWRyenhmcWRsdGd6cGZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI5MzkxOSwiZXhwIjoyMDg5ODY5OTE5fQ.tYDWrXp4YsiZ3SR5uq6NTk1V76g_NtBxbGLWz9k35w8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('patient_requests')
    .select('*')
    .ilike('requester_name', '%maria%');
  
  if (error) {
    console.error('Error fetching requests:', error);
  } else {
    console.log('Requests found for "maria":', JSON.stringify(data, null, 2));
  }
}

main();
