// GET /api/admin/users — Get all users for admin dashboard
const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { data: users, error: uErr } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (uErr) throw uErr;

    const { data: payments, error: pErr } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (pErr) throw pErr;

    // Attach payments to users
    const usersWithPayments = users.map(u => ({
      ...u,
      payments: payments.filter(p => p.user_id === u.id)
    }));

    return res.status(200).json({ success: true, users: usersWithPayments });
  } catch (err) {
    console.error('[AdminUsers]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
