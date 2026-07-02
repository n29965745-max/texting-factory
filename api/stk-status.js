// GET /api/stk-status/:ref — Check STK push payment status
const { checkStkStatus } = require('./lib/gateway');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // Extract reference from path: /api/stk-status/REF123 or query ?ref=REF123
    let reference = req.query.ref;
    if (!reference) {
      const urlPath = req.url || '';
      const match = urlPath.match(/\/api\/stk-status\/(.+?)(?:\?|$)/);
      if (match) reference = decodeURIComponent(match[1]);
    }
    if (!reference) return res.status(400).json({ error: 'Missing reference parameter' });

    const result = await checkStkStatus(decodeURIComponent(reference));
    // Add 'status' field for frontend compatibility
    const status = result.confirmed ? 'completed' : result.failed ? 'failed' : result.cancelled ? 'cancelled' : 'pending';
    return res.status(200).json({ ...result, status });
  } catch (err) {
    return res.status(502).json({ success: false, pending: true, error: err.message });
  }
};
