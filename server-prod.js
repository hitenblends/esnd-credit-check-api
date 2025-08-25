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

// Direct API endpoints for custom app usage (no signature required)
app.post('/api/generate-discount', async (req, res) => {
  try {
    const { shop, customer_id, purchase_order, cart_total, access_token } = req.body;
    
    // Validate required fields
    if (!shop || !customer_id || !purchase_order || !cart_total || !access_token) {
      return res.status(400).json({
        ok: false,
        message: 'Missing required fields: shop, customer_id, purchase_order, cart_total, access_token'
      });
    }

    console.log('Generating discount code for:', { shop, customer_id, purchase_order, cart_total });

    // Generate a unique discount code
    const timestamp = Date.now();
    const discountCode = `CREDIT_${customer_id}_${timestamp}`;

    // Create discount in Shopify
    const discountResponse = await fetch(`https://${shop}/admin/api/2023-10/price_rules.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': access_token
      },
      body: JSON.stringify({
        price_rule: {
          title: `Credit Approved - ${purchase_order}`,
          target_type: 'line_item',
          target_selection: 'all',
          allocation_method: 'across',
          value_type: 'percentage',
          value: '-100.0',
          customer_selection: 'all',
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
          usage_limit: 1,
          applies_to_resource: 'orders',
          discount_codes: [
            {
              code: discountCode,
              usage_limit: 1
            }
          ]
        }
      })
    });

    if (!discountResponse.ok) {
      const errorData = await discountResponse.text();
      console.error('Shopify discount creation error:', errorData);
      
      // Provide more specific error messages
      if (discountResponse.status === 401) {
        throw new Error('Invalid access token - please check your Shopify app permissions');
      } else if (discountResponse.status === 403) {
        throw new Error('Insufficient permissions - app needs write_discounts scope');
      } else if (discountResponse.status === 422) {
        throw new Error('Invalid discount data - check discount parameters');
      } else {
        throw new Error(`Shopify API error: ${discountResponse.status} - ${errorData}`);
      }
    }

    const discountData = await discountResponse.json();
    console.log('Discount created successfully:', discountData);

    return res.json({
      ok: true,
      discount_code: discountCode,
      message: 'Discount code generated successfully',
      shopify_discount_id: discountData.price_rule.id
    });

  } catch (error) {
    console.error('Error generating discount:', error);
    return res.status(500).json({
      ok: false,
      message: 'Failed to generate discount code',
      error: error.message
    });
  }
});

app.post('/api/apply-discount-code', async (req, res) => {
  try {
    const { shop, discount_code, cart_token, access_token } = req.body;
    
    // Validate required fields
    if (!shop || !discount_code || !cart_token || !access_token) {
      return res.status(400).json({
        ok: false,
        message: 'Missing required fields: shop, discount_code, cart_token, access_token'
      });
    }

    console.log('Applying discount code to cart:', { shop, discount_code, cart_token });

    // In Shopify, we don't directly modify carts via Admin API
    // Instead, we return success and let the frontend handle the discount application
    // The discount code will be applied when the customer checks out
    
    return res.json({
      ok: true,
      message: 'Discount code is ready to use at checkout',
      discount_code: discount_code,
      instructions: 'Customer can enter this discount code during checkout to apply the 100% discount'
    });

  } catch (error) {
    console.error('Error applying discount:', error);
    return res.status(500).json({
      ok: false,
      message: 'Failed to apply discount code',
      error: error.message
    });
  }
});

// Custom app endpoints only - no OAuth required

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 ESND Credit Check API running on port ${port}`);
  console.log('✅ Available endpoints:');
  console.log('   - GET / (health check)');
  console.log('   - POST /test/creditCheck (direct testing)');
  console.log('   - POST /api/generate-discount (custom app - Admin API token required)');
  console.log('   - POST /api/apply-discount-code (custom app - Admin API token required)');
  console.log('   - POST /proxy/creditCheck (legacy app proxy - signature required)');
  console.log('   - POST /proxy/test (legacy app proxy demo)');
  console.log('');
  console.log('🎯 CUSTOM APP SETUP:');
  console.log('   - Use /api/* endpoints with your Admin API access token');
  console.log('   - No OAuth or Partner Dashboard required');
  console.log('   - Direct access to Shopify Admin API');
});
