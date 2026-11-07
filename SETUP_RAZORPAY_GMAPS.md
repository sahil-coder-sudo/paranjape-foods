# Setup Guide for Razorpay & Google Maps API

## Razorpay Setup (Payment)

1. **Create Razorpay Account**
   - Go to https://razorpay.com/
   - Sign up with your email
   - Complete KYC verification

2. **Get API Keys**
   - Dashboard → Settings → API Keys
   - Copy your:
     - `Key ID` (publish key)
     - `Key Secret` (secret key)

3. **Add to `.env`**
   ```
   RAZORPAY_KEY_ID=your_key_id_here
   RAZORPAY_KEY_SECRET=your_key_secret_here
   NEXT_PUBLIC_RAZORPAY_KEY_ID=your_key_id_here
   ```

4. **Test Mode**
   - Use test mode to verify integration before going live
   - Test card: 4111 1111 1111 1111 (any expiry, any CVV)

---

## Google Maps API Setup (Address Validation)

1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com/
   - Click **New Project**
   - Name it "Paranjape Foods"

2. **Enable APIs**
   - In the search bar, type "Maps JavaScript API" → Enable
   - Search "Geocoding API" → Enable
   - Search "Places API" → Enable (optional, for autocomplete later)

3. **Create API Key**
   - Go to **Credentials** → **Create API Key**
   - Choose **Restrict key** (recommended):
     - **Application restrictions**: HTTP referrers (websites)
     - **API restrictions**: Select only the APIs you enabled above

4. **Add to `.env`**
   ```
   GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

---

## Environment File Template

Add these to your `.env` file (copied from `.env.example`):

```
MONGODB_URI=mongodb+srv://sahil:YOUR_PASSWORD@paranjapefoods.vokug.mongodb.net/paranjapefoods
PORT=4000
NEXT_PUBLIC_API_BASE=http://localhost:4000

RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=your_secret_here
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxx

GOOGLE_MAPS_API_KEY=AIzaSyDxxxxxxxxxxxxx
```

---

## Local Testing

1. Ensure all keys are in `.env`
2. Run the backend:
   ```bash
   npm run dev:backend
   ```
3. Run the frontend:
   ```bash
   npm run dev
   ```
4. Visit: http://localhost:3000/checkout
5. Try placing an order with test Razorpay card

---

## Production Deployment

1. **Heroku Backend**: Add config vars in Heroku Dashboard → Settings → Config Vars
2. **Vercel Frontend**: Add env vars in Vercel → Settings → Environment Variables
   - Include `NEXT_PUBLIC_RAZORPAY_KEY_ID` and `NEXT_PUBLIC_API_BASE`

---

## Porter Delivery Integration (Next Steps)

We'll add Porter delivery API later. For now, order tracking will show placeholder status.

Contact Porter support for:
- API Key
- Partner ID
- Webhook setup for real-time tracking
