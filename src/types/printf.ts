export interface Printf {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'maintenance';
  last_seen: string | null;
  accepts_orders_24_7?: boolean;
  manual_fulfilment?: boolean;
  api_key?: string;
  paper_level: number;
  ink_level: number;
  created_at: string;
  updated_at: string;
}

/** Pages placed on one physical sheet. */
export type PrintLayout = 1 | 2 | 4;

export interface PrintSettings {
  copies: number;
  color: boolean;
  duplex: boolean;
  /** Always A4 — documents are auto-fitted to A4, not user selectable. */
  page_size: 'A4';
  /** Print edge-to-edge with no white margin (printer permitting). */
  borderless: boolean;
  /** 1 = one page per sheet, 2 = 2-in-1, 4 = 4-in-1. */
  layout: PrintLayout;
  /** Empty string = all pages. Otherwise e.g. "1-3,5". */
  page_range: string;
  page_count?: number;
  /** Pages actually selected by page_range (used for billing). */
  selected_pages?: number;
  /** Physical sheets per copy after the N-up layout is applied (billing unit). */
  sheets?: number;
  fit_to_page?: boolean;
}

export interface PrintJob {
  id: string;
  printf_id: string | null;
  file_path?: string;
  file_name: string;
  file_size: number;
  settings_json: PrintSettings;
  status: 'pending' | 'ready' | 'printing' | 'completed' | 'failed' | 'expired';
  locked: boolean;
  expiry_time: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  job_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  gateway_ref: string | null;
  created_at: string;
}

export interface Log {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  printf_id: string | null;
  job_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface OTP {
  id: string;
  job_id: string;
  otp_code: string;
  created_at: string;
  expires_at: string;
  used: boolean;
}

export type UploadStep = 'printf' | 'upload' | 'processing' | 'settings' | 'phone' | 'payment' | 'otp' | 'status';
