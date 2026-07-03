// POST /api/stk-push — Initiate M-Pesa STK push
const { normalisePhone, initiateStkPush, GATEWAY, DARAJA, PAYNECTA } = require('./lib/gateway');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { phone, amount } = req.body || {};
    const normalised = normalisePhone(phone || '');
    const amt = parseInt(amount) || 0;

    if (!normalised || normalised.length < 12) {
      return res.status(400).json({ success: false, error: 'Invalid phone number. Use 07XXXXXXXX or 254XXXXXXXXX.' });
    }
    if (amt < 1) {
      return res.status(400).json({ success: false, error: 'Amount must be at least 1 KES.' });
    }

    if (GATEWAY === 'daraja' && (!DARAJA.consumerKey || !DARAJA.consumerSecret)) {
      return res.status(503).json({ success: false, error: 'Daraja credentials not configured.' });
    }
    if (GATEWAY === 'paynecta' && (!PAYNECTA.code || !PAYNECTA.apiKey)) {
      return res.status(503).json({ success: false, error: 'Paynecta credentials not configured.' });
    }

    const result = await initiateStkPush(normalised, amt);
    if (!result.success) return res.status(400).json({ success: false, error: result.message, detail: result.raw });
    return res.status(200).json({ success: true, reference: result.reference, message: result.message });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message || 'Payment gateway error' });
  }
};
