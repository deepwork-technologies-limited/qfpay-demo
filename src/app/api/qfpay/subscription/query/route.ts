import { NextRequest, NextResponse } from 'next/server'
import { generateQFPaySignature } from '../../../../actions'

/**
 * API endpoint to query QFPay subscriptions
 * POST /api/qfpay/subscription/query
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required APPCODE
    const { appcode } = body
    if (!appcode) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: appcode'
      }, { status: 400 })
    }

    // Prepare QFPay API request parameters
    const requestParams: Record<string, string> = {}

    // Add optional parameters if provided
    if (body.page) requestParams.page = body.page.toString()
    if (body.page_size) requestParams.page_size = body.page_size.toString()
    if (body.subscription_id) requestParams.subscription_id = body.subscription_id.toString()
    if (body.customer_id) requestParams.customer_id = body.customer_id.toString()
    if (body.state) requestParams.state = body.state.toString()

    console.log('[API] Querying QFPay subscriptions:', JSON.stringify(requestParams, null, 2))

    // Generate signature
    const signatureResult = await generateQFPaySignature(requestParams, appcode, 'MD5', body.secretKey || null)
    
    if (!signatureResult.success) {
      return NextResponse.json({
        success: false,
        error: `Subscription query signature generation failed: ${signatureResult.error}`
      }, { status: 500 })
    }

    // Prepare form data for QFPay API
    const formData = new URLSearchParams()
    Object.keys(requestParams).forEach(key => {
      formData.append(key, requestParams[key])
    })

    // Call QFPay subscription query API
    const baseURL = 'https://openapi-int.qfapi.com'
    const endpoint = '/subscription/v1/query'
    
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
    console.log('[API] QFPay Subscription Query API Response:', JSON.stringify(responseData, null, 2))

    // Check if API call was successful
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `QFPay Subscription Query API error: ${response.status} ${response.statusText}`,
        details: responseData
      }, { status: response.status })
    }

    // Check QFPay response code
    if (responseData.respcd !== '0000') {
      return NextResponse.json({
        success: false,
        error: `QFPay Subscription Query error: ${responseData.respcd} - ${responseData.respmsg || 'Unknown error'}`,
        details: responseData
      }, { status: 400 })
    }

    // Return successful subscription query response
    const queryResult = {
      subscriptions: responseData.data || [],
      total_count: responseData.total_count || 0,
      page: parseInt(requestParams.page || '1'),
      page_size: parseInt(requestParams.page_size || '10'),
      query_params: requestParams,
      raw_response: responseData
    }

    console.log('[API] Subscription query successful:', queryResult.subscriptions.length, 'results')
    
    return NextResponse.json({
      success: true,
      result: queryResult
    })

  } catch (error) {
    console.error('[API] Subscription query failed:', error)
    
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
    endpoint: '/api/qfpay/subscription/query',
    method: 'POST',
    description: 'Query existing QFPay subscriptions with optional filters',
    optional_fields: ['page', 'page_size', 'subscription_id', 'customer_id', 'state', 'secretKey'],
    required_fields: ['appcode'],
    response_format: {
      subscriptions: 'Array of subscription objects',
      total_count: 'Total number of subscriptions',
      page: 'Current page number',
      page_size: 'Items per page'
    }
  })
}