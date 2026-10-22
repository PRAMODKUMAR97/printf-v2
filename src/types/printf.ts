export interface Printf {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'maintenance';
  last_seen: string | null;
  api_key: string;
  paper_level: number;
  ink_level: number;
  created_at: string;
  updated_at: string;
}

export interface PrintSettings {
  copies: number;
  color: boolean;
  duplex: boolean;
  page_size: 'A4' | 'A3' | 'Letter' | 'Legal';
  page_count?: number;
}

export interface PrintJob {
  id: string;
  printf_id: string | null;
  file_path: string;
  file_name: string;
  file_size: number;
  settings_json: PrintSettings;
  status: 'pending' | 'ready' | 'printing' | 'completed' | 'failed' | 'expired';
  locked: boolean;
  expiry_time: string;
  created_at: string;
  updated_at: string;
}

export interface OTP {
  id: string;
  job_id: string;
  otp_code: string;
  used: boolean;
  expires_at: string;
  created_at: string;
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

export type UploadStep = 'printf' | 'upload' | 'processing' | 'settings' | 'phone' | 'payment' | 'otp' | 'complete';
