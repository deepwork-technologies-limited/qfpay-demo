'use client'

import { useEffect, useRef, useState } from 'react'
import { createCustomer, createPaymentIntent } from './actions'
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
      
      // Auto-copy customer ID to configuration
      setConfig(prev => ({ ...prev, customerId: customerRecord.customer_id }))
      addLog('Auto-copied customer ID to configuration field', 'info')
      
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
      console.log(qfpay.retrievePaymentIntent().then(r => {
        console.log('Current Payment Intent:', r)
      }))
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
  
  // Combined setup function that handles both intent types
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

  // Copy card number to clipboard
  const copyCardNumber = async (cardNumber: string) => {
    try {
      await navigator.clipboard.writeText(cardNumber.replace(/\s/g, ''))
      addLog(`Card number copied: ${cardNumber}`, 'success')
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = cardNumber.replace(/\s/g, '')
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      addLog(`Card number copied: ${cardNumber}`, 'success')
    }
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
            Intent Type:
            <select 
              value={config.intentType}
              onChange={(e) => setConfig(prev => ({ ...prev, intentType: e.target.value as 'payment' }))}
              disabled={isLoading}
            >
              {/* <option value="token">Token Intent (Card Tokenization)</option> */}
              <option value="payment">Payment Intent (Direct Payment)</option>
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
        <h4>Minimal Example Steps</h4>
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