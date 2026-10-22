import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PrintJob, PrintSettings, UploadStep } from '@/types/printf';
import { toast } from 'sonner';
import { ProcessingStage } from '@/components/printf/FileProcessing';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = \`//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js\`;

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

/** Count how many pages a range string like "1-3,5" selects. Empty = all. */
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
    for (let p = Math.min(start, end); p <= Math.max(start, end); p++) {
      if (p >= 1 && p <= total) selected.add(p);
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
      pdf.destroy();
      return Math.max(1, pages);
    } catch (error) {
      console.error('Failed to read PDF page count:', error);
      return 1;
    }
  };

  const uploadFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setStep('processing');
    setIsLoading(true);
    setUploadProgress(0);
    setProcessingStage('verifying');

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      setUploadProgress(15);

      let pages = 1;
      if (selectedFile.type === 'application/pdf') {
        pages = await countPdfPages(selectedFile);
      } else if (selectedFile.type.includes('image')) {
        pages = 1;
      } else {
        pages = Math.max(1, Math.ceil(selectedFile.size / 50000));
      }
      setPageCount(pages);
      setUploadProgress(30);

      setProcessingStage('processing');
      await new Promise(resolve => setTimeout(resolve, 600));
      setUploadProgress(50);

      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || 'pdf';
      const fileName = \`\${crypto.randomUUID()}.\${fileExt}\`;
      const filePath = \`jobs/\${fileName}\`;

      const { error: uploadError } = await supabase.storage
        .from('print-files')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;
      setUploadProgress(70);

      await new Promise(resolve => setTimeout(resolve, 400));
      setUploadProgress(90);
      setProcessingStage('completed');
      await new Promise(resolve => setTimeout(resolve, 500));
      setUploadProgress(100);

      setAmount(computeAmount(settings, pages));

      setJob({
        id: '',
        printf_id: selectedPrintfId,
        file_path: filePath,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        settings_json: settings,
        status: 'pending',
        locked: false,
        expiry_time: '',
        created_at: '',
        updated_at: '',
      });

      await new Promise(resolve => setTimeout(resolve, 800));
      setStep('settings');
      toast.success(\`\${pages} page\${pages > 1 ? 's' : ''} detected\`);
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Failed to process file');
      setStep('upload');
    } finally {
      setIsLoading(false);
    }
  }, [settings, selectedPrintfId]);

  const removeFile = useCallback(() => {
    setFile(null);
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
      const response = await supabase.functions.invoke('create-job', {
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

      if (response.error) throw response.error;
      const { job: jobData } = response.data;
      if (!jobData) throw new Error('No job data returned');

      setAmount(computeAmount(settings, pageCount));
      const mappedJob: PrintJob = {
        ...jobData,
        printf_id: selectedPrintfId,
        settings_json: jobData.settings_json as unknown as PrintSettings,
        status: jobData.status as PrintJob['status'],
      };

      setJob(mappedJob);
      setStep('payment');
      toast.success('Ready for payment!');
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error('Failed to create print job');
    } finally {
      setIsLoading(false);
    }
  }, [file, job, settings, selectedPrintfId, pageCount]);

  const handlePaymentSuccess = useCallback(async () => {
    if (!job) return;
    setStep('status');
  }, [job]);

  const updateSettings = useCallback((newSettings: Partial<PrintSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings, page_size: 'A4' as const, fit_to_page: true };
      setAmount(computeAmount(updated, pageCount));
      return updated;
    });
  }, [pageCount]);

  const reset = useCallback(() => {
    localStorage.removeItem('printf_last_payment_method');
    localStorage.removeItem('printf_order_number');
    localStorage.removeItem('printf_print_order_id');
    localStorage.removeItem('printf_razorpay_order_id');
    localStorage.removeItem('printf_payment_job_id');
    localStorage.removeItem('printf_order_id');
    setStep('printf');
    setFile(null);
    setSettings(DEFAULT_SETTINGS);
    setJob(null);
    setUploadProgress(0);
    setSelectedPrintfId(null);
    setAmount(0);
    setPageCount(1);
    setProcessingStage('verifying');
  }, []);

  return {
    step,
    setStep,
    file,
    settings,
    job,
    amount,
    isLoading,
    uploadProgress,
    selectedPrintfId,
    pageCount,
    processingStage,
    selectPrintf,
    uploadFile,
    removeFile,
    createJob,
    proceedToPayment: useCallback(() => setStep('payment'), []),
    updateSettings,
    handlePaymentSuccess,
    reset,
  };
}
