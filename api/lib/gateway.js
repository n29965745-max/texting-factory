// Shared payment gateway logic for Vercel serverless functions
const https = require('https');

// ── Config from env ──
const GATEWAY = (process.env.PAYMENT_GATEWAY || 'paynecta').toLowerCase();

const DARAJA = {
  consumerKey:    process.env.MPESA_CONSUMER_KEY    || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  shortcode:      process.env.MPESA_SHORTCODE       || '174379',
  passkey:        process.env.MPESA_PASSKEY         || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  env:            process.env.MPESA_ENV             || 'sandbox',
  get baseUrl() { return this.env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'; },
};

// ── Helpers ──
function request(opts, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    if (payload) opts.headers = { ...opts.headers, 'Content-Length': Buffer.byteLength(payload) };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: { raw: data } }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function normalisePhone(raw) {
  let p = String(raw).trim().replace(/\s+/g, '').replace(/^\+/, '').replace(/^0/, '254');
  if (!p.startsWith('254')) p = '254' + p;
  return p;
}

// ── Daraja ──
let _token = null, _tokenExp = 0;

async function darajaToken() {
  if (_token && Date.now() < _tokenExp) return _token;
  const auth = Buffer.from(`${DARAJA.consumerKey}:${DARAJA.consumerSecret}`).toString('base64');
  const url = new URL(`${DARAJA.baseUrl}/oauth/v1/generate?grant_type=client_credentials`);
  const res = await request({ hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
    headers: { Authorization: `Basic ${auth}` } });
  if (!res.body.access_token) throw new Error(res.body.errorMessage || 'Could not get Daraja token');
  _token = res.body.access_token;
  _tokenExp = Date.now() + ((parseInt(res.body.expires_in) || 3600) - 60) * 1000;
  return _token;
}

async function darajaStkPush(phone, amount, description) {
  const token = await darajaToken();
  const ts = new Date().toISOString().replace(/\D/g,'').slice(0,14);
  const pwd = Buffer.from(`${DARAJA.shortcode}${DARAJA.passkey}${ts}`).toString('base64');
  const url = new URL(`${DARAJA.baseUrl}/mpesa/stkpush/v1/processrequest`);
  return request({ hostname: url.hostname, path: url.pathname, method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }
  }, {
    BusinessShortCode: DARAJA.shortcode, Password: pwd, Timestamp: ts,
    TransactionType: 'CustomerPayBillOnline', Amount: amount,
    PartyA: phone, PartyB: DARAJA.shortcode, PhoneNumber: phone,
    CallBackURL: `${process.env.BASE_URL || 'https://texting-factory.vercel.app'}/api/callback`,
    AccountReference: 'TextingFactoryKE', TransactionDesc: description || 'Account Activation',
  });
}

async function darajaQuery(reference) {
  const token = await darajaToken();
  const url = new URL(`${DARAJA.baseUrl}/mpesa/transactionstatus/v1/query`);
  return request({ hostname: url.hostname, path: url.pathname, method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }
  }, { CheckoutRequestID: reference });
}

// ── Paynecta ──
const PAYNECTA = {
  code:      process.env.PAYNECTA_CODE        || 'PNT_560085',
  email:     process.env.PAYNECTA_EMAIL       || 'ham1226f@gmail.com',
  apiKey:    process.env.PAYNECTA_API_KEY     || 'hmp_YyeXpjrLShjNqvNDM3XEgsifTJfIhKjovxlBQeCF',
  baseUrl:   'https://paynecta.co.ke',
};

async function paynectaStkPush(phone, amount, description) {
  const url = new URL(`${PAYNECTA.baseUrl}/api/v1/payment/initialize`);
  return request({ hostname: url.hostname, path: url.pathname, method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-Key': PAYNECTA.apiKey,
      'X-User-Email': PAYNECTA.email
    }
  }, { code: PAYNECTA.code, mobile_number: phone, amount });
}

async function paynectaStatus(reference) {
  const url = new URL(`${PAYNECTA.baseUrl}/api/v1/payment/status`);
  url.searchParams.set('transaction_reference', reference);
  return request({ hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-API-Key': PAYNECTA.apiKey,
      'X-User-Email': PAYNECTA.email
    }
  });
}

// ── Unified gateway ──
async function initiateStkPush(phone, amount) {
  if (GATEWAY === 'paynecta') {
    const res = await paynectaStkPush(phone, amount, 'Texting Factory – Account Activation');
    const body = res.body;
    const ok = res.status >= 200 && res.status < 300 && body.success !== false && !body.error;
    const ref = body.reference || body.transaction_reference || body.checkout_request_id || body.data?.reference || body.data?.id || null;
    return { success: ok, reference: ref, message: body.message || (ok ? 'STK push sent' : body.error || 'Failed'), raw: body };
  } else {
    const res = await darajaStkPush(phone, amount, 'Texting Factory – Account Activation');
    const ok = res.status >= 200 && res.status < 300 && res.body.ResponseCode === '0';
    return { success: ok, reference: res.body.CheckoutRequestID || null,
      message: res.body.CustomerMessage || res.body.ResponseDescription || (ok ? 'STK push sent' : 'Failed'), raw: res.body };
  }
}

async function checkStkStatus(reference) {
  if (GATEWAY === 'paynecta') {
    const res = await paynectaStatus(reference);
    const body = res.body;
    const status = (body.status || body.data?.status || '').toLowerCase();
    const paid = ['success','completed','paid','confirmed','successful'];
    const fail = ['failed','declined','rejected','cancelled','canceled'];
    return { confirmed: paid.includes(status), cancelled: status==='cancelled'||status==='canceled',
      failed: fail.includes(status), pending: !paid.includes(status) && !fail.includes(status),
      message: body.message || status, raw: body };
  } else {
    const res = await darajaQuery(reference);
    const code = String(res.body.ResultCode ?? '');
    return { confirmed: code==='0', cancelled: code==='1032',
      failed: code!=='' && code!=='0' && code!=='1032' && code!=='pending',
      pending: code==='' || code==='pending', message: res.body.ResultDesc || code, raw: res.body };
  }
}

module.exports = { GATEWAY, DARAJA, PAYNECTA, normalisePhone, initiateStkPush, checkStkStatus };
