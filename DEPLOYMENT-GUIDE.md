# 🚀 Shopify Credit Check App - Deployment Guide

## **Prerequisites**
- ✅ Shopify Partner Account
- ✅ App created in Partner Dashboard
- ✅ API credentials obtained

## **Step 1: Get Your App Credentials**

From your Shopify Partner Dashboard (which you've already done):

1. **Client ID**: `cc1aedf4a961513c70b6953dc5256345` ✅
2. **Client Secret**: Click the eye icon to reveal and copy this value
3. **App URL**: Your server domain (e.g., `https://esnd-credit-check-api.onrender.com`)

## **Step 2: Configure App in Partner Dashboard**

### **App Setup Tab:**
- **App URL**: `https://esnd-credit-check-api.onrender.com`
- **Allowed redirection URL(s)**: `https://esnd-credit-check-api.onrender.com/auth/callback`

### **App Proxy Tab:**
- **Subpath prefix**: `ext`
- **Proxy URL**: `https://esnd-credit-check-api.onrender.com/proxy`

### **Admin API Integration:**
- **Admin API access scopes**: 
  - `read_products`, `write_products`
  - `read_orders`, `write_orders`
  - `read_customers`, `write_customers`
  - `read_discounts`, `write_discounts`

## **Step 3: Create Environment File**

Create a `.env` file in your project root:

```bash
# Copy from env.example and fill in real values
cp env.example .env
```

Edit `.env` with your real credentials:

```bash
# Shopify App Credentials
SHOPIFY_API_KEY=cc1aedf4a961513c70b6953dc5256345
SHOPIFY_API_SECRET=your_actual_client_secret_here
SHOPIFY_PROXY_SECRET=your_actual_client_secret_here

# OAuth Redirect URI
SHOPIFY_REDIRECT_URI=https://esnd-credit-check-api.onrender.com/auth/callback

# Server Configuration
PORT=3000
NODE_ENV=production

# External Credit Check API
CREDIT_CHECK_API_URL=http://54.148.31.213/api/creditCheck/
```

## **Step 4: Deploy Your Server**

### **Option A: Render (Recommended)**
1. Push code to GitHub
2. Connect repository to Render
3. Set environment variables in Render dashboard
4. Deploy

### **Option B: Local Development**
```bash
npm install
npm run dev
```

## **Step 5: Test the OAuth Flow**

1. **Visit your store's cart page**
2. **Click "Use Credit Check for This Order"**
3. **Click "Click here to authenticate"**
4. **Authorize the app** in Shopify
5. **Get redirected back** with access token

## **Step 6: Test Credit Check**

1. **Enter Customer ID** (e.g., `0698ab21-5fa1-11f0-f6d9-7927451b268f`)
2. **Enter Purchase Order** (e.g., `PO123456789`)
3. **Click "Check Credit Availability"**
4. **Verify credit approval** and discount application

## **Troubleshooting**

### **OAuth Issues:**
- ✅ Check API key and secret are correct
- ✅ Verify redirect URI matches exactly
- ✅ Ensure app proxy is configured
- ✅ Check server logs for errors

### **Discount Issues:**
- ✅ Verify access token is obtained
- ✅ Check Shopify API permissions
- ✅ Review server logs for API errors

### **Common Errors:**
- **"Invalid proxy signature"**: Check SHOPIFY_PROXY_SECRET
- **"OAuth failed"**: Verify redirect URI and credentials
- **"Discount generation failed"**: Check access token and permissions

## **API Endpoints**

- **OAuth**: `GET /auth?shop=your-store.myshopify.com`
- **Callback**: `GET /auth/callback`
- **Credit Check**: `POST /proxy/creditCheck`
- **Generate Discount**: `POST /proxy/generate-discount`
- **Apply Discount**: `POST /proxy/apply-discount-code`

## **Security Notes**

- 🔒 Never commit `.env` files to version control
- 🔒 Use environment variables for all secrets
- 🔒 Rotate access tokens regularly
- 🔒 Monitor API usage and errors

## **Next Steps**

After successful deployment:
1. **Test with real customers**
2. **Monitor discount usage**
3. **Set up error tracking**
4. **Implement analytics**
5. **Add rate limiting**

---

**Need Help?** Check the server logs and browser console for detailed error messages.
