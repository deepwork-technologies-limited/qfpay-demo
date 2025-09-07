import { NextRequest, NextResponse } from 'next/server'
import { generateQFPaySignature } from '../../../../actions'

interface ProductItem {
  product_id: string
  quantity: number
}

/**
 * API endpoint to create QFPay subscription
 * POST /api/qfpay/subscription/create
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const { customer_id, token_id, products, appcode } = body
    if (!customer_id || !token_id || !products || !appcode) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: customer_id, token_id, products, appcode'
      }, { status: 400 })
    }

    // Validate products array
    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Products must be a non-empty array'
      }, { status: 400 })
    }

    // Validate each product in the array
    for (const product of products) {
      if (!product.product_id || typeof product.quantity !== 'number') {
        return NextResponse.json({
          success: false,
          error: 'Each product must have product_id (string) and quantity (number)'
        }, { status: 400 })
      }
    }

    // Prepare QFPay API request parameters
    const requestParams: Record<string, any> = {
      customer_id: customer_id.toString(),
      token_id: token_id.toString(),
      products: products
    }

    // Add optional parameters if provided
    if (body.total_billing_cycles) {
      requestParams.total_billing_cycles = parseInt(body.total_billing_cycles.toString())
    }
    if (body.start_time) {
      requestParams.start_time = body.start_time.toString()
    }

    console.log('[API] Creating QFPay subscription:', JSON.stringify(requestParams, null, 2))

    // For signature generation, we need to flatten the products array
    // Convert products array to QFPay expected format
    const signatureParams: Record<string, string> = {
      customer_id: requestParams.customer_id,
      token_id: requestParams.token_id
    }

    // Add products to signature params (QFPay expects products as JSON string)
    signatureParams.products = JSON.stringify(requestParams.products)
    
    if (requestParams.total_billing_cycles) {
      signatureParams.total_billing_cycles = requestParams.total_billing_cycles.toString()
    }
    if (requestParams.start_time) {
      signatureParams.start_time = requestParams.start_time
    }

    // Generate signature
    const signatureResult = await generateQFPaySignature(signatureParams, appcode, 'MD5', body.secretKey || null)
    
    if (!signatureResult.success) {
      return NextResponse.json({
        success: false,
        error: `Subscription creation signature generation failed: ${signatureResult.error}`
      }, { status: 500 })
    }

    // Prepare form data for QFPay API
    const formData = new URLSearchParams()
    formData.append('customer_id', requestParams.customer_id)
    formData.append('token_id', requestParams.token_id)
    formData.append('products', JSON.stringify(requestParams.products))
    
    if (requestParams.total_billing_cycles) {
      formData.append('total_billing_cycles', requestParams.total_billing_cycles.toString())
    }
    if (requestParams.start_time) {
      formData.append('start_time', requestParams.start_time)
    }

    // Call QFPay subscription creation API
    const baseURL = 'https://openapi-int.qfapi.com'
    const endpoint = '/subscription/v1/create'
    
    const response = await fetch(`${baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...signatureResult.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: formData.toString()
    })

    const responseData = await response.json()
    console.log('[API] QFPay Subscription API Response:', JSON.stringify(responseData, null, 2))

    // Check if API call was successful
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `QFPay Subscription API error: ${response.status} ${response.statusText}`,
        details: responseData
      }, { status: response.status })
    }

    // Check QFPay response code
    if (responseData.respcd !== '0000') {
      return NextResponse.json({
        success: false,
        error: `QFPay Subscription error: ${responseData.respcd} - ${responseData.respmsg || 'Unknown error'}`,
        details: responseData
      }, { status: 400 })
    }

    // Return successful subscription creation response
    const subscription = {
      subscription_id: responseData.data?.subscription_id || responseData.subscription_id,
      customer_id: requestParams.customer_id,
      token_id: requestParams.token_id,
      products: requestParams.products,
      total_billing_cycles: requestParams.total_billing_cycles || null,
      start_time: requestParams.start_time || null,
      state: responseData.data?.state || responseData.state || 'ACTIVE',
      created_at: responseData.sysdtm,
      raw_response: responseData
    }

    console.log('[API] Subscription created successfully:', subscription.subscription_id)
    
    return NextResponse.json({
      success: true,
      subscription
    })

  } catch (error) {
    console.error('[API] Subscription creation failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

// GET endpoint for testing API availability
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/qfpay/subscription/create',
    method: 'POST',
    description: 'Create QFPay subscription with products',
    required_fields: ['customer_id', 'token_id', 'products', 'appcode'],
    optional_fields: ['total_billing_cycles', 'start_time', 'secretKey'],
    products_format: [
      {
        product_id: 'prod_54c3772d******9a54b236e09ec74f',
        quantity: 1
      }
    ]
  })
}