// Minimal ambient types for the untyped CJS `midtrans-client` (v1.4.x).
// Only the surface we use is declared.
declare module 'midtrans-client' {
  interface ClientOptions {
    isProduction: boolean;
    serverKey: string;
    clientKey?: string;
  }

  interface SnapTransactionResult {
    token: string;
    redirect_url: string;
  }

  // Loosely typed — Midtrans accepts a large, optional param object.
  type SnapTransactionParams = Record<string, unknown>;

  // Webhook / status payload (only fields we read are listed; rest passthrough).
  interface TransactionStatus {
    order_id: string;
    transaction_status: string;
    status_code: string;
    gross_amount: string;
    signature_key?: string;
    payment_type?: string;
    fraud_status?: string;
    va_numbers?: Array<{ bank: string; va_number: string }>;
    permata_va_number?: string;
    settlement_time?: string;
    [key: string]: unknown;
  }

  class Snap {
    constructor(options: ClientOptions);
    createTransaction(params: SnapTransactionParams): Promise<SnapTransactionResult>;
  }

  class CoreApi {
    constructor(options: ClientOptions);
    transaction: {
      status(orderId: string): Promise<TransactionStatus>;
      notification(payload: unknown): Promise<TransactionStatus>;
    };
  }

  class MidtransError extends Error {
    httpStatusCode?: number;
    ApiResponse?: unknown;
    rawHttpClientData?: unknown;
  }
}
