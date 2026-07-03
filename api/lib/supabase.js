// Supabase client for Vercel serverless functions
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Use service role for server-side operations (full access)
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY
);

// Public client for client-side real-time subscriptions
const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = { supabase, supabasePublic, SUPABASE_URL, SUPABASE_ANON_KEY };
