// GET /api/admin/stats — Platform statistics
const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // User counts
    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: activeUsers } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('activated', true);
    const pendingUsers = (totalUsers || 0) - (activeUsers || 0);

    // Revenue
    const { data: confirmedPayments } = await supabase.from('payments').select('amount').eq('status', 'confirmed');
    const revenue = (confirmedPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    // Training payments
    const { count: trainingPaid } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'confirmed');

    // Page visits today
    const today = new Date().toISOString().split('T')[0];
    const { count: visitsToday } = await supabase.from('page_visits').select('*', { count: 'exact', head: true }).gte('visited_at', today);

    // Total visits
    const { count: totalVisits } = await supabase.from('page_visits').select('*', { count: 'exact', head: true });

    // Unique visitors (by IP)
    const { data: uniqueIps } = await supabase.from('page_visits').select('ip_address');
    const uniqueVisitors = new Set((uniqueIps || []).map(v => v.ip_address)).size;

    // Funnel: visits by stage
    const stages = ['landing', 'signup', 'activation', 'payment', 'training', 'dashboard'];
    const funnel = {};
    for (const stage of stages) {
      const { count } = await supabase.from('page_visits').select('*', { count: 'exact', head: true }).eq('event', stage);
      funnel[stage] = count || 0;
    }

    // Recent payments
    const { data: recentPayments } = await supabase
      .from('payments')
      .select('*, users(name, phone)')
      .order('created_at', { ascending: false })
      .limit(10);

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        pendingUsers,
        revenue,
        trainingPaid: trainingPaid || 0,
        visitsToday: visitsToday || 0,
        totalVisits: totalVisits || 0,
        uniqueVisitors,
        funnel,
        recentPayments: recentPayments || []
      }
    });
  } catch (err) {
    console.error('[AdminStats]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
