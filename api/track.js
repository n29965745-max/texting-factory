// POST /api/track — Track page visits and user actions
const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { event, page, user_phone, user_name, user_email, meta } = req.body || {};

    if (!event || !page) {
      return res.status(400).json({ error: 'event and page are required' });
    }

    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';

    const { data, error } = await supabase
      .from('page_visits')
      .insert({
        event,
        page,
        user_phone: user_phone || null,
        user_name: user_name || null,
        user_email: user_email || null,
        ip_address: ip.split(',')[0].trim(),
        user_agent: ua,
        meta: meta || null,
        visited_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('[Track]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
