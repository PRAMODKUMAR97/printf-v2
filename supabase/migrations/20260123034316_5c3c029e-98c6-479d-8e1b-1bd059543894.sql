-- PrintF Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PrintFs (Kiosks) table
CREATE TABLE public.printfs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
  last_seen TIMESTAMP WITH TIME ZONE,
  api_key TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  paper_level INTEGER DEFAULT 100,
  ink_level INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Print Jobs table
CREATE TABLE public.print_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  printf_id UUID REFERENCES public.printfs(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  settings_json JSONB NOT NULL DEFAULT '{"copies": 1, "color": false, "duplex": false, "page_size": "A4"}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'printing', 'completed', 'failed', 'expired')),
  locked BOOLEAN NOT NULL DEFAULT false,
  expiry_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- OTPs table
CREATE TABLE public.otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
  otp_code TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  gateway_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Logs table
CREATE TABLE public.logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'error', 'success')),
  message TEXT NOT NULL,
  printf_id UUID REFERENCES public.printfs(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.print_jobs(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_print_jobs_printf_id ON public.print_jobs(printf_id);
CREATE INDEX idx_print_jobs_status ON public.print_jobs(status);
CREATE INDEX idx_otps_job_id ON public.otps(job_id);
CREATE INDEX idx_otps_otp_code ON public.otps(otp_code);
CREATE INDEX idx_payments_job_id ON public.payments(job_id);
CREATE INDEX idx_logs_printf_id ON public.logs(printf_id);
CREATE INDEX idx_logs_created_at ON public.logs(created_at);

-- Enable RLS on all tables
ALTER TABLE public.printfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for print_jobs (public access for anonymous users)
CREATE POLICY "Anyone can create print jobs" ON public.print_jobs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view their own jobs by id" ON public.print_jobs
  FOR SELECT USING (true);

CREATE POLICY "Jobs can be updated" ON public.print_jobs
  FOR UPDATE USING (true);

-- RLS Policies for otps
CREATE POLICY "OTPs can be created" ON public.otps
  FOR INSERT WITH CHECK (true);

CREATE POLICY "OTPs can be viewed" ON public.otps
  FOR SELECT USING (true);

CREATE POLICY "OTPs can be updated" ON public.otps
  FOR UPDATE USING (true);

-- RLS Policies for payments
CREATE POLICY "Payments can be created" ON public.payments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Payments can be viewed" ON public.payments
  FOR SELECT USING (true);

CREATE POLICY "Payments can be updated" ON public.payments
  FOR UPDATE USING (true);

-- RLS Policies for printfs (read-only for public)
CREATE POLICY "Printfs can be viewed" ON public.printfs
  FOR SELECT USING (true);

-- RLS Policies for logs
CREATE POLICY "Logs can be created" ON public.logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Logs can be viewed" ON public.logs
  FOR SELECT USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_printfs_updated_at
  BEFORE UPDATE ON public.printfs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_print_jobs_updated_at
  BEFORE UPDATE ON public.print_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for print files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'print-files',
  'print-files',
  false,
  52428800,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- Storage policies
CREATE POLICY "Anyone can upload print files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'print-files');

CREATE POLICY "Anyone can view print files" ON storage.objects
  FOR SELECT USING (bucket_id = 'print-files');

CREATE POLICY "Anyone can delete print files" ON storage.objects
  FOR DELETE USING (bucket_id = 'print-files');