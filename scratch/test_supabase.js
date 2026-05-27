const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ieopfdxgjlmdsidikgbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imllb3BmZHhnamxtZHNpZGlrZ2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1Mjg1MDgsImV4cCI6MjA3NjEwNDUwOH0.8MaTqu67m1EUnWQk1UUol2OHnFcP6k0vpcdI7EVX3aE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('Fetching all users from public.users to see if new user is created...');
  const { data, error } = await supabase
    .from('users')
    .select('id, email, username, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('ERROR FETCHING USERS:', error);
  } else {
    console.log('SUCCESS! Users:', data);
  }
}

run();
