-- Texting Factory — Supabase Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- ═══════════════════════════════════════════════════════════════
-- 1. Users table — all registered tutors
-- ═══════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════
-- 2. Payments table — all transactions
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reference TEXT,
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  type TEXT DEFAULT 'activation',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 3. Page visits table — tracking all visitor activity
-- ═══════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════
-- 4. Chats table — conversations between tutors and learners
-- ═══════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════
-- 5. Messages table — individual chat messages
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 6. Earnings table — tutor earnings log
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS earnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC DEFAULT 0,
  source TEXT DEFAULT 'message',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- Indexes for performance
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_visits_page ON page_visits(page);
CREATE INDEX IF NOT EXISTS idx_visits_time ON page_visits(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_event ON page_visits(event);
CREATE INDEX IF NOT EXISTS idx_chats_tutor ON chats(tutor_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_earnings_user ON earnings(user_id);

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security (RLS) — disabled for serverless functions
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for API functions)
CREATE POLICY "Service role full access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON page_visits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON chats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON earnings FOR ALL USING (true) WITH CHECK (true);
