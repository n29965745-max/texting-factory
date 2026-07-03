// GET /api/init-db — Create all tables (call once)
const { Client } = require('pg');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ error: 'DATABASE_URL not set. Add it in Vercel env vars.' });
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL DEFAULT 'Unknown',
        phone TEXT UNIQUE NOT NULL,
        email TEXT,
        activated BOOLEAN DEFAULT false,
        stage TEXT DEFAULT 'registered',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS payments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        reference TEXT,
        amount NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'pending',
        type TEXT DEFAULT 'activation',
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS page_visits (
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
      );

      CREATE TABLE IF NOT EXISTS chats (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tutor_id UUID REFERENCES users(id) ON DELETE CASCADE,
        learner_name TEXT NOT NULL,
        learner_country TEXT,
        learner_flag TEXT,
        last_message TEXT,
        unread_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
        sender TEXT NOT NULL,
        content TEXT NOT NULL,
        sent_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS earnings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC DEFAULT 0,
        source TEXT DEFAULT 'message',
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
      CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
      CREATE INDEX IF NOT EXISTS idx_visits_page ON page_visits(page);
      CREATE INDEX IF NOT EXISTS idx_visits_time ON page_visits(visited_at DESC);
      CREATE INDEX IF NOT EXISTS idx_visits_event ON page_visits(event);
      CREATE INDEX IF NOT EXISTS idx_chats_tutor ON chats(tutor_id);
      CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_earnings_user ON earnings(user_id);

      ALTER TABLE users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
      ALTER TABLE page_visits ENABLE ROW LEVEL SECURITY;
      ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
      ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;

      DO $$ BEGIN
        CREATE POLICY "allow_all" ON users FOR ALL USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      DO $$ BEGIN
        CREATE POLICY "allow_all" ON payments FOR ALL USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      DO $$ BEGIN
        CREATE POLICY "allow_all" ON page_visits FOR ALL USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      DO $$ BEGIN
        CREATE POLICY "allow_all" ON chats FOR ALL USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      DO $$ BEGIN
        CREATE POLICY "allow_all" ON messages FOR ALL USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      DO $$ BEGIN
        CREATE POLICY "allow_all" ON earnings FOR ALL USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.end();
    return res.status(200).json({ success: true, message: 'All 6 tables created with indexes and RLS policies.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
