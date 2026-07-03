// GET /api/admin/visits — Page visit analytics
const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const limit = parseInt(req.query.limit) || 100;
    const page_filter = req.query.page || null;

    let query = supabase
      .from('page_visits')
      .select('*')
      .order('visited_at', { ascending: false })
      .limit(limit);

    if (page_filter) {
      query = query.eq('page', page_filter);
    }

    const { data: visits, error } = await query;
    if (error) throw error;

    // Aggregate by page
    const { data: allVisits } = await supabase.from('page_visits').select('page, event');
    const byPage = {};
    (allVisits || []).forEach(v => {
      if (!byPage[v.page]) byPage[v.page] = { total: 0, events: {} };
      byPage[v.page].total++;
      byPage[v.page].events[v.event] = (byPage[v.page].events[v.event] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      visits: visits || [],
      byPage
    });
  } catch (err) {
    console.error('[AdminVisits]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
