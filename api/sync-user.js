// POST /api/sync-user — Sync user data to Supabase
const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, phone, email, activated, stage, payment_ref, payment_amount } = req.body || {};

    if (!phone) {
      return res.status(400).json({ error: 'phone is required' });
    }

    // Upsert user by phone
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    const now = new Date().toISOString();

    if (existing) {
      // Update existing user
      const update = { name, email, updated_at: now };
      if (activated !== undefined) update.activated = activated;
      if (stage) update.stage = stage;

      const { error } = await supabase
        .from('users')
        .update(update)
        .eq('id', existing.id);

      if (error) throw error;

      // Record payment if provided
      if (payment_ref) {
        await supabase.from('payments').insert({
          user_id: existing.id,
          reference: payment_ref,
          amount: payment_amount || 100,
          status: 'confirmed',
          created_at: now
        });
      }

      return res.status(200).json({ success: true, action: 'updated', id: existing.id });
    } else {
      // Insert new user
      const { data, error } = await supabase
        .from('users')
        .insert({
          name: name || 'Unknown',
          phone,
          email: email || null,
          activated: activated || false,
          stage: stage || 'registered',
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) throw error;

      // Record payment if provided
      if (payment_ref) {
        await supabase.from('payments').insert({
          user_id: data.id,
          reference: payment_ref,
          amount: payment_amount || 100,
          status: 'confirmed',
          created_at: now
        });
      }

      return res.status(200).json({ success: true, action: 'created', id: data.id });
    }
  } catch (err) {
    console.error('[SyncUser]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
