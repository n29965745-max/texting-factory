// GET /api/health — Health check
const { GATEWAY, DARAJA, PAYNECTA } = require('./lib/gateway');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const hasKey = GATEWAY === 'daraja'
    ? !!(DARAJA.consumerKey && DARAJA.consumerSecret)
    : !!(PAYNECTA.accountId && PAYNECTA.apiKey);

  return res.status(200).json({
    status: 'ok',
    gateway: GATEWAY,
    credentialsSet: hasKey,
    env: DARAJA.env,
    timestamp: new Date().toISOString(),
  });
};
