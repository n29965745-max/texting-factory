const postgres = require('postgres');

const sql = postgres({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.xobkowupqahpoxybjuvg',
  password: 'Texting-222!',
  ssl: { rejectUnauthorized: false, servername: 'xobkowupqahpoxybjuvg' },
  connection: { application_name: 'setup' },
  transform: { undefined: null }
});

async function run() {
  try {
    // Test connection
    const result = await sql`SELECT 1 as ok`;
    console.log('Connected!', result);

    // Create users
    await sql`CREATE TABLE IF NOT EXISTS users (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Unknown',
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      activated BOOLEAN DEFAULT false,
      stage TEXT DEFAULT 'registered',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`;
    console.log('users table created');

    // Create payments
    await sql`CREATE TABLE IF NOT EXISTS payments (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      reference TEXT,
      amount NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'pending',
      type TEXT DEFAULT 'activation',
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
    console.log('payments table created');

    // Create page_visits
    await sql`CREATE TABLE IF NOT EXISTS page_visits (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      event TEXT NOT NULL,
      page TEXT NOT NULL,
      user_phone TEXT,
      user_name TEXT,
      user_email TEXT,
      ip_address TEXT,
      user_agent TEXT,
      meta JSONB,
      visited_at TIMESTAMPTZ DEFAULT now()
    )`;
    console.log('page_visits table created');

    // Create chats
    await sql`CREATE TABLE IF NOT EXISTS chats (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tutor_id UUID REFERENCES users(id) ON DELETE CASCADE,
      learner_name TEXT NOT NULL,
      learner_country TEXT,
      learner_flag TEXT,
      last_message TEXT,
      unread_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`;
    console.log('chats table created');

    // Create messages
    await sql`CREATE TABLE IF NOT EXISTS messages (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT now()
    )`;
    console.log('messages table created');

    // Create earnings
    await sql`CREATE TABLE IF NOT EXISTS earnings (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC DEFAULT 0,
      source TEXT DEFAULT 'message',
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
    console.log('earnings table created');

    // Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_visits_page ON page_visits(page)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_visits_time ON page_visits(visited_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_visits_event ON page_visits(event)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_chats_tutor ON chats(tutor_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_earnings_user ON earnings(user_id)`;
    console.log('All indexes created');

    // RLS
    for (const t of ['users','payments','page_visits','chats','messages','earnings']) {
      await sql.unsafe(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
      await sql.unsafe(`DO $$ BEGIN CREATE POLICY "allow_all" ON ${t} FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    }
    console.log('RLS policies set');

    // Verify
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
    console.log('Tables:', tables.map(r => r.table_name));

    await sql.end();
    console.log('DONE');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    await sql.end();
    process.exit(1);
  }
}

run();
