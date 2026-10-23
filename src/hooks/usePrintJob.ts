import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { OTP, PrintJob, PrintSettings, UploadStep } from '@/types/printf';
import { toast } from 'sonner';
import { ProcessingStage } from '@/components/printf/FileProcessing';
import type { PaymentCompletion } from '@/hooks/usePayment';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const DEFAULT_SETTINGS: PrintSettings = {
  copies: 1,
  color: false,
  duplex: false,
  page_size: 'A4',
  borderless: false,
  layout: 1,
  page_range: '',
  fit_to_page: true,
};

const PRICE_PER_PAGE_BW = 2;
const PRICE_PER_PAGE_COLOR = 10;

export function countSelectedPages(range: string, total: number): number {
  const trimmed = (range || '').trim();
  if (!trimmed) return total;
  const selected = new Set<number>();
  for (const part of trimmed.split(',')) {
    const chunk = part.trim();
    if (!chunk) continue;
    const match = chunk.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!match) continue;
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : start;
    for (let page = Math.min(start, end); page <= Math.max(start, end); page++) {
      if (page >= 1 && page <= total) selected.add(page);
    }
  }
  return selected.size || total;
}

export function countSheets(selectedPages: number, layout: number): number {
  const perSheet = Math.max(1, layout || 1);
  return Math.max(1, Math.ceil(Math.max(1, selectedPages) / perSheet));
}

export const computeAmount = (settings: PrintSettings, pages: number) => {
  const pricePerSheet = settings.color ? PRICE_PER_PAGE_COLOR : PRICE_PER_PAGE_BW;
  const selected = countSelectedPages(settings.page_range, pages);
  const sheets = countSheets(selected, settings.layout);
  return sheets * Math.max(1, settings.copies) * pricePerSheet;
};

export function usePrintJob() {
  const [step, setStep] = useState<UploadStep>('printf');
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);
  const [job, setJob] = useState<PrintJob | null>(null);
  const [otp, setOtp] = useState<OTP | null>(null);
  const [email, setEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [orderConfirmation, setOrderConfirmation] = useState<PaymentCompletion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedPrintfId, setSelectedPrintfId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('verifying');

  const selectPrintf = useCallback((printfId: string) => {
    setSelectedPrintfId(printfId);
    setStep('upload');
  }, []);

  const countPdfPages = async (pdfFile: File): Promise<number> => {
    try {
      const buffer = await pdfFile.arrayBuffer();
      const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
      const pages = pdf.numPages;
      await pdf.destroy();
      return Math.max(1, pages);
    } catch (error) {
      console.error('Failed to read PDF page count:', error);
      return 1;
    }
  };

  const uploadFile = useCallback(async (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null);
      setJob(null);
      setPageCount(1);
      setUploadProgress(0);
      setProcessingStage('verifying');
      return;
    }

    setFile(selectedFile);
    setStep('processing');
    setIsLoading(true);
    setUploadProgress(0);
    setProcessingStage('verifying');

    try {
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || '';
      const allowed = new Set(['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg']);
      if (!allowed.has(fileExt)) throw new Error('Unsupported file type. Upload PDF, Word, PNG or JPEG.');
      if (selectedFile.size < 1 || selectedFile.size > 50 * 1024 * 1024) throw new Error('File must be 50 MB or smaller.');

      setUploadProgress(10);
      let pages = 1;
      if (selectedFile.type === 'application/pdf' || fileExt === 'pdf') {
        pages = await countPdfPages(selectedFile);
      } else if (selectedFile.type.includes('image') || ['png', 'jpg', 'jpeg'].includes(fileExt)) {
        pages = 1;
      } else {
        // DOC/DOCX pages are determined from file size until document conversion metadata is available.
        pages = Math.max(1, Math.ceil(selectedFile.size / 50000));
      }
      setPageCount(pages);
      setUploadProgress(30);
      setProcessingStage('processing');

      // The storage policy accepts only jobs/<uuid>.<extension>, matching this path.
      const filePath = 'jobs/' + crypto.randomUUID() + '.' + fileExt;
      const { error: uploadError } = await supabase.storage.from('print-files').upload(filePath, selectedFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: selectedFile.type || undefined,
      });
      if (uploadError) throw uploadError;

      setUploadProgress(70);
      setProcessingStage('completed');
      setUploadProgress(100);
      setAmount(computeAmount(settings, pages));
      setJob({
        id: '',
        printf_id: selectedPrintfId,
        file_path: filePath,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        settings_json: { ...settings, page_count: pages },
        status: 'pending',
        locked: false,
        expiry_time: '',
        created_at: '',
        updated_at: '',
      });
      setStep('settings');
      toast.success(pages + ' page' + (pages > 1 ? 's' : '') + ' detected');
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process file');
      setFile(null);
      setJob(null);
      setStep('upload');
    } finally {
      setIsLoading(false);
    }
  }, [settings, selectedPrintfId]);

  const removeFile = useCallback(() => {
    setFile(null);
    setJob(null);
    setPageCount(1);
    setUploadProgress(0);
    setProcessingStage('verifying');
  }, []);

  const createJob = useCallback(async () => {
    if (!file || !job?.file_path) {
      toast.error('No file selected');
      return;
    }
    setIsLoading(true);
    try {
      const selectedPages = countSelectedPages(settings.page_range, pageCount);
      const sheets = countSheets(selectedPages, settings.layout);
      const { data, error } = await supabase.functions.invoke('create-job', {
        body: {
          file_path: job.file_path,
          file_name: file.name,
          file_size: file.size,
          printf_id: selectedPrintfId,
          settings_json: {
            ...settings,
            page_size: 'A4',
            fit_to_page: true,
            page_count: pageCount,
            selected_pages: selectedPages,
            sheets,
          },
        },
      });
      if (error) throw error;
      const jobData = data?.job;
      if (!jobData) throw new Error(data?.error || 'No print job data returned');
      const mappedJob: PrintJob = {
        ...jobData,
        printf_id: selectedPrintfId,
        settings_json: jobData.settings_json as PrintSettings,
        status: jobData.status as PrintJob['status'],
      };
      setJob(mappedJob);
      setAmount(computeAmount(settings, pageCount));
      setStep('payment');
      toast.success('Ready for checkout!');
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create print job');
    } finally {
      setIsLoading(false);
    }
  }, [file, job, settings, selectedPrintfId, pageCount]);

  const handlePaymentSuccess = useCallback((details: PaymentCompletion) => {
    if (!job) return;
    setEmail(details.customer_email);
    setCustomerName(details.customer_name);
    setCustomerMobile(details.customer_mobile);
    setOrderConfirmation(details);
    setOtp({
      id: '',
      job_id: job.id,
      otp_code: '',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + Math.max(60, details.expires_in_seconds || 300) * 1000).toISOString(),
      used: false,
    });
    setStep('otp');
  }, [job]);

  const updateSettings = useCallback((newSettings: Partial<PrintSettings>) => {
    setSettings((prev) => {
      const updated: PrintSettings = { ...prev, ...newSettings, page_size: 'A4', fit_to_page: true };
      setAmount(computeAmount(updated, pageCount));
      return updated;
    });
  }, [pageCount]);

  const reset = useCallback(() => {
    [
      'printf_last_payment_method',
      'printf_order_number',
      'printf_print_order_id',
      'printf_razorpay_order_id',
      'printf_payment_job_id',
      'printf_customer_email',
      'printf_email',
      'printf_order_id',
    ].forEach((key) => localStorage.removeItem(key));
    setStep('printf');
    setFile(null);
    setSettings(DEFAULT_SETTINGS);
    setJob(null);
    setOtp(null);
    setEmail('');
    setCustomerName('');
    setCustomerMobile('');
    setOrderConfirmation(null);
    setUploadProgress(0);
    setSelectedPrintfId(null);
    setAmount(0);
    setPageCount(1);
    setProcessingStage('verifying');
  }, []);

  const proceedToPayment = useCallback(() => setStep('payment'), []);

  return {
    step, setStep, file, settings, job, otp, amount, isLoading, uploadProgress,
    selectedPrintfId, pageCount, processingStage, email, setEmail, customerName,
    setCustomerName, customerMobile, setCustomerMobile, orderConfirmation,
    selectPrintf, uploadFile, removeFile, createJob, proceedToPayment,
    updateSettings, handlePaymentSuccess, reset,
  };
}
