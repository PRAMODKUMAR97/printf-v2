import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PrintJob, PrintSettings, OTP, UploadStep } from '@/types/printf';
import { toast } from 'sonner';
import { ProcessingStage } from '@/components/printf/FileProcessing';

const DEFAULT_SETTINGS: PrintSettings = {
  copies: 1,
  color: false,
  duplex: false,
  page_size: 'A4',
};

// Price per page in rupees
const PRICE_PER_PAGE_BW = 2;
const PRICE_PER_PAGE_COLOR = 10;

export function usePrintJob() {
  const [step, setStep] = useState<UploadStep>('printf');
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);
  const [job, setJob] = useState<PrintJob | null>(null);
  const [otp, setOtp] = useState<OTP | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedPrintfId, setSelectedPrintfId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [email, setEmail] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('verifying');

  const selectPrintf = useCallback((printfId: string) => {
    setSelectedPrintfId(printfId);
    setStep('upload');
  }, []);

  // Count pages from PDF
  const countPdfPages = async (pdfFile: File): Promise<number> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        // Simple regex to count PDF pages
        const matches = content.match(/\/Type[\s]*\/Page[^s]/g);
        const count = matches ? matches.length : 1;
        resolve(Math.max(1, count));
      };
      reader.onerror = () => resolve(1);
      reader.readAsText(pdfFile);
    });
  };

  const uploadFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setStep('processing');
    setIsLoading(true);
    setUploadProgress(0);
    setProcessingStage('verifying');

    try {
      // Stage 1: Verifying (0-30%)
      await new Promise(resolve => setTimeout(resolve, 800));
      setUploadProgress(15);
      
      // Count pages for PDFs
      let pages = 1;
      if (selectedFile.type === 'application/pdf') {
        pages = await countPdfPages(selectedFile);
      } else if (selectedFile.type.includes('image')) {
        pages = 1;
      } else {
        // Estimate for Word docs based on file size (~50KB per page)
        pages = Math.max(1, Math.ceil(selectedFile.size / 50000));
      }
      setPageCount(pages);
      setUploadProgress(30);

      // Stage 2: Processing (30-70%)
      setProcessingStage('processing');
      await new Promise(resolve => setTimeout(resolve, 600));
      setUploadProgress(50);
      
      // Upload to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `jobs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('print-files')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;
      setUploadProgress(70);

      // Stage 3: Completed (70-100%)
      await new Promise(resolve => setTimeout(resolve, 400));
      setUploadProgress(90);
      setProcessingStage('completed');
      await new Promise(resolve => setTimeout(resolve, 500));
      setUploadProgress(100);

      // Calculate initial amount based on pages
      const pricePerPage = settings.color ? PRICE_PER_PAGE_COLOR : PRICE_PER_PAGE_BW;
      setAmount(pages * pricePerPage);

      // Store file path for later
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

      // Move to settings after a brief pause
      await new Promise(resolve => setTimeout(resolve, 800));
      setStep('settings');
      toast.success(`${pages} page${pages > 1 ? 's' : ''} detected`);
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
      // Create print job via secure edge function (bypasses RLS)
      const response = await supabase.functions.invoke('create-job', {
        body: {
          file_path: job.file_path,
          file_name: file.name,
          file_size: file.size,
          printf_id: selectedPrintfId,
          settings_json: {
            ...settings,
            page_count: pageCount,
          },
        },
      });

      if (response.error) throw response.error;
      
      const { job: jobData } = response.data;
      if (!jobData) throw new Error('No job data returned');

      // Calculate final amount
      const pricePerPage = settings.color ? PRICE_PER_PAGE_COLOR : PRICE_PER_PAGE_BW;
      const calculatedAmount = pageCount * pricePerPage;
      setAmount(calculatedAmount);

      // Map to our types
      const mappedJob: PrintJob = {
        ...jobData,
        printf_id: selectedPrintfId,
        settings_json: jobData.settings_json as unknown as PrintSettings,
        status: jobData.status as PrintJob['status'],
      };

      setJob(mappedJob);
      setStep('phone');
      toast.success('Ready for payment!');
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error('Failed to create print job');
    } finally {
      setIsLoading(false);
    }
  }, [file, job, settings, selectedPrintfId, pageCount]);

  const proceedToPayment = useCallback(() => {
    setStep('payment');
  }, []);

  const handlePaymentSuccess = useCallback(async (otpCode?: string) => {
    if (!job) return;

    try {
      // OTP is already generated on the backend after payment verification
      // If OTP code is passed from the payment response, use it
      if (otpCode) {
        // Fetch the OTP from database to get full record
        const { data: otpData, error: otpError } = await supabase
          .from('otps')
          .select()
          .eq('job_id', job.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (otpError) {
          // If we can't fetch, create a mock OTP object with the code from server
          setOtp({
            id: '',
            job_id: job.id,
            otp_code: otpCode,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            used: false,
          });
        } else {
          setOtp(otpData as OTP);
        }
      } else {
        // Fallback: fetch latest OTP for this job
        const { data: otpData, error: otpError } = await supabase
          .from('otps')
          .select()
          .eq('job_id', job.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (otpError) throw otpError;
        setOtp(otpData as OTP);
      }
      
      setStep('otp');
    } catch (error) {
      console.error('Error fetching OTP:', error);
      toast.error('Failed to retrieve OTP');
    }
  }, [job]);

  const updateSettings = useCallback((newSettings: Partial<PrintSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      // Recalculate amount when color changes
      const pricePerPage = updated.color ? PRICE_PER_PAGE_COLOR : PRICE_PER_PAGE_BW;
      setAmount(pageCount * pricePerPage);
      return updated;
    });
  }, [pageCount]);

  const reset = useCallback(() => {
    setStep('printf');
    setFile(null);
    setSettings(DEFAULT_SETTINGS);
    setJob(null);
    setOtp(null);
    setUploadProgress(0);
    setSelectedPrintfId(null);
    setAmount(0);
    setEmail('');
    setPageCount(1);
    setProcessingStage('verifying');
  }, []);

  return {
    step,
    setStep,
    file,
    settings,
    job,
    otp,
    amount,
    isLoading,
    uploadProgress,
    selectedPrintfId,
    email,
    setEmail,
    pageCount,
    processingStage,
    selectPrintf,
    uploadFile,
    removeFile,
    createJob,
    proceedToPayment,
    updateSettings,
    handlePaymentSuccess,
    reset,
  };
}
