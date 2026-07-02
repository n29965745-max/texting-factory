# SwipeChat Kenya - Payment Integration Guide

## 🚀 Payment Gateway Setup

This application supports **two payment integration options**:

### Option 1: Paynecta (Default)
Paynecta is a Kenyan payment aggregator that simplifies M-Pesa integration.

### Option 2: Safaricom Daraja M-Pesa API (Direct)
Direct integration with Safaricom's official M-Pesa API.

---

## 📋 Configuration

### Step 1: Choose Your Gateway

Edit `server.js` line 16:
```javascript
const USE_PAYNECTA = true;  // Set to false for Daraja API
```

### Step 2: Configure Credentials

#### For Paynecta:

1. Copy `.env.example` to `.env`
2. Update these values:
```env
PAYNECTA_ACCOUNT_ID=your_account_id
PAYNECTA_API_KEY=your_api_key
PAYNECTA_EMAIL=your@email.com
```

#### For Daraja M-Pesa API:

1. **Get Sandbox Credentials** (for testing):
   - Go to https://developer.safaricom.co.ke
   - Sign up / Log in
   - Create an app
   - Copy Consumer Key & Consumer Secret

2. **Sandbox Test Credentials**:
```env
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
```

3. **For Production** (going live):
   - Register your Paybill/Till number with Safaricom
   - Request "Lipa Na M-Pesa Online" API access
   - Get your production passkey
   - Update:
```env
MPESA_ENV=production
MPESA_SHORTCODE=your_paybill_number
MPESA_PASSKEY=your_production_passkey
```

---

## 🧪 Testing

### Test with Safaricom Sandbox:

**Test Phone Numbers:** `254708374149` (Sandbox test number)  
**Test Amounts:** Any amount between 1 - 100,000 KES

The sandbox will simulate the STK push without charging real money.

### Test Flow:

1. Go to `http://192.168.100.8:3000/signup.html`
2. Fill the form with test phone: `708374149`
3. Click "Create Account"
4. On activation page, click "Send M-Pesa Prompt"
5. In sandbox mode, the payment auto-approves after a few seconds
6. Watch the server console for real-time logs

---

## 🔧 Running the Server

### Install Dependencies:
```bash
cd /home/bruno/Desktop/swipechat
npm install
```

### Start Server:
```bash
node server.js
```

The server will display:
```
═══════════════════════════════════════════════════════════════
  🚀 SwipeChat Kenya Server
═══════════════════════════════════════════════════════════════
  📍 Local:    http://localhost:3000
  📱 Mobile:   http://192.168.100.8:3000
  💳 Payment Gateway: ✓ Paynecta (or Daraja M-Pesa)
═══════════════════════════════════════════════════════════════
```

---

## 📡 API Endpoints

### POST `/api/stk-push`
Initiates M-Pesa STK push payment request.

**Request:**
```json
{
  "phone": "254712345678",
  "amount": 100
}
```

**Response:**
```json
{
  "success": true,
  "reference": "REF_1234567890",
  "message": "STK push sent"
}
```

### GET `/api/stk-status/:reference`
Check payment status by reference.

**Response:**
```json
{
  "status": "success",
  "reference": "REF_1234567890",
  "ResultCode": "0"
}
```

### POST `/api/stk-callback`
M-Pesa callback endpoint (called by payment gateway).

---

## 🐛 Troubleshooting

### "Payment gateway unreachable"
- Check your internet connection
- Verify API credentials in `.env`
- For Daraja: ensure you have valid Consumer Key/Secret

### "STK push sent but no prompt on phone"
- Verify phone number format (must start with 254)
- In sandbox mode, use test number: `254708374149`
- Check that the phone has M-Pesa registered

### "ResultCode 1032 - Cancelled by user"
- This means the user cancelled the M-Pesa prompt
- They can click "Retry" to try again

### "Token error" (Daraja)
- Consumer Key or Secret is invalid
- Check credentials at https://developer.safaricom.co.ke

---

## 🔒 Security Notes

- **Never commit `.env` file** to version control
- API keys and secrets are stored server-side only
- No credentials are exposed to the browser/frontend
- Production: use HTTPS and proper authentication

---

## 📚 Additional Resources

- **Paynecta Docs**: Contact Paynecta support for API documentation
- **Safaricom Daraja**: https://developer.safaricom.co.ke
- **M-Pesa API Guide**: https://developer.safaricom.co.ke/Documentation

---

## ✅ Production Checklist

Before going live:

- [ ] Switch to production credentials (not sandbox)
- [ ] Update `MPESA_ENV=production`
- [ ] Use your registered Paybill/Till number
- [ ] Get production passkey from Safaricom
- [ ] Set up proper domain for callback URL
- [ ] Enable HTTPS
- [ ] Test with small real amounts first
- [ ] Set up transaction logging/database
- [ ] Implement proper error monitoring

---

## 🆘 Support

For issues:
1. Check server console logs (detailed output for every request)
2. Review `.env` configuration
3. Verify you're using correct phone number format
4. Test in sandbox mode first before production

Server logs show:
- Every STK push request
- API responses
- Payment callbacks
- Status checks
- Errors with details
