'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'

export default function SDKLoader() {
  const [environment, setEnvironment] = useState('qa')

  useEffect(() => {
    // Get saved environment from localStorage (default to 'qa')
    try {
      const saved = localStorage.getItem('qfpay-demo-config')
      if (saved) {
        const config = JSON.parse(saved)
        setEnvironment(config.environment || 'qa')
      }
    } catch {
      // Use default 'qa' if parsing fails
      setEnvironment('qa')
    }
  }, [])

  // Set SDK URL based on environment (using correct QFPay SDK URLs)
  const sdkUrls = {
    qa: 'https://cdn-int.qfapi.com/qfpay_element/qfpay.js', // Sandbox
    test: 'https://test-cdn-hk.qfapi.com/qfpay_element/qfpay.js', // Live Test
    live: 'https://cdn-hk.qfapi.com/qfpay_element/qfpay.js' // Production
  }

  return (
    <Script 
      src={sdkUrls[environment as keyof typeof sdkUrls] || sdkUrls.qa}
      strategy="afterInteractive"
      onLoad={() => {
        console.log('QFPay SDK loaded successfully for environment:', environment)
        console.log('window.QFpay:', window.QFpay)
        if (window.QFpay) {
          console.log('QFpay methods:', Object.keys(window.QFpay))
        }
      }}
      onError={(e) => {
        console.error('Failed to load QFPay SDK:', e)
      }}
    />
  )
}