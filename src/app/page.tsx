'use client'

import { useEffect, useRef, useState } from 'react'
import { createCustomer, createPaymentIntent, createMockToken } from './actions'
import styles from './styles.module.css'

interface LogEntry {
  id: number
  timestamp: string
  message: string
  type: 'info' | 'success' | 'error'
}

interface Customer {
  customer_id: string
  name?: string
  email?: string
  phone?: string
  created_at?: string
  [key: string]: unknown
}

interface QFPayInstance {
  payment: () => QFPayPayment
  element: () => QFPayElement
  confirmPayment: () => Promise<QFPayResponse>
  retrievePaymentIntent: () => Promise<unknown>
  [key: string]: unknown
}

interface QFPayPayment {
  pay: (params: Record<string, string>, paymentIntentId: string) => void
}

interface QFPayElement {
  create: (selector: string) => void
}

interface QFPayResponse {
  [key: string]: unknown
}

interface Product {
  product_id?: string
  name: string
  type: string
  txamt: number
  txcurrcd: string
  interval?: string
  interval_count?: number
  description?: string
  created_at?: string
}

interface Subscription {
  subscription_id: string
  customer_id: string
  token_id: string
  products: Array<{ product_id: string; quantity: number }>
  state: string
  created_at?: string
  next_billing_time?: string
  last_billing_time?: string
  completed_billing_iteration?: number
  total_billing_cycles?: number
  start_time?: string
}

interface SubscriptionQueryResult {
  subscriptions: Subscription[]
  total_count: number
  page: number
  page_size: number
}

interface Token {
  token_id: string
  customer_id: string | null
  created_at: string
  status: string
  type: string
  last4: string
  brand: string
}

interface Config {
  environment: 'qa' | 'test' | 'live'
  customerName: string
  customerEmail: string
  customerId: string
  appcode: string
  secretKey: string
  tokenExpiry: string  // User input string (e.g., "15 minutes", "2024-12-01 10:30", etc.)
  intentType: 'payment'
  amount: number
  currency: string
}

declare global {
  interface Window {
    QFpay?: {
      config: (options: { region: string; env: string }) => QFPayInstance
    }
  }
}

export default function QFPayMinimal() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [qfpay, setQfpay] = useState<QFPayInstance | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Recurring payment states
  const [products, setProducts] = useState<Product[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [token, setToken] = useState<Token | null>(null)
  const [queryResult, setQueryResult] = useState<SubscriptionQueryResult | null>(null)
  
  // User input states for recurring payments
  const [productForm, setProductForm] = useState({
    name: '',
    type: 'recurring',
    txamt: '999', // in cents
    txcurrcd: 'HKD',
    interval: 'monthly',
    interval_count: '1',
    description: ''
  })
  
  const [subscriptionForm, setSubscriptionForm] = useState({
    customer_id: '',
    product_id: '',
    token_id: '',
    total_billing_cycles: '12',
    start_time: ''
  })

  const [queryForm, setQueryForm] = useState({
    subscription_id: '',
    customer_id: '',
    state: '',
    page: '1',
    page_size: '10'
  })
  
  const [config, setConfig] = useState<Config>(() => {
    // Calculate default token expiry: today + 2 years - 1 day at 00:00:00
    const today = new Date()
    const expiryDate = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate() - 1)
    const defaultExpiry = expiryDate.toISOString().split('T')[0] + ' 00:00:00' // yyyy-mm-dd 00:00:00
    
    return {
      environment: 'qa',
      customerName: '',
      customerEmail: '',
      customerId: '',
      appcode: '',
      secretKey: '',
      tokenExpiry: defaultExpiry,
      intentType: 'payment',
      amount: 500,
      currency: 'HKD'
    }
  })
  
  // Log handler
  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      type,
      id: Date.now() + Math.random()
    }
    setLogs(prev => [logEntry, ...prev])
    console.log(`[QFPay Minimal] ${type.toUpperCase()}: ${message}`)
  }
  
  // Initialize QFPay SDK
  const initializeQFPay = async () => {
    if (!window.QFpay) {
      setError(`QFPay SDK not loaded for ${config.environment} environment. Please refresh the page.`)
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      addLog('Initializing QFPay with minimal config...', 'info')
      
      // Step 1: initialize qfpay object (minimal example)
      const regionMap = {
        'qa': 'qa',
        'test': 'hk', 
        'live': 'hk'
      }
      
      const envMap = {
        'qa': 'qa',
        'test': 'test',
        'live': 'prod'
      }
      
      const qfpayInstance = window.QFpay.config({
        region: regionMap[config.environment] || 'qa',
        env: envMap[config.environment] || 'qa',
      })
      setQfpay(qfpayInstance)
      
      addLog('QFPay instance created successfully', 'success')
      addLog(`QFPay methods: ${Object.keys(qfpayInstance).join(', ')}`, 'info')
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      addLog(`QFPay initialization failed: ${errorMessage}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }
  
  // Create customer first
  const createCustomerRecord = async () => {
    if (!config.appcode.trim()) {
      setError('APPCODE is required for customer creation')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      addLog('Creating customer record...', 'info')
      
      const customerData = {
        name: config.customerName || 'Demo Customer',
        email: config.customerEmail || 'demo@example.com',
        phone: '1234567890',        
      }
      
      const result = await createCustomer(
        customerData, 
        config.appcode, 
        config.secretKey
      )
      console.log('Customer Creation Result:', result)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      const customerRecord = result.customer
      if (!customerRecord) {
        throw new Error('No customer data returned')
      }
      
      setCustomer(customerRecord as Customer)
      
      addLog(`Customer created: ${customerRecord.customer_id}`, 'success')
      addLog(`Customer name: ${customerRecord.name}`, 'info')
      addLog(`Customer email: ${customerRecord.email}`, 'info')
      
      // Auto-copy customer ID to configuration and subscription form
      setConfig(prev => ({ ...prev, customerId: customerRecord.customer_id }))
      setSubscriptionForm(prev => ({ ...prev, customer_id: customerRecord.customer_id }))
      addLog('Auto-copied customer ID to configuration and subscription form', 'info')
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      addLog(`Customer creation failed: ${errorMessage}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }
  
  // Create payment intent 
  const setupPaymentIntent = async () => {
    if (!qfpay) {
      setError('QFPay not initialized')
      return
    }
    
    if (!config.appcode.trim()) {
      setError('APPCODE is required')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      addLog('Creating payment intent via server...', 'info')
      
      // Create real payment intent with customer ID and token expiry
      const result = await createPaymentIntent(
        config.amount, 
        config.currency, 
        config.appcode,
        config.secretKey,
        config.customerId || null,
        config.tokenExpiry || null
      )
      console.log('Payment Intent Result:', result)
      if (!result.success) {
        throw new Error(result.error)
      }
      
      const paymentIntent = result.paymentIntent
      if (!paymentIntent) {
        throw new Error('No payment intent data returned')
      }
      
      setPaymentIntentId(paymentIntent.payment_intent_id)
      
      addLog(`Payment intent created: ${paymentIntent.payment_intent_id}`, 'success')
      addLog(`Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency}`, 'info')
      addLog(`Expires: ${paymentIntent.expires_at || 'N/A'}`, 'info')
      
      // Step 2: initialize payment object
      const payment = qfpay.payment()
      addLog('Payment object initialized', 'info')
      
      // Step 3: set payment parameters
      payment.pay({
        goods_name: "QFPay Payment Demo",
        paysource: "payment_element",
        customer_id: config.customerId,
        // token_expiry: '2026-12-31',
        // token_reason: 'subscription',
        // token_reference: 'ref_' + Date.now(),
      }, paymentIntent.payment_intent_id)
      
      addLog('Payment parameters set', 'info')
      
      // Step 4: initialize element object and generate card form
      const elements = qfpay.element()
      addLog('Elements object created', 'info')
      
      // Clear container
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
        
        // elements.createEnhance({
        //   selector: "#qfpay-minimal-container",
        //   email: false,
        // })

        elements.create('#qfpay-minimal-container')
        
        addLog('Payment card form generated with createEnhance', 'success')
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      addLog(`Payment intent setup failed: ${errorMessage}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }
  
  // Create a product from form data
  const createCustomProduct = async () => {
    if (!config.appcode) {
      setError('APPCODE is required for product creation')
      return
    }

    if (!productForm.name.trim()) {
      setError('Product name is required')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const productData = {
        name: productForm.name.trim(),
        type: productForm.type,
        txamt: parseInt(productForm.txamt),
        txcurrcd: productForm.txcurrcd,
        interval: productForm.interval,
        interval_count: parseInt(productForm.interval_count),
        description: productForm.description.trim() || undefined
      }

      addLog(`Creating custom product: ${productData.name}`, 'info')

      const response = await fetch('/api/qfpay/product/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productData,
          appcode: config.appcode,
          secretKey: config.secretKey
        })
      })

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error)
      }

      setProducts(prev => [...prev, result.product])
      addLog(`Product created: ${result.product.product_id}`, 'success')
      addLog(`Product details: ${result.product.name} - ${result.product.txamt/100} ${result.product.txcurrcd}`, 'info')

      // Auto-copy product ID to subscription form
      setSubscriptionForm(prev => ({ ...prev, product_id: result.product.product_id }))
      addLog('Product ID auto-copied to subscription form', 'info')

      // Reset form
      setProductForm({
        name: '',
        type: 'recurring',
        txamt: '999',
        txcurrcd: 'HKD',
        interval: 'monthly',
        interval_count: '1',
        description: ''
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      addLog(`Product creation failed: ${errorMessage}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Create a product from sample data
  const createProduct = async (productData: Product) => {
    if (!config.appcode) {
      setError('APPCODE is required for product creation')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      addLog(`Creating product: ${productData.name}`, 'info')

      const response = await fetch('/api/qfpay/product/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productData,
          appcode: config.appcode,
          secretKey: config.secretKey
        })
      })

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error)
      }

      setProducts(prev => [...prev, result.product])
      addLog(`Product created: ${result.product.product_id}`, 'success')
      addLog(`Product details: ${result.product.name} - ${result.product.txamt/100} ${result.product.txcurrcd}`, 'info')

      // Auto-copy product ID to subscription form
      setSubscriptionForm(prev => ({ ...prev, product_id: result.product.product_id }))
      addLog('Product ID auto-copied to subscription form', 'info')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      addLog(`Product creation failed: ${errorMessage}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Generate mock token for testing
  const createTokenRecord = async () => {
    try {
      addLog('Generating mock token for testing', 'info')

      const result = await createMockToken()

      if (!result.success) {
        throw new Error(result.error)
      }

      if (!result.token) {
        throw new Error('No token data returned')
      }

      const tokenData = result.token
      const tokenRecord = {
        ...tokenData,
        customer_id: customer?.customer_id || null
      }

      setToken(tokenRecord as Token)
      addLog(`Mock token created: ${tokenData.token_id}`, 'success')
      addLog(`Token details: ${tokenData.brand} ending in ${tokenData.last4}`, 'info')

      // Auto-copy token ID to subscription form
      setSubscriptionForm(prev => ({ ...prev, token_id: tokenData.token_id }))
      addLog('Token ID auto-copied to subscription form', 'info')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      addLog(`Token creation failed: ${errorMessage}`, 'error')
    }
  }

  // Create subscription from form data
  const createCustomSubscription = async () => {
    if (!config.appcode) {
      setError('APPCODE is required for subscription creation')
      return
    }

    if (!subscriptionForm.customer_id.trim()) {
      setError('Customer ID is required for subscription creation')
      return
    }

    if (!subscriptionForm.product_id.trim()) {
      setError('Product ID is required for subscription creation')
      return
    }

    if (!subscriptionForm.token_id.trim()) {
      setError('Token ID is required for subscription creation')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      addLog(`Creating subscription with custom parameters`, 'info')

      const subscriptionData = {
        customer_id: subscriptionForm.customer_id.trim(),
        token_id: subscriptionForm.token_id.trim(),
        products: [
          {
            product_id: subscriptionForm.product_id.trim(),
            quantity: 1
          }
        ],
        total_billing_cycles: subscriptionForm.total_billing_cycles ? parseInt(subscriptionForm.total_billing_cycles) : undefined,
        start_time: subscriptionForm.start_time.trim() || new Date().toISOString().replace(/T/, " ").replace(/\..+/, ""),
        appcode: config.appcode,
        secretKey: config.secretKey
      }

      const response = await fetch('/api/qfpay/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionData)
      })

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error)
      }

      setSubscriptions(prev => [...prev, result.subscription])
      addLog(`Subscription created: ${result.subscription.subscription_id}`, 'success')
      addLog(`Subscription state: ${result.subscription.state}`, 'info')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      addLog(`Subscription creation failed: ${errorMessage}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Create subscription from product card (quick action)
  const createSubscription = async (productId: string) => {
    if (!customer || !token || !config.appcode) {
      setError('Customer, token, and APPCODE are required for subscription creation')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      addLog(`Creating subscription for product: ${productId}`, 'info')

      const subscriptionData = {
        customer_id: customer.customer_id,
        token_id: token.token_id,
        products: [
          {
            product_id: productId,
            quantity: 1
          }
        ],
        total_billing_cycles: 12,
        start_time: new Date().toISOString().replace(/T/, " ").replace(/\..+/, ""),
        appcode: config.appcode,
        secretKey: config.secretKey
      }

      const response = await fetch('/api/qfpay/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionData)
      })

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error)
      }

      setSubscriptions(prev => [...prev, result.subscription])
      addLog(`Subscription created: ${result.subscription.subscription_id}`, 'success')
      addLog(`Subscription state: ${result.subscription.state}`, 'info')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      addLog(`Subscription creation failed: ${errorMessage}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Query existing subscriptions
  const querySubscriptions = async () => {
    if (!config.appcode) {
      setError('APPCODE is required for subscription query')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      addLog('Querying existing subscriptions', 'info')

      const queryData: Record<string, unknown> = {
        appcode: config.appcode,
        secretKey: config.secretKey,
        page: parseInt(queryForm.page) || 1,
        page_size: parseInt(queryForm.page_size) || 10
      }

      // Add optional filters if provided
      if (queryForm.subscription_id.trim()) {
        queryData.subscription_id = queryForm.subscription_id.trim()
      }
      if (queryForm.customer_id.trim()) {
        queryData.customer_id = queryForm.customer_id.trim()
      }
      if (queryForm.state) {
        queryData.state = queryForm.state
      }

      const response = await fetch('/api/qfpay/subscription/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryData)
      })

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error)
      }

      setQueryResult(result.result)
      addLog(`Query successful: Found ${result.result.total_count} subscriptions`, 'success')
      addLog(`Showing page ${result.result.page} of ${Math.ceil(result.result.total_count / result.result.page_size)}`, 'info')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      addLog(`Subscription query failed: ${errorMessage}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Create sample products
  const createSampleProducts = async () => {
    const testProducts = [
      {
        name: 'Basic Monthly Plan',
        type: 'recurring',
        txamt: 999,
        txcurrcd: 'HKD',
        interval: 'monthly',
        interval_count: 1,
        description: 'Basic subscription plan with monthly billing'
      },
      {
        name: 'Premium Annual Plan',
        type: 'recurring', 
        txamt: 9999,
        txcurrcd: 'HKD',
        interval: 'yearly',
        interval_count: 1,
        description: 'Premium subscription plan with annual billing'
      }
    ]

    for (const product of testProducts) {
      await createProduct(product)
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // Combined setup function that handles payment intent
  const setupPayment = async () => {
    await setupPaymentIntent()
  }
  
  // Process payment
  const processPayment = async () => {
    if (!qfpay) {
      setError('QFPay not initialized')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      addLog('Processing payment...', 'info')
      
      // Step 5: trigger card form submission and receive payment response (minimal example)      
      const response = await qfpay.confirmPayment()
      
      addLog(`Payment response: ${JSON.stringify(response)}`, 'success')
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      addLog(`Payment processing failed: ${errorMessage}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Save configuration to localStorage
  const saveConfiguration = () => {
    try {
      const configToSave = { ...config }
      localStorage.setItem('qfpay-demo-config', JSON.stringify(configToSave))
      addLog('Configuration saved to browser storage', 'success')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      addLog(`Failed to save configuration: ${errorMessage}`, 'error')
    }
  }

  // Load configuration from localStorage
  const loadConfiguration = () => {
    try {
      const saved = localStorage.getItem('qfpay-demo-config')
      if (saved) {
        const savedConfig = JSON.parse(saved) as Config
        setConfig(savedConfig)
        addLog('Configuration loaded from browser storage', 'success')
      } else {
        addLog('No saved configuration found', 'info')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      addLog(`Failed to load configuration: ${errorMessage}`, 'error')
    }
  }

  // Handle environment change with save and refresh
  const handleEnvironmentChange = (newEnvironment: 'qa' | 'test' | 'live') => {
    const updatedConfig = { ...config, environment: newEnvironment }
    setConfig(updatedConfig)
    
    // Save immediately
    try {
      localStorage.setItem('qfpay-demo-config', JSON.stringify(updatedConfig))
      addLog(`Environment changed to ${newEnvironment}. Refreshing page to load correct SDK...`, 'info')
      
      // Refresh page after a short delay to show the log message
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      addLog(`Failed to save configuration: ${errorMessage}`, 'error')
    }
  }


  // Reset all state to start over
  const resetDemo = () => {
    // Clear all state
    setQfpay(null)
    setCustomer(null)
    setPaymentIntentId(null)
    setIsLoading(false)
    setError(null)
    setLogs([])
    
    // Clear the payment container
    if (containerRef.current) {
      containerRef.current.innerHTML = '<div style="text-align: center; color: #666;">QFPay card form will appear here after setup</div>'
    }
    
    addLog('Demo reset - ready to start over', 'info')
  }

  // Copy text to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      addLog(`${label} copied to clipboard`, 'success')
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      addLog(`${label} copied to clipboard`, 'success')
    }
  }

  // Copy card number to clipboard
  const copyCardNumber = async (cardNumber: string) => {
    await copyToClipboard(cardNumber.replace(/\s/g, ''), `Card number ${cardNumber}`)
  }
  
  // Set container ID on mount
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.id = 'qfpay-minimal-container'
    }
  }, [])

  // Auto-load configuration on startup
  useEffect(() => {
    loadConfiguration()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  
  return (
    <div className={styles.nativeDemoContainer}>
      {/* Header */}
      <div className={styles.demoHeader}>
        <h1>QFPay Minimal Example</h1>
        <p className={styles.subtitle}>
          Direct payments • Payment processing • Minimal QFPay implementation
        </p>
        <div className={styles.warning}>
          ✅ <strong>Payment Approach:</strong> {' '}
          Uses create_payment_intent API for direct payment processing
        </div>
        <div style={{ marginTop: '15px', padding: '10px', background: '#f0f8ff', borderRadius: '4px', fontSize: '14px' }}>
          🔄 <strong>Enhanced:</strong> Now includes recurring payment testing below - create products and subscriptions for recurring billing
        </div>
      </div>

      {/* Configuration */}
      <div className={styles.configSection}>
        <h4>Configuration</h4>
        <div className={styles.configControls}>
          <label>
            Environment:
            <select 
              value={config.environment}
              onChange={(e) => handleEnvironmentChange(e.target.value as 'qa' | 'test' | 'live')}
              disabled={isLoading}
            >
              <option value="qa">QA/Sandbox (Testing)</option>
              <option value="test">Live Test Environment</option>
              <option value="live">Production (Live)</option>
            </select>
          </label>
          
          <label>
            Demo Mode:
            <select 
              value={config.intentType}
              onChange={(e) => setConfig(prev => ({ ...prev, intentType: e.target.value as 'payment' }))}
              disabled={isLoading}
            >
              <option value="payment">Payment Intent (Direct Payment + Recurring)</option>
            </select>
          </label>
          
          <label>
            Customer ID:
            <input 
              type="text"
              value={config.customerId}
              onChange={(e) => setConfig(prev => ({ ...prev, customerId: e.target.value }))}
              disabled={isLoading}
              placeholder="Leave empty to create new customer"
            />
          </label>

          
          {config.intentType === 'payment' && (
            <>
              <label>
                Amount ({config.currency}):
                <input 
                  type="number"
                  min="2"
                  step="0.01"
                  value={(config.amount / 100).toFixed(2)}
                  onChange={(e) => {
                    const amount = Math.max(200, Math.round(parseFloat(e.target.value || '0') * 100))
                    setConfig(prev => ({ ...prev, amount }))
                  }}
                  disabled={isLoading}
                />
              </label>
              
              <label>
                Currency:
                <select 
                  value={config.currency}
                  onChange={(e) => setConfig(prev => ({ ...prev, currency: e.target.value }))}
                  disabled={isLoading}
                >
                  <option value="HKD">Hong Kong Dollar</option>
                  <option value="USD">US Dollar</option>
                  <option value="CNY">Chinese Yuan</option>
                </select>
              </label>
            </>
          )}
          
          <label>
            QFPay APPCODE:
            <input 
              type="text"
              value={config.appcode}
              onChange={(e) => setConfig(prev => ({ ...prev, appcode: e.target.value }))}
              disabled={isLoading}
              placeholder="Enter merchant APPCODE"
            />
          </label>
          
          <label>
            QFPay Secret Key:
            <input 
              type="password"
              value={config.secretKey}
              onChange={(e) => setConfig(prev => ({ ...prev, secretKey: e.target.value }))}
              disabled={isLoading}
              placeholder="Enter merchant secret key"
            />
          </label>
          
          <label>
            Token Expiry:
            <input 
              type="text"
              value={config.tokenExpiry}
              onChange={(e) => setConfig(prev => ({ ...prev, tokenExpiry: e.target.value }))}
              disabled={isLoading}
              placeholder="e.g., '15 minutes', '2024-12-01 10:30', '1 hour'"
            />
          </label>
        </div>
        
        {/* Configuration Management */}
        <div className={styles.configControls} style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={saveConfiguration}
              className={styles.btnSecondary}
              style={{ padding: '8px 12px' }}
            >
              💾 Save Config
            </button>
            
            <button 
              onClick={loadConfiguration}
              className={styles.btnSecondary}
              style={{ padding: '8px 12px' }}
            >
              📁 Load Config
            </button>
          </div>
        </div>
      </div>
      
      {/* Customer Creation Testing */}
      <div className={styles.configSection}>
        <h4>Customer Creation Testing (Optional)</h4>
        <div className={styles.configControls}>
          <label>
            Customer Name:
            <input 
              type="text"
              value={config.customerName}
              onChange={(e) => setConfig(prev => ({ ...prev, customerName: e.target.value }))}
              disabled={isLoading || !!customer}
              placeholder="Enter customer name"
            />
          </label>
          
          <label>
            Customer Email:
            <input 
              type="email"
              value={config.customerEmail}
              onChange={(e) => setConfig(prev => ({ ...prev, customerEmail: e.target.value }))}
              disabled={isLoading || !!customer}
              placeholder="customer@example.com"
            />
          </label>
          
          <button 
            onClick={createCustomerRecord}
            disabled={!!customer || isLoading}
            className={styles.btnSecondary}
            style={{ marginTop: '10px' }}
          >
            {isLoading ? '⏳ Creating...' : 'Create New Customer'}
          </button>
          
          <div style={{ padding: '10px', background: '#f0f8ff', borderRadius: '4px', fontSize: '14px', marginTop: '10px' }}>
            🔧 <strong>Testing:</strong> Use this section to create a new customer, or use the default Customer ID above
          </div>
        </div>
      </div>
      
      {/* Status */}
      <div className={styles.statusSection}>
        <h4>Status</h4>
        <div className={styles.statusGrid}>
          <div className={`${styles.statusItem} ${qfpay ? styles.statusSuccess : styles.statusPending}`}>
            QFPay: {qfpay ? '✅ Ready' : '⏳ Not Ready'}
          </div>          
          <div className={`${styles.statusItem} ${paymentIntentId ? styles.statusSuccess : styles.statusPending}`}>
            Payment Intent: {paymentIntentId ? '✅ Created' : '⏳ Not Created'}
          </div>
          <div className={`${styles.statusItem} ${products.length > 0 ? styles.statusSuccess : styles.statusPending}`}>
            Products: {products.length > 0 ? `✅ ${products.length} Created` : '⏳ None Created'}
          </div>
          <div className={`${styles.statusItem} ${token ? styles.statusSuccess : styles.statusPending}`}>
            Token: {token ? '✅ Generated' : '⏳ Not Generated'}
          </div>
        </div>
        
        {error && (
          <div style={{ 
            padding: '15px', 
            margin: '10px 0', 
            backgroundColor: '#fef2f2', 
            border: '1px solid #fecaca', 
            borderRadius: '8px',
            color: '#dc2626'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>🚨 Error</div>
            <div style={{ fontSize: '14px', lineHeight: '1.4' }}>{error}</div>
          </div>
        )}
      </div>

      {/* Demo Credit Cards Reference */}
      <div className={styles.configSection}>
        <h4>Test Credit Cards</h4>
        <div style={{ 
          background: '#f8fafc', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px', 
          padding: '15px',
          fontSize: '14px'
        }}>
          <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#374151' }}>
            Use these test cards for demo purposes:
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'auto 1fr auto', 
            gap: '8px 15px',
            fontFamily: 'monospace',
            fontSize: '13px',
            alignItems: 'center'
          }}>
            <div style={{ fontWeight: 'bold' }}>Card Type</div>
            <div style={{ fontWeight: 'bold' }}>Number</div>
            <div style={{ fontWeight: 'bold' }}>Expected Result</div>
            
            <div>MasterCard</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>5200 0000 0000 1096</span>
              <button 
                onClick={() => copyCardNumber('5200 0000 0000 1096')}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: '#6b7280',
                  fontFamily: 'inherit'
                }}
                title="Copy card number"
              >
                📋
              </button>
            </div>
            <div style={{ color: '#10b981' }}>✅ Valid</div>
            
            <div>Visa</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>4000 0000 0000 1091</span>
              <button 
                onClick={() => copyCardNumber('4000 0000 0000 1091')}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: '#6b7280',
                  fontFamily: 'inherit'
                }}
                title="Copy card number"
              >
                📋
              </button>
            </div>
            <div style={{ color: '#10b981' }}>✅ Valid</div>
            
            <div>MasterCard</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>5200 0000 0000 1005</span>
              <button 
                onClick={() => copyCardNumber('5200 0000 0000 1005')}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: '#6b7280',
                  fontFamily: 'inherit'
                }}
                title="Copy card number"
              >
                📋
              </button>
            </div>
            <div style={{ color: '#10b981' }}>✅ Valid (3DS frictionless)</div>
            
            <div>Visa</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>4000 0000 0000 1000</span>
              <button 
                onClick={() => copyCardNumber('4000 0000 0000 1000')}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: '#6b7280',
                  fontFamily: 'inherit'
                }}
                title="Copy card number"
              >
                📋
              </button>
            </div>
            <div style={{ color: '#10b981' }}>✅ Valid (3DS frictionless)</div>
            
            <div>MasterCard</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>5200 0000 0000 1120</span>
              <button 
                onClick={() => copyCardNumber('5200 0000 0000 1120')}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: '#6b7280',
                  fontFamily: 'inherit'
                }}
                title="Copy card number"
              >
                📋
              </button>
            </div>
            <div style={{ color: '#dc2626' }}>❌ Failed (at verification)</div>
            
            <div>Visa</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>4000 0000 0000 1125</span>
              <button 
                onClick={() => copyCardNumber('4000 0000 0000 1125')}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: '#6b7280',
                  fontFamily: 'inherit'
                }}
                title="Copy card number"
              >
                📋
              </button>
            </div>
            <div style={{ color: '#dc2626' }}>❌ Failed (at verification)</div>
            
            <div>MasterCard</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>5200 0000 0000 1013</span>
              <button 
                onClick={() => copyCardNumber('5200 0000 0000 1013')}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: '#6b7280',
                  fontFamily: 'inherit'
                }}
                title="Copy card number"
              >
                📋
              </button>
            </div>
            <div style={{ color: '#dc2626' }}>❌ Failed (at 3DS frictionless)</div>
            
            <div>Visa</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>4000 0000 0000 1018</span>
              <button 
                onClick={() => copyCardNumber('4000 0000 0000 1018')}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: '#6b7280',
                  fontFamily: 'inherit'
                }}
                title="Copy card number"
              >
                📋
              </button>
            </div>
            <div style={{ color: '#dc2626' }}>❌ Failed (at 3DS frictionless)</div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
            💡 <strong>Tip:</strong> Use any future expiry date (e.g., 12/25) and any 3-digit CVV (e.g., 123) for testing
          </div>
        </div>
      </div>

      {/* Payment Container */}
      <div className={styles.paymentSection}>
        <h4>QFPay Card Form (createEnhance)</h4>
        <div 
          ref={containerRef}
          className={styles.nativeContainer}
          style={{
            minHeight: '200px',
            border: '2px solid #e2e8f0',
            borderRadius: '8px',
            padding: '20px',
            background: '#ffffff'
          }}
        >
          <div style={{ textAlign: 'center', color: '#666' }}>
            QFPay card form will appear here after setup
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actionSection}>
        <h4>Direct Payment Steps</h4>
        <div className={styles.actionButtons}>
          <button 
            onClick={initializeQFPay}
            disabled={!!qfpay || isLoading}
            className={styles.btn}
          >
            {isLoading ? '⏳ Initializing...' : '1. QFpay.config()'}
          </button>
          
          <button 
            onClick={setupPayment}
            disabled={!qfpay || !!paymentIntentId || isLoading}
            className={styles.btn}
          >
            {isLoading ? '⏳ Setting up...' : `2. Payment Intent + createEnhance()`}
          </button>
          
          <button 
            onClick={processPayment}
            disabled={!paymentIntentId || isLoading}
            className={styles.btn}
          >
            {isLoading ? '⏳ Processing...' : '3. confirmPayment()'}
          </button>
          
          <button 
            onClick={resetDemo}
            disabled={isLoading}
            className={styles.btnSecondary}
            style={{ marginLeft: 'auto' }}
          >
            🔄 Reset Demo
          </button>
        </div>
      </div>

      {/* Recurring Payment Testing Section */}
      <div className={styles.actionSection}>
        <h4>🔄 Recurring Payment Testing</h4>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '15px' }}>
          Test QFPay&apos;s recurring billing by creating products and subscriptions
        </p>
        
        {/* Quick Start Buttons */}
        <div className={styles.actionButtons} style={{ marginBottom: '20px' }}>
          <button 
            onClick={createSampleProducts}
            disabled={isLoading || !config.appcode}
            className={styles.btn}
          >
            {isLoading ? '⏳ Creating...' : 'Quick: Create Sample Products'}
          </button>
          
          <button 
            onClick={createCustomerRecord}
            disabled={isLoading || !config.appcode || !!customer}
            className={styles.btn}
          >
            {isLoading ? '⏳ Creating...' : customer ? '✅ Customer Created' : 'Create Customer'}
          </button>
          
          <button 
            onClick={createTokenRecord}
            disabled={isLoading || !customer || !!token}
            className={styles.btn}
          >
            {isLoading ? '⏳ Generating...' : token ? '✅ Token Generated' : 'Generate Mock Token'}
          </button>
        </div>

        {/* Custom Product Creation Form */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px', background: '#fafafa' }}>
          <h5 style={{ margin: '0 0 15px 0', color: '#374151' }}>🛍️ Create Custom Product</h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <label>
              Product Name:
              <input 
                type="text"
                value={productForm.name}
                onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                disabled={isLoading}
                placeholder="e.g., Premium Monthly Plan"
                style={{ marginTop: '5px' }}
              />
            </label>
            
            <label>
              Amount (in cents):
              <input 
                type="number"
                value={productForm.txamt}
                onChange={(e) => setProductForm(prev => ({ ...prev, txamt: e.target.value }))}
                disabled={isLoading}
                placeholder="999 = $9.99"
                min="1"
                style={{ marginTop: '5px' }}
              />
            </label>

            <label>
              Currency:
              <select 
                value={productForm.txcurrcd}
                onChange={(e) => setProductForm(prev => ({ ...prev, txcurrcd: e.target.value }))}
                disabled={isLoading}
                style={{ marginTop: '5px' }}
              >
                <option value="HKD">Hong Kong Dollar</option>
                <option value="USD">US Dollar</option>
                <option value="CNY">Chinese Yuan</option>
              </select>
            </label>

            <label>
              Billing Interval:
              <select 
                value={productForm.interval}
                onChange={(e) => setProductForm(prev => ({ ...prev, interval: e.target.value }))}
                disabled={isLoading}
                style={{ marginTop: '5px' }}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </label>

            <label>
              Interval Count:
              <input 
                type="number"
                value={productForm.interval_count}
                onChange={(e) => setProductForm(prev => ({ ...prev, interval_count: e.target.value }))}
                disabled={isLoading}
                placeholder="1"
                min="1"
                style={{ marginTop: '5px' }}
              />
            </label>

            <label>
              Type:
              <select 
                value={productForm.type}
                onChange={(e) => setProductForm(prev => ({ ...prev, type: e.target.value }))}
                disabled={isLoading}
                style={{ marginTop: '5px' }}
              >
                <option value="recurring">Recurring</option>
                <option value="onetime">One-time</option>
              </select>
            </label>
          </div>

          <label style={{ display: 'block', marginBottom: '15px' }}>
            Description (Optional):
            <textarea 
              value={productForm.description}
              onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
              disabled={isLoading}
              placeholder="Product description for customers"
              rows={2}
              style={{ marginTop: '5px', width: '100%', resize: 'vertical' }}
            />
          </label>

          <button 
            onClick={createCustomProduct}
            disabled={isLoading || !config.appcode || !productForm.name.trim()}
            className={styles.btn}
            style={{ width: '100%' }}
          >
            {isLoading ? '⏳ Creating Product...' : 'Create Custom Product'}
          </button>
        </div>

        {/* Custom Subscription Creation Form */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', background: '#fafafa' }}>
          <h5 style={{ margin: '0 0 15px 0', color: '#374151' }}>🔄 Create Custom Subscription</h5>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <label>
              Customer ID:
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginTop: '5px' }}>
                <input 
                  type="text"
                  value={subscriptionForm.customer_id}
                  onChange={(e) => setSubscriptionForm(prev => ({ ...prev, customer_id: e.target.value }))}
                  disabled={isLoading}
                  placeholder="cust_xxxxxxxx or auto-filled"
                  style={{ flex: 1 }}
                />
                <button 
                  onClick={() => copyToClipboard(subscriptionForm.customer_id, 'Customer ID')}
                  disabled={!subscriptionForm.customer_id}
                  style={{
                    background: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                  title="Copy Customer ID"
                >
                  📋
                </button>
              </div>
            </label>

            <label>
              Product ID:
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginTop: '5px' }}>
                <input 
                  type="text"
                  value={subscriptionForm.product_id}
                  onChange={(e) => setSubscriptionForm(prev => ({ ...prev, product_id: e.target.value }))}
                  disabled={isLoading}
                  placeholder="prod_xxxxxxxx or auto-filled"
                  style={{ flex: 1 }}
                />
                <button 
                  onClick={() => copyToClipboard(subscriptionForm.product_id, 'Product ID')}
                  disabled={!subscriptionForm.product_id}
                  style={{
                    background: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                  title="Copy Product ID"
                >
                  📋
                </button>
              </div>
            </label>

            <label>
              Token ID:
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginTop: '5px' }}>
                <input 
                  type="text"
                  value={subscriptionForm.token_id}
                  onChange={(e) => setSubscriptionForm(prev => ({ ...prev, token_id: e.target.value }))}
                  disabled={isLoading}
                  placeholder="tk_xxxxxxxx or auto-filled"
                  style={{ flex: 1 }}
                />
                <button 
                  onClick={() => copyToClipboard(subscriptionForm.token_id, 'Token ID')}
                  disabled={!subscriptionForm.token_id}
                  style={{
                    background: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                  title="Copy Token ID"
                >
                  📋
                </button>
              </div>
            </label>

            <label>
              Total Billing Cycles:
              <input 
                type="number"
                value={subscriptionForm.total_billing_cycles}
                onChange={(e) => setSubscriptionForm(prev => ({ ...prev, total_billing_cycles: e.target.value }))}
                disabled={isLoading}
                placeholder="12 (leave empty for unlimited)"
                min="1"
                style={{ marginTop: '5px' }}
              />
            </label>

            <label>
              Start Time (Optional):
              <input 
                type="datetime-local"
                value={subscriptionForm.start_time}
                onChange={(e) => setSubscriptionForm(prev => ({ ...prev, start_time: e.target.value }))}
                disabled={isLoading}
                style={{ marginTop: '5px' }}
              />
            </label>
          </div>

          <button 
            onClick={createCustomSubscription}
            disabled={isLoading || !config.appcode || !subscriptionForm.customer_id.trim() || !subscriptionForm.product_id.trim() || !subscriptionForm.token_id.trim()}
            className={styles.btn}
            style={{ width: '100%' }}
          >
            {isLoading ? '⏳ Creating Subscription...' : 'Create Custom Subscription'}
          </button>

          {(!subscriptionForm.customer_id || !subscriptionForm.product_id || !subscriptionForm.token_id) && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
              {!subscriptionForm.customer_id && '• Customer ID required '}
              {!subscriptionForm.product_id && '• Product ID required '}
              {!subscriptionForm.token_id && '• Token ID required '}
            </div>
          )}
        </div>

        {/* Subscription Query Section */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginTop: '20px', background: '#fafafa' }}>
          <h5 style={{ margin: '0 0 15px 0', color: '#374151' }}>🔍 Query Existing Subscriptions</h5>
          <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '15px' }}>
            Search for existing subscriptions by ID, customer, or state
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <label>
              Subscription ID (Optional):
              <input 
                type="text"
                value={queryForm.subscription_id}
                onChange={(e) => setQueryForm(prev => ({ ...prev, subscription_id: e.target.value }))}
                disabled={isLoading}
                placeholder="sub_xxxxxxxx"
                style={{ marginTop: '5px' }}
              />
            </label>

            <label>
              Customer ID (Optional):
              <input 
                type="text"
                value={queryForm.customer_id}
                onChange={(e) => setQueryForm(prev => ({ ...prev, customer_id: e.target.value }))}
                disabled={isLoading}
                placeholder="cust_xxxxxxxx"
                style={{ marginTop: '5px' }}
              />
            </label>

            <label>
              Subscription State (Optional):
              <select 
                value={queryForm.state}
                onChange={(e) => setQueryForm(prev => ({ ...prev, state: e.target.value }))}
                disabled={isLoading}
                style={{ marginTop: '5px' }}
              >
                <option value="">All States</option>
                <option value="incomplete">Incomplete</option>
                <option value="active">Active</option>
                <option value="past_due">Past Due</option>
                <option value="canceled">Canceled</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </label>

            <label>
              Page Size:
              <select 
                value={queryForm.page_size}
                onChange={(e) => setQueryForm(prev => ({ ...prev, page_size: e.target.value }))}
                disabled={isLoading}
                style={{ marginTop: '5px' }}
              >
                <option value="5">5 per page</option>
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
            <button 
              onClick={querySubscriptions}
              disabled={isLoading || !config.appcode}
              className={styles.btn}
              style={{ flex: 1 }}
            >
              {isLoading ? '⏳ Searching...' : 'Search Subscriptions'}
            </button>
            
            {queryResult && queryResult.total_count > queryResult.page_size && (
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <button 
                  onClick={() => {
                    const newPage = Math.max(1, parseInt(queryForm.page) - 1)
                    setQueryForm(prev => ({ ...prev, page: newPage.toString() }))
                  }}
                  disabled={isLoading || parseInt(queryForm.page) <= 1}
                  className={styles.btnSecondary}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  ← Prev
                </button>
                
                <span style={{ fontSize: '12px', color: '#6b7280', padding: '0 8px' }}>
                  Page {queryForm.page}
                </span>
                
                <button 
                  onClick={() => {
                    const maxPages = Math.ceil(queryResult.total_count / queryResult.page_size)
                    const newPage = Math.min(maxPages, parseInt(queryForm.page) + 1)
                    setQueryForm(prev => ({ ...prev, page: newPage.toString() }))
                  }}
                  disabled={isLoading || parseInt(queryForm.page) >= Math.ceil(queryResult.total_count / queryResult.page_size)}
                  className={styles.btnSecondary}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {queryResult && (
            <div style={{ marginTop: '15px' }}>
              <div style={{ fontSize: '14px', color: '#374151', marginBottom: '10px', fontWeight: 'bold' }}>
                Query Results: {queryResult.total_count} subscriptions found
                {queryResult.total_count > queryResult.page_size && (
                  <span style={{ fontWeight: 'normal', color: '#6b7280' }}>
                    {' '}(showing page {queryResult.page} of {Math.ceil(queryResult.total_count / queryResult.page_size)})
                  </span>
                )}
              </div>
              
              {queryResult.subscriptions.length > 0 ? (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {queryResult.subscriptions.map((subscription, index) => (
                    <div key={index} style={{ 
                      border: '1px solid #d1d5db', 
                      borderRadius: '6px', 
                      padding: '12px',
                      background: '#ffffff',
                      fontSize: '13px'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <div><strong>ID:</strong> {subscription.subscription_id}</div>
                        <div><strong>State:</strong> <span style={{ 
                          color: subscription.state === 'active' ? '#059669' : 
                                subscription.state === 'canceled' ? '#dc2626' : 
                                subscription.state === 'past_due' ? '#d97706' : '#6b7280'
                        }}>{subscription.state}</span></div>
                        <div><strong>Customer:</strong> {subscription.customer_id}</div>
                      </div>
                      
                      {subscription.next_billing_time && (
                        <div style={{ marginBottom: '4px' }}>
                          <strong>Next Billing:</strong> {subscription.next_billing_time}
                        </div>
                      )}
                      
                      {subscription.completed_billing_iteration !== undefined && (
                        <div style={{ marginBottom: '4px' }}>
                          <strong>Billing Cycles:</strong> {subscription.completed_billing_iteration}
                          {subscription.total_billing_cycles && ` / ${subscription.total_billing_cycles}`}
                        </div>
                      )}
                      
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        <strong>Products:</strong> {subscription.products?.length || 0} items | <strong>Token:</strong> {subscription.token_id}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px', fontStyle: 'italic' }}>
                  No subscriptions found matching your search criteria
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Customer Info */}
      {customer && (
        <div className={styles.intentSection}>
          <h4>Customer Record</h4>
          <div className={styles.intentDetails}>
            <div><strong>Customer ID:</strong> {customer.customer_id}</div>
            <div><strong>Name:</strong> {customer.name}</div>
            <div><strong>Email:</strong> {customer.email}</div>
            <div><strong>Created:</strong> {customer.created_at}</div>
          </div>
        </div>
      )}          
      
      <div className={styles.intentSection}>
        <h4>Payment Intent</h4>
        <div className={styles.intentDetails}>
          <div><strong>Payment Intent ID:</strong> {paymentIntentId}</div>
          <div><strong>Amount:</strong> {(config.amount / 100).toFixed(2)} {config.currency}</div>
        </div>
      </div>

      {/* Token Details */}
      {token && (
        <div className={styles.intentSection}>
          <h4>Mock Token Details</h4>
          <div className={styles.intentDetails}>
            <div><strong>Token ID:</strong> {token.token_id}</div>
            <div><strong>Type:</strong> {token.type}</div>
            <div><strong>Brand:</strong> {token.brand}</div>
            <div><strong>Last 4:</strong> {token.last4}</div>
            <div><strong>Status:</strong> {token.status}</div>
          </div>
        </div>
      )}

      {/* Products Section */}
      {products.length > 0 && (
        <div className={styles.configSection}>
          <h4>🛍️ Created Products ({products.length})</h4>
          <div style={{ display: 'grid', gap: '15px' }}>
            {products.map((product, index) => (
              <div key={index} style={{ 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px', 
                padding: '15px',
                background: '#f8fafc'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <h5 style={{ margin: '0 0 5px 0', color: '#1f2937' }}>{product.name}</h5>
                    <div style={{ fontSize: '14px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Product ID: {product.product_id}</span>
                      <button 
                        onClick={() => {
                          if (product.product_id) {
                            copyToClipboard(product.product_id, 'Product ID')
                            setSubscriptionForm(prev => ({ ...prev, product_id: product.product_id || '' }))
                          }
                        }}
                        style={{
                          background: 'none',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          color: '#6b7280'
                        }}
                        title="Copy Product ID and auto-fill subscription form"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => product.product_id && createSubscription(product.product_id)}
                    disabled={!customer || !token || isLoading}
                    className={styles.btnSecondary}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    Create Subscription
                  </button>
                </div>
                <div style={{ fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', color: '#4b5563' }}>
                  <div>Amount: {product.txamt/100} {product.txcurrcd}</div>
                  <div>Type: {product.type}</div>
                  <div>Interval: {product.interval || 'N/A'}</div>
                  <div>Count: {product.interval_count || 'N/A'}</div>
                </div>
                {product.description && (
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', fontStyle: 'italic' }}>
                    {product.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscriptions Section */}
      {subscriptions.length > 0 && (
        <div className={styles.configSection}>
          <h4>🔄 Active Subscriptions ({subscriptions.length})</h4>
          <div style={{ display: 'grid', gap: '15px' }}>
            {subscriptions.map((subscription, index) => (
              <div key={index} style={{ 
                border: '1px solid #d1fae5', 
                borderRadius: '8px', 
                padding: '15px',
                background: '#f0fdf4'
              }}>
                <h5 style={{ margin: '0 0 10px 0', color: '#065f46' }}>
                  Subscription {subscription.subscription_id}
                </h5>
                <div style={{ fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', color: '#047857' }}>
                  <div>State: {subscription.state}</div>
                  <div>Products: {subscription.products.length}</div>
                  <div>Customer: {subscription.customer_id}</div>
                  <div>Created: {subscription.created_at}</div>
                </div>
                <div style={{ marginTop: '10px', fontSize: '12px' }}>
                  <strong>Products:</strong>
                  {subscription.products.map((item, idx) => (
                    <div key={idx} style={{ marginLeft: '10px', color: '#047857' }}>
                      • {item.product_id} (qty: {item.quantity})
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      <div className={styles.section}>
        <h4>Execution Log</h4>
        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '10px' }}>
          {logs.map((log) => (
            <div 
              key={log.id} 
              style={{ 
                marginBottom: '5px', 
                fontSize: '12px',
                color: log.type === 'error' ? '#dc2626' : log.type === 'success' ? '#10b981' : '#666'
              }}
            >
              <span style={{ color: '#999' }}>[{log.timestamp.split('T')[1].split('.')[0]}]</span> {log.message}
            </div>
          ))}
        </div>
        <button 
          onClick={() => setLogs([])}
          className={styles.btnSecondary}
          style={{ marginTop: '10px' }}
        >
          Clear Logs
        </button>
      </div>
    </div>
  )
}