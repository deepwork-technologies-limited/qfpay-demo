export declare function generateQFPaySignature(
  params: Record<string, unknown>,
  endpoint: string,
  method?: string,
  clientKey?: string
): Promise<{
  success: boolean
  signature?: string
  timestamp?: string
  headers?: Record<string, string>
  error?: string
}>

export declare function createCustomer(
  customerData: Record<string, unknown>,
  appcode: string,
  secretKey?: string
): Promise<{
  success: boolean
  customer?: {
    customer_id: string
    [key: string]: unknown
  }
  error?: string
}>

export declare function createPaymentIntent(
  amount: number,
  currency?: string,
  appcode?: string,
  secretKey?: string,
  customerId?: string | null,
  tokenExpiry?: string | null
): Promise<{
  success: boolean
  paymentIntent?: {
    payment_intent_id: string
    amount: number
    currency: string
    expires_at?: string
    [key: string]: unknown
  }
  error?: string
}>