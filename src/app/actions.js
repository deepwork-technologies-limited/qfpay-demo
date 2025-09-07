'use server'

import crypto from 'crypto'

/**
 * Server action to generate QFPay signature
 * Keeps client key secure on the server side
 * @param {Object} params - Parameters to sign
 * @param {string} appcode - QFPay merchant app code
 * @param {string} algorithm - 'MD5' or 'SHA256' (default: 'MD5')
 */
export async function generateQFPaySignature(params, appcode, algorithm = 'MD5', clientKey = null) {
  try {
    // Use provided client key or fallback to environment variable
    const secretKey = clientKey || process.env.QFPAY_CLIENT_KEY || ''
    
    console.log('[Server] QFPay Signature Generation Started')
    console.log('[Server] Algorithm:', algorithm)
    console.log('[Server] APPCODE:', appcode)
    console.log('[Server] Parameters:', JSON.stringify(params, null, 2))
    
    // Step 1: Sort parameters by key in ascending order (exactly as official example)
    const ordered = {}
    Object.keys(params)
      .sort()
      .forEach(function (key) {
        ordered[key] = params[key]
      })
    
    console.log('[Server] Ordered parameters:', JSON.stringify(ordered, null, 2))
    
    // Step 2: Build parameter string (exactly as official example)
    var str = []
    for (var p in ordered)
      if (ordered.hasOwnProperty(p)) {
        str.push(p + "=" + ordered[p])
      }
    var paramString = str.join("&")
    
    console.log('[Server] Parameter string:', paramString)
    
    // Step 3: Append client key (exactly as official example)
    const signString = paramString + secretKey
    
    console.log('[Server] Sign string:', signString.substring(0, 50) + '...')
    
    // Step 4: Generate hash using Node.js crypto (exactly as official example)
    let signature
    if (algorithm.toUpperCase() === 'MD5') {
      signature = crypto.createHash('md5').update(signString).digest('hex')
    } else {
      signature = crypto.createHash('sha256').update(signString).digest('hex')
    }
    
    console.log('[Server] Generated signature:', signature.substring(0, 16) + '...')
    
    // Return signature with headers for QFPay API
    return {
      success: true,
      signature: signature,
      headers: {
        'X-QF-APPCODE': appcode,
        'X-QF-SIGN': signature,
        'X-QF-SIGNTYPE': algorithm.toUpperCase(),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
    
  } catch (error) {
    console.error('[Server] QFPay signature generation failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
}


/**
 * Server action to create QFPay customer
 * For storing customer information and recurring payments
 */
export async function createCustomer(customerData, appcode, secretKey = null) {
  try {
    const baseURL = 'https://openapi-int.qfapi.com'
    const endpoint = '/customer/v1/create'
    
    // Prepare request parameters (as per QFPay customer API spec)
    const requestParams = {
      name: customerData.name || 'Demo Customer',
      phone: customerData.phone || '',
      email: customerData.email || 'demo@example.com',      
    }
    
    console.log('[Server] Creating QFPay customer:', JSON.stringify(requestParams, null, 2))
    
    // Generate signature for customer creation
    const signatureResult = await generateQFPaySignature(requestParams, appcode, 'MD5', secretKey)
    
    if (!signatureResult.success) {
      throw new Error(`Customer creation signature generation failed: ${signatureResult.error}`)
    }
    
    console.log('[Server] Generated customer creation signature successfully')
    
    // Convert request parameters to URL-encoded format (as per QFPay docs)
    const formData = new URLSearchParams()
    Object.keys(requestParams).forEach(key => {
      formData.append(key, requestParams[key])
    })
    
    console.log('[Server] Request body (URL-encoded):', formData.toString())
    
    // Make API request to QFPay with correct content-type
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
    
    console.log('[Server] QFPay Customer API Response:', JSON.stringify(responseData, null, 2))
    
    // Check if API call was successful
    if (!response.ok) {
      throw new Error(`QFPay Customer API error: ${response.status} ${response.statusText}`)
    }
    
    // Check QFPay response code
    if (responseData.respcd !== '0000') {
      throw new Error(`QFPay Customer error: ${responseData.respcd} - ${responseData.respmsg || 'Unknown error'}`)
    }
    
    // Map QFPay customer response to our internal format
    const customer = {
      customer_id: responseData.data.customer_id,
      name: requestParams.name,
      email: requestParams.email,
      phone: requestParams.phone,
      created_at: responseData.sysdtm,
      respcd: responseData.respcd,
      raw_response: responseData
    }
    
    console.log('[Server] Customer created successfully:', customer.customer_id)
    return { success: true, customer }
    
  } catch (error) {
    console.error('[Server] Customer creation failed:', error)
    return {
      success: false,
      error: error.message,
      details: error.stack
    }
  }
}

/**
 * Server action to create QFPay token intent
 * For tokenized payments and card storage
 */
export async function createTokenIntent(customerId, appcode) {
  try {
    const baseURL = 'https://openapi-int.qfapi.com'
    const endpoint = '/payment_element/v1/create_token_intent'
    
    // Prepare request parameters (as per QFPay token intent API spec)
    const requestParams = {
      customer_id: customerId || `DEMO_CUSTOMER_${Date.now()}`,
      token_reason: 'QFPay Demo Token Creation'
    }
    
    console.log('[Server] Creating QFPay token intent:', JSON.stringify(requestParams, null, 2))
    
    // Generate signature for token intent creation
    const signatureResult = await generateQFPaySignature(requestParams, appcode, 'MD5')
    
    if (!signatureResult.success) {
      throw new Error(`Token intent signature generation failed: ${signatureResult.error}`)
    }
    
    console.log('[Server] Generated token intent signature successfully')
    
    // Convert request parameters to URL-encoded format (as per QFPay docs)
    const formData = new URLSearchParams()
    Object.keys(requestParams).forEach(key => {
      formData.append(key, requestParams[key])
    })
    
    console.log('[Server] Request body (URL-encoded):', formData.toString())
    
    // Make API request to QFPay with correct content-type
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
    
    console.log('[Server] QFPay Token Intent API Response:', JSON.stringify(responseData, null, 2))
    
    // Check if API call was successful
    if (!response.ok) {
      throw new Error(`QFPay Token Intent API error: ${response.status} ${response.statusText}`)
    }
    
    // Check QFPay response code
    if (responseData.respcd !== '0000') {
      throw new Error(`QFPay Token Intent error: ${responseData.respcd} - ${responseData.respmsg || 'Unknown error'}`)
    }
    
    // Map QFPay token intent response to our internal format
    const tokenIntent = {
      token_intent_id: responseData.token_intent || 'N/A',
      customer_id: requestParams.customer_id || customerId,
      created_at: responseData.sysdtm || new Date().toISOString(),
      expires_at: responseData.intent_expiry || 'N/A',
      respcd: responseData.respcd,
      raw_response: responseData
    }
    
    console.log('[Server] Token intent created successfully:', tokenIntent.token_intent_id)
    return { success: true, tokenIntent }
    
  } catch (error) {
    console.error('[Server] Token intent creation failed:', error)
    return {
      success: false,
      error: error.message,
      details: error.stack
    }
  }
}

/**
 * Server action to generate mock token ID for testing
 * In production, this would come from QFPay tokenization process
 */
export async function createMockToken() {
  try {
    // Generate a mock token ID that looks like QFPay format
    const timestamp = Date.now()
    const randomPart = Math.random().toString(36).substr(2, 16)
    const mockTokenId = `tk_${timestamp}_${randomPart}`
    
    console.log('[Server] Generated mock token ID:', mockTokenId)
    
    return {
      success: true,
      token: {
        token_id: mockTokenId,
        customer_id: null,
        created_at: new Date().toISOString(),
        status: 'active',
        type: 'card',
        last4: '1096',
        brand: 'mastercard',
        exp_month: 12,
        exp_year: new Date().getFullYear() + 2
      }
    }
  } catch (error) {
    console.error('[Server] Mock token generation failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Server action to generate test product data
 * Creates sample products for subscription testing
 */
export async function generateTestProducts() {
  const baseProducts = [
    {
      name: 'Basic Monthly Plan',
      type: 'recurring',
      txamt: 999, // $9.99
      txcurrcd: 'HKD',
      interval: 'monthly',
      interval_count: 1,
      description: 'Basic subscription plan with monthly billing'
    },
    {
      name: 'Premium Annual Plan', 
      type: 'recurring',
      txamt: 9999, // $99.99
      txcurrcd: 'HKD',
      interval: 'yearly',
      interval_count: 1,
      description: 'Premium subscription plan with annual billing'
    },
    {
      name: 'Weekly Newsletter',
      type: 'recurring',
      txamt: 299, // $2.99
      txcurrcd: 'HKD',
      interval: 'weekly',
      interval_count: 1,
      description: 'Weekly newsletter subscription'
    }
  ]
  
  return {
    success: true,
    testProducts: baseProducts
  }
}

/**
 * Server action to create real QFPay payment intent
 * Calls the actual QFPay API with proper authentication
 */
export async function createPaymentIntent(amount, currency = 'HKD', appcode, secretKey = null, customerId = null, tokenExpiry = null) {
  try {
    const baseURL = 'https://openapi-int.qfapi.com'
    const endpoint = '/payment_element/v1/create_payment_intent'
    
    // Generate unique merchant trade number
    const outTradeNo = `QF_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    
    // Generate timestamp in QFPay format (exactly as official example)
    const dateTime = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "")
    
    // Prepare request parameters (matching official example format + credit card)
    const requestParams = {
      txamt: amount.toString(), // Amount in cents
      txcurrcd: currency,
      pay_type: '802801', // Credit card payment (as requested)
      out_trade_no: outTradeNo,
      txdtm: dateTime // Required timestamp parameter (was missing before)
    }

    // Add customer_id if provided
    if (customerId && customerId.trim()) {
      requestParams.customer_id = customerId.trim()
    }

    // Add token expiry if provided (use string directly)
    if (tokenExpiry && tokenExpiry.trim()) {
      requestParams.intent_expiry = tokenExpiry.trim()
      console.log(`[Server] Token expiry set to: ${requestParams.intent_expiry}`)
    }
    
    console.log('[Server] Creating QFPay payment intent:', JSON.stringify(requestParams, null, 2))
    
    // Use provided secret key or fallback to environment variable
    const clientKey = secretKey || process.env.QFPAY_CLIENT_KEY || ''
    
    // Generate signature for payment intent creation
    const signatureResult = await generateQFPaySignature(requestParams, appcode, 'MD5', clientKey)
    
    if (!signatureResult.success) {
      throw new Error(`Payment intent signature generation failed: ${signatureResult.error}`)
    }
    
    console.log('[Server] Generated payment intent signature successfully')
    
    // Convert request parameters to URL-encoded format (as per QFPay docs)
    const formData = new URLSearchParams()
    Object.keys(requestParams).forEach(key => {
      formData.append(key, requestParams[key])
    })
    
    console.log('[Server] Request body (URL-encoded):', formData.toString())
    
    // Make API request to QFPay with correct content-type
    const response = await fetch(`${baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...signatureResult.headers,
        'Content-Type': 'application/x-www-form-urlencoded', // Fixed content-type
        'Accept': 'application/json'
      },
      body: formData.toString()
    })
    
    const responseData = await response.json()
    
    console.log('[Server] QFPay API Response:', JSON.stringify(responseData, null, 2))
    
    // Check if API call was successful
    if (!response.ok) {
      throw new Error(`QFPay API error: ${response.status} ${response.statusText}`)
    }
    
    // Check QFPay response code
    if (responseData.respcd !== '0000') {
      throw new Error(`QFPay error: ${responseData.respcd} - ${responseData.respmsg || 'Unknown error'}`)
    }
    
    // Map QFPay response to our internal format
    const paymentIntent = {
      payment_intent_id: responseData.payment_intent,
      out_trade_no: responseData.out_trade_no,
      amount: parseInt(responseData.txamt),
      currency: responseData.txcurrcd || currency,
      status: 'requires_payment_method',
      created_at: responseData.sysdtm,
      expires_at: responseData.intent_expiry,
      respcd: responseData.respcd,
      raw_response: responseData
    }
    
    console.log('[Server] Payment intent created successfully:', paymentIntent.payment_intent_id)
    return { success: true, paymentIntent }
    
  } catch (error) {
    console.error('[Server] Payment intent creation failed:', error)
    return {
      success: false,
      error: error.message,
      details: error.stack
    }
  }
}

