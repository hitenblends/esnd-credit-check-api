import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import fetch from 'node-fetch';



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

// Custom app endpoints only - no OAuth required

// Custom app endpoints only - no OAuth required

// Shopify App Integration - Credit Check with Real Cart Modification
// REMOVED: This endpoint is not being used by the cart snippet

// Shopify App Integration - Generate and Apply Discount Code
// REMOVED: This endpoint is not being used by the cart snippet

// Shopify App Integration - Apply Discount Code to Cart
// REMOVED: This endpoint is not being used by the cart snippet

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

// Direct API endpoints for custom app usage (no signature required)
app.post('/api/generate-discount', async (req, res) => {
  try {
    const { shop, customer_id, purchase_order, cart_total, access_token } = req.body;
    
    if (!shop || !customer_id || !purchase_order || !cart_total || !access_token) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Generating discount code (direct API):', { shop, customer_id, purchase_order, cart_total });

    // Generate unique discount code
    const discountCode = `CREDIT_${customer_id.slice(-8).toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;
    
    // Create discount code in Shopify using Admin API
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

    console.log('Creating price rule with data:', JSON.stringify(discountData, null, 2));

    // Create the price rule (discount) using Admin API
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
      console.error('Price rule creation failed:', errorText);
      throw new Error(`Failed to create price rule: ${priceRuleResponse.status} - ${errorText}`);
    }

    const priceRule = await priceRuleResponse.json();
    console.log('Price rule created successfully:', priceRule.price_rule.id);

    // Store discount info for tracking (in production, use database)
    const discountInfo = {
      discount_code: discountCode,
      price_rule_id: priceRule.price_rule.id,
      customer_id: customer_id,
      purchase_order: purchase_order,
      amount: cart_total,
      created_at: new Date().toISOString(),
      shop: shop
    };

    console.log('Discount info stored:', discountInfo);

    return res.json({
      success: true,
      discount_code: discountCode,
      message: 'Discount code generated successfully',
      price_rule_id: priceRule.price_rule.id
    });

  } catch (error) {
    console.error('Discount generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate discount', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.post('/api/apply-discount-code', async (req, res) => {
  try {
    const { shop, discount_code, cart_token, access_token } = req.body;
    
    if (!shop || !discount_code || !cart_token || !access_token) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Applying discount code to cart (direct API):', { shop, discount_code, cart_token });

    // Apply discount code to cart using Storefront API
    // Note: For cart modification, we need to use the Storefront API
    // The Admin API doesn't support cart modifications directly
    
    // First, let's verify the discount code exists
    const discountCheckResponse = await fetch(`https://${shop}/admin/api/2024-01/discount_codes/lookup.json?code=${discount_code}`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': access_token,
        'Content-Type': 'application/json'
      }
    });

    if (!discountCheckResponse.ok) {
      throw new Error(`Discount code not found or invalid: ${discountCheckResponse.status}`);
    }

    const discountInfo = await discountCheckResponse.json();
    console.log('Discount code verified:', discountInfo);

    // For now, we'll return success and let the frontend handle the cart update
    // In a full implementation, you'd use the Storefront API to modify the cart
    // or create a custom checkout process
    
    return res.json({
      success: true,
      message: 'Discount code verified successfully',
      discount_code: discount_code,
      discount_info: discountInfo,
      note: 'Discount code is valid and ready to use at checkout'
    });

  } catch (error) {
    console.error('Discount application error:', error);
    res.status(500).json({ 
      error: 'Failed to apply discount code', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

    // 4) Generate Discount Code endpoint
    if (subpath === 'generate-discount') {
      try {
        const { shop, customer_id, purchase_order, cart_total, access_token } = req.body;
        
        if (!shop || !customer_id || !purchase_order || !cart_total || !access_token) {
          return res.status(400).json({ error: 'Missing required parameters' });
        }

        console.log('Generating discount code:', { shop, customer_id, purchase_order, cart_total });

        // Generate unique discount code
        const discountCode = `CREDIT_${customer_id.slice(-8).toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;
        
        // Create discount code in Shopify using Admin API
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

        console.log('Creating price rule with data:', JSON.stringify(discountData, null, 2));

        // Create the price rule (discount) using Admin API
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
          console.error('Price rule creation failed:', errorText);
          throw new Error(`Failed to create price rule: ${priceRuleResponse.status} - ${errorText}`);
        }

        const priceRule = await priceRuleResponse.json();
        console.log('Price rule created successfully:', priceRule.price_rule.id);

        // Store discount info for tracking (in production, use database)
        const discountInfo = {
          discount_code: discountCode,
          price_rule_id: priceRule.price_rule.id,
          customer_id: customer_id,
          purchase_order: purchase_order,
          amount: cart_total,
          created_at: new Date().toISOString(),
          shop: shop
        };

        console.log('Discount info stored:', discountInfo);

        return res.json({
          success: true,
          discount_code: discountCode,
          message: 'Discount code generated successfully',
          price_rule_id: priceRule.price_rule.id
        });

      } catch (error) {
        console.error('Discount generation error:', error);
        res.status(500).json({ 
          error: 'Failed to generate discount', 
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }

    // 5) Apply Discount Code to Cart endpoint
    if (subpath === 'apply-discount-code') {
      try {
        const { shop, discount_code, cart_token, access_token } = req.body;
        
        if (!shop || !discount_code || !cart_token || !access_token) {
          return res.status(400).json({ error: 'Missing required parameters' });
        }

        console.log('Applying discount code to cart:', { shop, discount_code, cart_token });

        // Apply discount code to cart using Storefront API
        // Note: For cart modification, we need to use the Storefront API
        // The Admin API doesn't support cart modifications directly
        
        // First, let's verify the discount code exists
        const discountCheckResponse = await fetch(`https://${shop}/admin/api/2024-01/discount_codes/lookup.json?code=${discount_code}`, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': access_token,
            'Content-Type': 'application/json'
          }
        });

        if (!discountCheckResponse.ok) {
          throw new Error(`Discount code not found or invalid: ${discountCheckResponse.status}`);
        }

        const discountInfo = await discountCheckResponse.json();
        console.log('Discount code verified:', discountInfo);

        // For now, we'll return success and let the frontend handle the cart update
        // In a full implementation, you'd use the Storefront API to modify the cart
        // or create a custom checkout process
        
        return res.json({
          success: true,
          message: 'Discount code verified successfully',
          discount_code: discount_code,
          discount_info: discountInfo,
          note: 'Discount code is valid and ready to use at checkout'
        });

      } catch (error) {
        console.error('Discount application error:', error);
        res.status(500).json({ 
          error: 'Failed to apply discount code', 
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }

    // 6) Demo endpoint: /apps/ext/test  -> here we call any external API
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

// Start server for Render deployment
app.listen(port, () => {
  console.log(`🚀 ESND Credit Check API running on port ${port}`);
  console.log('✅ Available endpoints:');
  console.log('   - GET / (health check)');
  console.log('   - POST /test/creditCheck (direct testing)');
  console.log('   - POST /api/generate-discount (direct API - no signature required)');
  console.log('   - POST /api/apply-discount-code (direct API - no signature required)');
  console.log('   - POST /proxy/creditCheck (Shopify app proxy)');
  console.log('   - POST /proxy/generate-discount (Shopify app proxy)');
  console.log('   - POST /proxy/apply-discount-code (Shopify app proxy)');
  console.log('   - POST /proxy/test (Shopify app proxy demo)');
  console.log('   - All /proxy/* endpoints require Shopify signature validation');
  console.log('   - Use /api/* endpoints for custom app (Admin API token)');
});
