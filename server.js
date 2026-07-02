'use strict';
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { URL } = require('url');

// Load .env if present
try { require('dotenv').config(); } catch (_) {}

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ─────────────────────────────────────────────────────────────────────────────
// GATEWAY SELECTION  — defaults to paynecta (your credentials)
// ─────────────────────────────────────────────────────────────────────────────
const GATEWAY = (process.env.PAYMENT_GATEWAY || 'paynecta').toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// DARAJA CONFIG  (https://developer.safaricom.co.ke)
// ─────────────────────────────────────────────────────────────────────────────
const DARAJA = {
  consumerKey:    process.env.MPESA_CONSUMER_KEY    || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  shortcode:      process.env.MPESA_SHORTCODE       || '174379',
  passkey:        process.env.MPESA_PASSKEY         || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  env:            process.env.MPESA_ENV             || 'sandbox',
  get baseUrl() { return this.env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'; },
  get callbackUrl() { return `http://192.168.100.8:${PORT}/api/mpesa-callback`; },
};

// ─────────────────────────────────────────────────────────────────────────────
// PAYNECTA CONFIG  (real endpoints discovered from paynecta.co.ke)
// ─────────────────────────────────────────────────────────────────────────────
const PAYNECTA = {
  accountId: process.env.PAYNECTA_ACCOUNT_ID || 'PNT_560085',
  apiKey:    process.env.PAYNECTA_API_KEY    || 'hmp_YyeXpjrLShjNqvNDM3XEgsifTJfIhKjovxlBQeCF',
  email:     process.env.PAYNECTA_EMAIL      || 'ham1226f@gmail.com',
  baseUrl:   'https://paynecta.co.ke',
  get callbackUrl() { return `http://192.168.100.8:${PORT}/api/stk-callback`; },
};

// ─────────────────────────────────────────────────────────────────────────────
// MIME TYPES
// ─────────────────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',   '.css': 'text/css',
  '.js':   'application/javascript', '.json': 'application/json',
  '.png':  'image/png',   '.jpg': 'image/jpeg',
  '.svg':  'image/svg+xml', '.ico': 'image/x-icon',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', c => { buf += c; });
    req.on('end',  () => { try { resolve(JSON.parse(buf || '{}')); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    if (payload) opts.headers = { ...opts.headers, 'Content-Length': Buffer.byteLength(payload) };

    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
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

// ─────────────────────────────────────────────────────────────────────────────
// DARAJA  –  token cache + STK push + query
// ─────────────────────────────────────────────────────────────────────────────
let _token = null, _tokenExp = 0;

async function darajaToken() {
  if (_token && Date.now() < _tokenExp) return _token;
  const auth = Buffer.from(`${DARAJA.consumerKey}:${DARAJA.consumerSecret}`).toString('base64');
  const url  = new URL(`${DARAJA.baseUrl}/oauth/v1/generate?grant_type=client_credentials`);
  const res  = await request({ hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
    headers: { Authorization: `Basic ${auth}` } });
  if (!res.body.access_token) {
    console.error('[Daraja token error]', res.status, res.body);
    throw new Error(res.body.errorMessage || res.body.error || 'Could not get access token. Check Consumer Key/Secret.');
  }
  _token    = res.body.access_token;
  _tokenExp = Date.now() + ((parseInt(res.body.expires_in) || 3600) - 60) * 1000;
  console.log('[Daraja] Token refreshed ✓');
  return _token;
}

async function darajaStkPush(phone, amount, description) {
  const token = await darajaToken();
  const ts    = new Date().toISOString().replace(/\D/g,'').slice(0,14);
  const pwd   = Buffer.from(`${DARAJA.shortcode}${DARAJA.passkey}${ts}`).toString('base64');

  const url = new URL(`${DARAJA.baseUrl}/mpesa/stkpush/v1/processrequest`);
  const payload = {
    BusinessShortCode: DARAJA.shortcode,
    Password:          pwd,
    Timestamp:         ts,
    TransactionType:   'CustomerPayBillOnline',
    Amount:            amount,
    PartyA:            phone,
    PartyB:            DARAJA.shortcode,
    PhoneNumber:       phone,
    CallBackURL:       DARAJA.callbackUrl,
    AccountReference:  'TextingFactoryKE',
    TransactionDesc:   description || 'Account Activation',
  };

  console.log('[Daraja STK push] →', phone, 'KES', amount);
  const res = await request({
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  }, payload);
  console.log('[Daraja STK push] ←', res.status, JSON.stringify(res.body));
  return res;
}

async function darajaQuery(checkoutRequestId) {
  const token = await darajaToken();
  const ts    = new Date().toISOString().replace(/\D/g,'').slice(0,14);
  const pwd   = Buffer.from(`${DARAJA.shortcode}${DARAJA.passkey}${ts}`).toString('base64');

  const url = new URL(`${DARAJA.baseUrl}/mpesa/stkpushquery/v1/query`);
  const res = await request({
    hostname: url.hostname, path: url.pathname, method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  }, { BusinessShortCode: DARAJA.shortcode, Password: pwd, Timestamp: ts, CheckoutRequestID: checkoutRequestId });

  console.log('[Daraja query] ←', res.status, JSON.stringify(res.body));
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYNECTA  –  login for bearer token, then STK push + status
// Endpoints discovered from paynecta.co.ke route manifest:
//   POST /api/v1/mobile/login             → get bearer token
//   POST /api/v1/mobile/payments/initiate → STK push
//   POST /api/v1/mobile/payments/status   → check status
// ─────────────────────────────────────────────────────────────────────────────
let _paynectaToken = null;
let _paynectaTokenExp = 0;

async function paynectaLogin() {
  if (_paynectaToken && Date.now() < _paynectaTokenExp) return _paynectaToken;

  console.log('[Paynecta] Authenticating...');
  const url = new URL(`${PAYNECTA.baseUrl}/api/v1/mobile/login`);
  const res = await request({
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  }, { email: PAYNECTA.email, api_key: PAYNECTA.apiKey, account_id: PAYNECTA.accountId });

  console.log('[Paynecta login]', res.status, JSON.stringify(res.body).slice(0, 200));

  const token = res.body.token || res.body.access_token || res.body.data?.token;
  if (!token) throw new Error(`Paynecta login failed (${res.status}): ${res.body.message || JSON.stringify(res.body)}`);

  _paynectaToken    = token;
  _paynectaTokenExp = Date.now() + 55 * 60 * 1000; // 55 min
  console.log('[Paynecta] Authenticated ✓');
  return _paynectaToken;
}

async function paynectaStkPush(phone, amount, description) {
  const token = await paynectaLogin();
  console.log('[Paynecta STK push] →', phone, 'KES', amount);

  const url = new URL(`${PAYNECTA.baseUrl}/api/v1/mobile/payments/initiate`);
  const res = await request({
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, {
    phone_number: phone,
    amount: amount,
    description: description || 'Account Activation',
    callback_url: PAYNECTA.callbackUrl,
  });

  console.log('[Paynecta STK push] ←', res.status, JSON.stringify(res.body).slice(0, 300));
  return res;
}

async function paynectaStatus(reference) {
  const token = await paynectaLogin();
  console.log('[Paynecta status] checking:', reference);

  const url = new URL(`${PAYNECTA.baseUrl}/api/v1/mobile/payments/status`);
  const res = await request({
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, { reference });

  console.log('[Paynecta status] ←', res.status, JSON.stringify(res.body).slice(0, 200));
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED GATEWAY  –  normalise responses into a single shape:
//   { success, reference, status, message, raw }
// ─────────────────────────────────────────────────────────────────────────────
async function initiateStkPush(phone, amount) {
  if (GATEWAY === 'paynecta') {
    const res = await paynectaStkPush(phone, amount, 'Texting Factory Kenya – Account Activation');
    const body = res.body;
    const ok = res.status >= 200 && res.status < 300 && body.success !== false && !body.error;
    // Paynecta returns reference under various keys
    const reference = body.reference || body.transaction_reference || body.checkout_request_id
                   || body.data?.reference || body.data?.id || null;
    return {
      success:   ok,
      reference: reference,
      message:   body.message || (ok ? 'STK push sent successfully' : body.error || 'Request failed'),
      raw:       body,
    };
  } else {
    const res = await darajaStkPush(phone, amount, 'Texting Factory Kenya – Account Activation');
    const ok  = res.status >= 200 && res.status < 300 && res.body.ResponseCode === '0';
    return {
      success:   ok,
      reference: res.body.CheckoutRequestID || null,
      message:   res.body.CustomerMessage || res.body.ResponseDescription || (ok ? 'STK push sent' : res.body.errorMessage || 'Request failed'),
      raw:       res.body,
    };
  }
}

async function checkStkStatus(reference) {
  if (GATEWAY === 'paynecta') {
    const res    = await paynectaStatus(reference);
    const body   = res.body;
    const status = (body.status || body.data?.status || '').toLowerCase();
    const paidCodes = ['success', 'completed', 'paid', 'confirmed', 'successful'];
    const failCodes = ['failed', 'declined', 'rejected', 'cancelled', 'canceled'];
    return {
      confirmed: paidCodes.includes(status),
      cancelled: status === 'cancelled' || status === 'canceled',
      failed:    failCodes.includes(status),
      pending:   !paidCodes.includes(status) && !failCodes.includes(status),
      message:   body.message || status,
      raw:       body,
    };
  } else {
    const res  = await darajaQuery(reference);
    const code = String(res.body.ResultCode ?? '');
    return {
      confirmed: code === '0',
      cancelled: code === '1032',
      failed:    code !== '' && code !== '0' && code !== '1032' && code !== 'pending',
      pending:   code === '' || code === 'pending' || res.body.errorMessage === 'The transaction is being processed',
      message:   res.body.ResultDesc || res.body.errorMessage || code,
      raw:       res.body,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP SERVER
// ─────────────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  function json(status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(body));
  }

  // ── POST /api/stk-push ──────────────────────────────────────────────────
  if (urlPath === '/api/stk-push' && req.method === 'POST') {
    try {
      const body   = await readBody(req);
      const phone  = normalisePhone(body.phone || '');
      const amount = parseInt(body.amount) || 0;

      if (!phone || phone.length < 12) return json(400, { success: false, error: 'Invalid phone number. Must be in format 07XXXXXXXX or 254XXXXXXXXX.' });
      if (amount < 1)                  return json(400, { success: false, error: 'Amount must be at least 1 KES.' });

      // Credential check
      if (GATEWAY === 'daraja' && (!DARAJA.consumerKey || !DARAJA.consumerSecret)) {
        return json(503, { success: false, error: 'Daraja credentials not configured. Please set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET in your .env file. Get them at https://developer.safaricom.co.ke' });
      }
      if (GATEWAY === 'paynecta' && (!PAYNECTA.accountId || !PAYNECTA.apiKey)) {
        return json(503, { success: false, error: 'Paynecta credentials not configured. Please set PAYNECTA_ACCOUNT_ID and PAYNECTA_API_KEY in your .env file.' });
      }

      console.log(`\n💳 STK PUSH  [${GATEWAY}]  phone=${phone}  amount=KES${amount}`);
      const result = await initiateStkPush(phone, amount);

      if (!result.success) {
        return json(400, { success: false, error: result.message, detail: result.raw });
      }

      return json(200, {
        success:   true,
        reference: result.reference,
        message:   result.message,
      });

    } catch (err) {
      console.error('\n❌ STK push error:', err.message);
      return json(502, { success: false, error: err.message || 'Payment gateway error' });
    }
  }

  // ── GET /api/stk-status/:ref ────────────────────────────────────────────
  if (urlPath.startsWith('/api/stk-status/') && req.method === 'GET') {
    const reference = decodeURIComponent(urlPath.replace('/api/stk-status/', ''));
    try {
      const result = await checkStkStatus(reference);
      return json(200, result);
    } catch (err) {
      console.error('❌ Status check error:', err.message);
      return json(502, { success: false, pending: true, error: err.message });
    }
  }

  // ── POST /api/mpesa-callback  (Daraja callback) ─────────────────────────
  if ((urlPath === '/api/mpesa-callback' || urlPath === '/api/stk-callback') && req.method === 'POST') {
    const body = await readBody(req);
    console.log('\n📲 PAYMENT CALLBACK');
    console.log('─────────────────────────────────────────');
    console.log(JSON.stringify(body, null, 2));
    console.log('─────────────────────────────────────────\n');
    // Daraja expects: { ResultCode: 0, ResultDesc: "Success" }
    return json(200, { ResultCode: 0, ResultDesc: 'Accepted' });
  }

  // ── GET /api/health ─────────────────────────────────────────────────────
  if (urlPath === '/api/health') {
    const hasKey = GATEWAY === 'daraja'
      ? !!(DARAJA.consumerKey && DARAJA.consumerSecret)
      : !!(PAYNECTA.accountId && PAYNECTA.apiKey);

    return json(200, {
      status:         'ok',
      gateway:        GATEWAY,
      credentialsSet: hasKey,
      env:            DARAJA.env,
      timestamp:      new Date().toISOString(),
    });
  }

  // ── GET /api/credentials-check  (test token retrieval) ─────────────────
  if (urlPath === '/api/credentials-check' && req.method === 'GET') {
    try {
      if (GATEWAY !== 'daraja') return json(400, { error: 'Only supported for Daraja' });
      if (!DARAJA.consumerKey || !DARAJA.consumerSecret) {
        return json(400, {
          ok: false,
          error: 'Credentials not set. Edit .env → MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET',
          portal: 'https://developer.safaricom.co.ke',
        });
      }
      // Force token refresh
      _token = null; _tokenExp = 0;
      await darajaToken();
      return json(200, { ok: true, message: 'Daraja credentials are valid ✓' });
    } catch (err) {
      return json(401, { ok: false, error: err.message, portal: 'https://developer.safaricom.co.ke' });
    }
  }

  // ── Static file server ──────────────────────────────────────────────────
  let filePath = path.join(ROOT, urlPath === '/' ? '/index.html' : urlPath);
  const ext    = path.extname(filePath);
  const ct     = MIME[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(ROOT, 'index.html'), (e2, fb) => {
        if (e2) { res.writeHead(404); return res.end('<h2>404</h2>'); }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fb);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': ct });
    res.end(data);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const daraja_ok = !!(DARAJA.consumerKey && DARAJA.consumerSecret);
  const pay_ok    = !!(PAYNECTA.accountId && PAYNECTA.apiKey);

  const lines = [
    '',
    '═══════════════════════════════════════════════════════',
    '  🚀  Texting Factory Kenya  –  Server Running',
    '═══════════════════════════════════════════════════════',
    `  Local:    http://localhost:${PORT}`,
    `  Mobile:   http://192.168.100.8:${PORT}`,
    '',
    '  Pages',
    `  → Landing    http://localhost:${PORT}/`,
    `  → Sign Up    http://localhost:${PORT}/signup.html`,
    `  → Activate   http://localhost:${PORT}/activate.html`,
    `  → Dashboard  http://localhost:${PORT}/dashboard.html`,
    `  → Payments   http://localhost:${PORT}/payments.html`,
    '',
    '  API',
    `  → POST /api/stk-push`,
    `  → GET  /api/stk-status/:ref`,
    `  → GET  /api/health`,
    `  → GET  /api/credentials-check`,
    '',
    `  Gateway: ${GATEWAY.toUpperCase()}  |  Env: ${DARAJA.env}`,
  ];

  if (GATEWAY === 'daraja') {
    if (daraja_ok) {
      lines.push(`  Daraja credentials: ✅ Set`);
    } else {
      lines.push(`  Daraja credentials: ❌ NOT SET`);
      lines.push(`  ──────────────────────────────────────────────`);
      lines.push(`  ⚠️  To enable real M-Pesa prompts:`);
      lines.push(`  1. Go to  https://developer.safaricom.co.ke`);
      lines.push(`  2. Create an app → subscribe to "Mpesa Express"`);
      lines.push(`  3. Copy Consumer Key + Secret into .env`);
      lines.push(`  4. Restart this server`);
      lines.push(`  ──────────────────────────────────────────────`);
    }
  } else {
    lines.push(`  Paynecta credentials: ${pay_ok ? '✅ Set' : '❌ NOT SET'}`);
  }

  lines.push('═══════════════════════════════════════════════════════', '');
  console.log(lines.join('\n'));
});
