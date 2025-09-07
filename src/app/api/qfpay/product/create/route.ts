import { NextRequest, NextResponse } from 'next/server'
import { generateQFPaySignature } from '../../../../actions'

/**
 * API endpoint to create QFPay product
 * POST /api/qfpay/product/create
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const { name, txamt, txcurrcd, appcode } = body
    if (!name || !txamt || !txcurrcd || !appcode) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: name, txamt, txcurrcd, appcode'
      }, { status: 400 })
    }

    // Prepare QFPay API request parameters
    const requestParams: Record<string, string> = {
      name: name.toString(),
      txamt: txamt.toString(),
      txcurrcd: txcurrcd.toString()
    }

    // Add optional parameters if provided
    if (body.type) requestParams.type = body.type.toString()
    if (body.description) requestParams.description = body.description.toString()
    if (body.interval) requestParams.interval = body.interval.toString()
    if (body.interval_count) requestParams.interval_count = body.interval_count.toString()
    if (body.usage_type) requestParams.usage_type = body.usage_type.toString()

    console.log('[API] Creating QFPay product:', JSON.stringify(requestParams, null, 2))

    // Generate signature
    const signatureResult = await generateQFPaySignature(requestParams, appcode, 'MD5', body.secretKey || null)
    
    if (!signatureResult.success) {
      return NextResponse.json({
        success: false,
        error: `Product creation signature generation failed: ${signatureResult.error}`
      }, { status: 500 })
    }

    // Prepare form data for QFPay API
    const formData = new URLSearchParams()
    Object.keys(requestParams).forEach(key => {
      formData.append(key, requestParams[key])
    })

    // Call QFPay product creation API
    const baseURL = 'https://openapi-int.qfapi.com'
    const endpoint = '/product/v1/create'
    
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
    console.log('[API] QFPay Product API Response:', JSON.stringify(responseData, null, 2))

    // Check if API call was successful
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `QFPay Product API error: ${response.status} ${response.statusText}`,
        details: responseData
      }, { status: response.status })
    }

    // Check QFPay response code
    if (responseData.respcd !== '0000') {
      return NextResponse.json({
        success: false,
        error: `QFPay Product error: ${responseData.respcd} - ${responseData.respmsg || 'Unknown error'}`,
        details: responseData
      }, { status: 400 })
    }

    // Return successful product creation response
    const product = {
      product_id: responseData.data.product_id,
      name: requestParams.name,
      type: requestParams.type || 'onetime',
      txamt: parseInt(requestParams.txamt),
      txcurrcd: requestParams.txcurrcd,
      description: requestParams.description || null,
      interval: requestParams.interval || null,
      interval_count: requestParams.interval_count ? parseInt(requestParams.interval_count) : null,
      usage_type: requestParams.usage_type || 'licensed',
      created_at: responseData.sysdtm,
      raw_response: responseData
    }

    console.log('[API] Product created successfully:', product.product_id)
    
    return NextResponse.json({
      success: true,
      product
    })

  } catch (error) {
    console.error('[API] Product creation failed:', error)
    
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
    endpoint: '/api/qfpay/product/create',
    method: 'POST',
    description: 'Create QFPay product for recurring payments',
    required_fields: ['name', 'txamt', 'txcurrcd', 'appcode'],
    optional_fields: ['type', 'description', 'interval', 'interval_count', 'usage_type', 'secretKey']
  })
}