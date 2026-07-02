// POST /api/callback — M-Pesa / Paynecta payment callback
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  console.log('\n📲 PAYMENT CALLBACK');
  console.log(JSON.stringify(req.body, null, 2));

  // Daraja expects: { ResultCode: 0, ResultDesc: "Accepted" }
  return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
};
