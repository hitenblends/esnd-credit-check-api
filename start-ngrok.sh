#!/bin/bash

echo "🚀 Starting ngrok to expose your HTTPS server..."
echo "Make sure you've configured your authtoken first with:"
echo "ngrok config add-authtoken YOUR_AUTHTOKEN_HERE"
echo ""
echo "Starting ngrok on port 3443 (HTTPS)..."
echo "This will give you a public HTTPS URL for Shopify App Proxy"
echo ""

ngrok http 3443
