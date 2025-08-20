import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';

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

// Health check
app.get('/', (_req, res) => res.send('ESND Credit Check API is running'));

// Test endpoint for credit check (no Shopify signature required)
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
    const expected = crypto.createHmac('sha256', process.env.SHOPIFY_PROXY_SECRET || process.env.SHOPIFY_API_SECRET)
      .update(message).digest('hex');

    if (expected !== signature) {
      return res.status(403).json({ ok: false, message: 'Invalid proxy signature' });
    }

    // 2) Subpath after /proxy/
    const subpath = req.params[0] || '';

    // 3) Credit Check API endpoint
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

    // 4) Demo endpoint: /apps/ext/test
    if (subpath === 'test') {
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

// OAuth Installation endpoints
app.get('/auth', (req, res) => {
  const { shop } = req.query;
  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }
  
  // Redirect to Shopify OAuth
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=read_products,write_products&redirect_uri=${process.env.SHOPIFY_REDIRECT_URI}`;
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

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 ESND Credit Check API running on port ${port}`);
  console.log(`📱 App Proxy endpoint: /proxy/*`);
  console.log(`🧪 Test endpoint: /test/creditCheck`);
  console.log(`🔐 OAuth endpoints: /auth, /auth/callback`);
});
