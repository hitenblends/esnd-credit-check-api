# 🚀 Deploy Your Shopify App to Render (Free Hosting)

## 📋 **Prerequisites**
- GitHub account
- Render account (free)

## 🔧 **Step 1: Prepare Your Code**

### **1.1 Update package.json**
Your `package.json` is already updated with the correct scripts.

### **1.2 Use Production Server**
- **Development**: `server.js` (with local HTTPS)
- **Production**: `server-prod.js` (cloud-optimized)

### **1.3 Environment Variables**
Create a `.env.production` file for your production environment:

```bash
# Shopify App Credentials
SHOPIFY_API_KEY=cc1aedf4a961513c70b6953dc5256345
SHOPIFY_API_SECRET=9545b3b145fb6eefc54abce462b3747e
SHOPIFY_PROXY_SECRET=9545b3b145fb6eefc54abce462b3747e

# OAuth Installation
SHOPIFY_REDIRECT_URI=https://YOUR_RENDER_APP.onrender.com/auth/callback

# Server Configuration
PORT=3000
```

## 🌐 **Step 2: Deploy to Render**

### **2.1 Create Render Account**
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Verify your email

### **2.2 Create New Web Service**
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Select your Shopify app repository

### **2.3 Configure the Service**
- **Name**: `esnd-credit-check-api`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `node server-prod.js`
- **Plan**: `Free`

### **2.4 Environment Variables**
Add these in Render dashboard:
- `SHOPIFY_API_KEY`: `cc1aedf4a961513c70b6953dc5256345`
- `SHOPIFY_API_SECRET`: `9545b3b145fb6eefc54abce462b3747e`
- `SHOPIFY_PROXY_SECRET`: `9545b3b145fb6eefc54abce462b3747e`
- `SHOPIFY_REDIRECT_URI`: `https://YOUR_APP_NAME.onrender.com/auth/callback`

### **2.5 Deploy**
Click **"Create Web Service"** and wait for deployment.

## 🔗 **Step 3: Update Shopify App Proxy**

### **3.1 Get Your Render URL**
After deployment, you'll get:
`https://esnd-credit-check-api.onrender.com`

### **3.2 Update Shopify Partners**
1. Go to **Shopify Partners** → **Apps** → **Your App**
2. Click **"App Setup"**
3. **App Proxy** section:
   - **Subpath prefix**: `ext`
   - **Proxy URL**: `https://esnd-credit-check-api.onrender.com`
4. **Save changes**

## 🧪 **Step 4: Test Your Deployed App**

### **4.1 Test Health Check**
Visit: `https://esnd-credit-check-api.onrender.com/`
Should show: "ESND Credit Check API is running"

### **4.2 Test Credit Check API**
```bash
curl -X POST "https://esnd-credit-check-api.onrender.com/test/creditCheck" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "550e8400-e29b-41d4-a716-446655440000", "purchase_order": "PO-2024-001"}'
```

### **4.3 Test App Proxy**
Visit: `https://everythingsafetynd.myshopify.com/apps/ext/test`

## 📱 **Step 5: Update Your Shopify Snippet**

### **5.1 Update Test Snippet**
Replace the ngrok URL with your Render URL:

```javascript
// In credit-check-test-snippet.liquid
const response = await fetch('https://esnd-credit-check-api.onrender.com/test/creditCheck', {
  // ... rest of the code
});
```

### **5.2 Update App Proxy Snippet**
The App Proxy snippet will automatically use the new URL through Shopify's routing.

## 🎯 **Benefits of Render Hosting**

- ✅ **Free forever** (750 hours/month)
- ✅ **Always online** (no more ngrok restarts)
- ✅ **Custom domain** support
- ✅ **Automatic HTTPS**
- ✅ **Easy deployment** from GitHub
- ✅ **Environment variables** management
- ✅ **Logs and monitoring**

## 🔄 **Automatic Deployments**

Every time you push to GitHub:
1. Render automatically detects changes
2. Rebuilds and redeploys your app
3. Zero downtime updates

## 🚨 **Important Notes**

1. **Free tier limitations**:
   - 750 hours/month (enough for 24/7)
   - Sleeps after 15 minutes of inactivity
   - Wakes up on first request

2. **Environment variables**:
   - Keep your secrets secure
   - Never commit `.env` files to GitHub

3. **Monitoring**:
   - Check Render logs for any errors
   - Monitor your app's performance

## 🎉 **You're Done!**

Your Shopify app is now:
- ✅ **Hosted permanently** on Render
- ✅ **Always accessible** via HTTPS
- ✅ **Automatically deployed** from GitHub
- ✅ **No more ngrok** restarts needed

## 🔧 **Troubleshooting**

### **App not responding?**
1. Check Render logs
2. Verify environment variables
3. Check if app is "sleeping" (first request might be slow)

### **CORS errors?**
CORS is already configured in `server-prod.js`

### **Shopify App Proxy not working?**
1. Verify the proxy URL in Shopify Partners
2. Check if your app is online
3. Test the health check endpoint

## 📞 **Need Help?**

- Render documentation: [docs.render.com](https://docs.render.com)
- Render community: [community.render.com](https://community.render.com)
- Your app will be available at: `https://esnd-credit-check-api.onrender.com`
