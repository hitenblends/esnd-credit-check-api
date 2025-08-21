import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Add CORS middleware to allow requests from Shopify
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// OAuth Installation endpoints (for app installation)
app.get('/auth', (req, res) => {
  const { shop } = req.query;
  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }
  
  // Redirect to Shopify OAuth
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=read_products,write_products&redirect_uri=${process.env.SHOPIFY_REDIRECT_URI || 'https://92dc7964bc1d.ngrok-free.app/auth/callback'}`;
  res.redirect(authUrl);
});

app.get('/auth/callback', (req, res) => {
  const { code, shop, state } = req.query;
  
  if (!code || !shop) {
    return res.status(400).send('Missing authorization code or shop');
  }
  
  // Here you would exchange the code for an access token
  // For now, just show success message
  res.send(`
    <html>
      <head><title>App Installed Successfully!</title></head>
      <body>
        <h1>🎉 App Installed Successfully!</h1>
        <p>Your app has been installed in <strong>${shop}</strong></p>
        <p>You can now use the App Proxy at: <code>https://${shop}/apps/ext/*</code></p>
        <script>
          // Redirect back to the store admin after 3 seconds
          setTimeout(() => {
            window.location.href = 'https://${shop}/admin';
          }, 3000);
        </script>
      </body>
    </html>
  `);
});

// Shopify App Integration - Credit Check with Real Cart Modification
app.post('/api/credit-check', async (req, res) => {
  try {
    const { shop, customer_id, purchase_order, cart_total } = req.body;
    
    if (!shop || !customer_id || !purchase_order || !cart_total) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Credit check request:', { shop, customer_id, purchase_order, cart_total });

    // Call your credit check API
    const creditResponse = await fetch('http://54.148.31.213/api/creditCheck/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id,
        purchase_order
      })
    });

    if (!creditResponse.ok) {
      throw new Error(`Credit API error: ${creditResponse.status}`);
    }

    const creditData = await creditResponse.json();
    console.log('Credit API response:', creditData);

    if (creditData.status === 'success') {
      const availableCredit = parseFloat(creditData.credit) || 0;
      const cartTotal = parseFloat(cart_total);
      
      if (availableCredit >= cartTotal) {
        // Credit approved - return success with discount info
        return res.json({
          success: true,
          credit_approved: true,
          available_credit: availableCredit,
          cart_total: cartTotal,
          discount_applied: true,
          message: 'Credit approved! Discount will be applied to cart.',
          customer_id: customer_id,
          purchase_order: purchase_order
        });
      } else {
        return res.json({
          success: true,
          credit_approved: false,
          available_credit: availableCredit,
          cart_total: cartTotal,
          message: `Insufficient credit. You need $${(cartTotal - availableCredit).toFixed(2)} more credit.`
        });
      }
    } else {
      return res.json({
        success: false,
        message: 'Credit check failed. Please verify your information.'
      });
    }
  } catch (error) {
    console.error('Credit check error:', error);
    res.status(500).json({ error: 'Credit check failed', details: error.message });
  }
});

// Shopify App Integration - Generate and Apply Discount Code
app.post('/api/generate-discount', async (req, res) => {
  try {
    const { shop, customer_id, purchase_order, cart_total, access_token } = req.body;
    
    if (!shop || !customer_id || !purchase_order || !cart_total || !access_token) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Generating discount code:', { shop, customer_id, purchase_order, cart_total });

    // Generate unique discount code
    const discountCode = `CREDIT_${customer_id.slice(-8).toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;
    
    // Create discount code in Shopify
    const discountData = {
      price_rule: {
        title: `Credit Discount - ${customer_id.slice(-8)}`,
        target_type: 'line_item',
        target_selection: 'all',
        allocation_method: 'across',
        value_type: 'fixed_amount',
        value: `-${cart_total}`,
        customer_selection: 'all',
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        usage_limit: 1,
        applies_once: true,
        discount_codes: [{
          code: discountCode,
          usage_count: 0
        }]
      }
    };

    // Create the price rule (discount)
    const priceRuleResponse = await fetch(`https://${shop}/admin/api/2024-01/price_rules.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(discountData)
    });

    if (!priceRuleResponse.ok) {
      const errorText = await priceRuleResponse.text();
      throw new Error(`Failed to create price rule: ${priceRuleResponse.status} - ${errorText}`);
    }

    const priceRule = await priceRuleResponse.json();
    console.log('Price rule created:', priceRule);

    // Store discount info for tracking
    const discountInfo = {
      discount_code: discountCode,
      price_rule_id: priceRule.price_rule.id,
      customer_id: customer_id,
      purchase_order: purchase_order,
      amount: cart_total,
      created_at: new Date().toISOString(),
      shop: shop
    };

    // In production, store this in a database
    console.log('Discount info:', discountInfo);

    return res.json({
      success: true,
      discount_code: discountCode,
      message: 'Discount code generated successfully',
      price_rule_id: priceRule.price_rule.id
    });

  } catch (error) {
    console.error('Discount generation error:', error);
    res.status(500).json({ error: 'Failed to generate discount', details: error.message });
  }
});

// Shopify App Integration - Apply Discount Code to Cart
app.post('/api/apply-discount-code', async (req, res) => {
  try {
    const { shop, discount_code, cart_token, access_token } = req.body;
    
    if (!shop || !discount_code || !cart_token || !access_token) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Applying discount code to cart:', { shop, discount_code, cart_token });

    // Apply discount code to cart
    const applyResponse = await fetch(`https://${shop}/admin/api/2024-01/carts/${cart_token}/discount_codes.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        discount_code: discount_code
      })
    });

    if (!applyResponse.ok) {
      const errorText = await applyResponse.text();
      throw new Error(`Failed to apply discount code: ${applyResponse.status} - ${errorText}`);
    }

    const result = await applyResponse.json();
    console.log('Discount code applied:', result);

    return res.json({
      success: true,
      message: 'Discount code applied successfully',
      cart: result.cart
    });

  } catch (error) {
    console.error('Discount application error:', error);
    res.status(500).json({ error: 'Failed to apply discount code', details: error.message });
  }
});

// Health check
app.get('/', (_req, res) => res.send('ESND local proxy is running'));

// Test endpoint for credit check (no Shopify signature required) - NEWLY ADDED
app.post('/test/creditCheck', async (req, res) => {
  // Set CORS headers for this endpoint
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    const { customer_id, purchase_order, check_date } = req.body;
    
    // Validate required fields
    if (!customer_id || !purchase_order) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: customer_id and purchase_order'
      });
    }
    
    console.log('Testing credit check API with:', { customer_id, purchase_order, check_date });
    
    // Call the external credit check API
    const response = await fetch('http://54.148.31.213/api/creditCheck/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_id: customer_id,
        purchase_order: purchase_order
      })
    });
    
    const creditCheckResult = await response.json();
    
    return res.json({
      ok: true,
      credit_check: creditCheckResult,
      request_data: {
        customer_id: customer_id,
        purchase_order: purchase_order,
        check_date: check_date
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (apiError) {
    console.error('Credit check API error:', apiError);
    return res.status(500).json({
      ok: false,
      error: 'Credit check API call failed',
      details: apiError.message
    });
  }
});

// App Proxy endpoint: Shopify will forward /apps/ext/* to this /proxy/*
app.all('/proxy/*', async (req, res) => {
  try {
    // 1) Verify Shopify App Proxy signature
    const { signature, ...qs } = req.query || {};
    const message = Object.keys(qs).sort().map(k => `${k}=${qs[k]}`).join('');
    const expected = crypto.createHmac('sha256', process.env.SHOPIFY_PROXY_SECRET || process.env.SHOPIFY_API_SECRET) // Updated to prioritize PROXY_SECRET
      .update(message).digest('hex');

    if (expected !== signature) {
      return res.status(403).json({ ok: false, message: 'Invalid proxy signature' });
    }

    // 2) Subpath after /proxy/
    const subpath = req.params[0] || ''; // e.g. "test"

    // 3) Credit Check API endpoint - NEWLY ADDED
    if (subpath === 'creditCheck') {
      try {
        const { customer_id, purchase_order } = req.body;
        
        // Validate required fields
        if (!customer_id || !purchase_order) {
          return res.status(400).json({
            ok: false,
            error: 'Missing required fields: customer_id and purchase_order'
          });
        }
        
        // Call the external credit check API
        const response = await fetch('http://54.148.31.213/api/creditCheck/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customer_id: customer_id,
            purchase_order: purchase_order
          })
        });
        
        const creditCheckResult = await response.json();
        
        return res.json({
          ok: true,
          credit_check: creditCheckResult,
          request_data: {
            customer_id: customer_id,
            purchase_order: purchase_order
          },
          timestamp: new Date().toISOString()
        });
        
      } catch (apiError) {
        console.error('Credit check API error:', apiError);
        return res.status(500).json({
          ok: false,
          error: 'Credit check API call failed',
          details: apiError.message
        });
      }
    }

    // 4) Demo endpoint: /apps/ext/test  -> here we call any external API
    if (subpath === 'test') {
      // Example public API call (replace with your real API)
      const r = await fetch('https://jsonplaceholder.typicode.com/todos/1');
      const data = await r.json();

      return res.json({
        ok: true,
        banner: `External API says: "${data.title}"`,
        when: new Date().toISOString()
      });
    }

    // Default response
    return res.json({ ok: true, message: `Reached proxy at /${subpath}` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Proxy error' });
  }
});

const port = process.env.PORT || 3000;
const httpsPort = process.env.HTTPS_PORT || 3443;

// Start HTTP server (for ngrok to connect to)
app.listen(port, () => console.log(`HTTP server listening on http://localhost:${port} (for ngrok)`));

// Start HTTPS server with self-signed certificate (for local HTTPS access)
try {
  // Check if certificates exist, if not create them
  const certPath = path.join(__dirname, 'certs');
  const keyPath = path.join(certPath, 'key.pem');
  const certPathFile = path.join(certPath, 'cert.pem');
  
  if (!fs.existsSync(certPath)) {
    fs.mkdirSync(certPath, { recursive: true });
  }
  
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPathFile)) {
    console.log('Generating self-signed certificates...');
    const { execSync } = await import('child_process');
    
    try {
      // Use proper quoting for paths with spaces
      const opensslCmd = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPathFile}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`;
      execSync(opensslCmd, { stdio: 'inherit' });
      console.log('Self-signed certificates generated successfully!');
    } catch (error) {
      console.log('Could not generate certificates with openssl. HTTPS server will not start.');
      console.log('You can manually generate certificates or use ngrok for HTTPS access.');
      console.log('Error details:', error.message);
    }
  }
  
  if (fs.existsSync(keyPath) && fs.existsSync(certPathFile)) {
    const options = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPathFile)
    };
    
    https.createServer(options, app).listen(httpsPort, () => {
      console.log(`HTTPS server listening on https://localhost:${httpsPort}`);
      console.log('⚠️  Note: This uses a self-signed certificate. Your browser will show a security warning.');
      console.log('   For production, use proper SSL certificates.');
    });
  }
} catch (error) {
  console.log('HTTPS server could not be started:', error.message);
  console.log('Your server is still accessible via HTTP on port', port);
}
