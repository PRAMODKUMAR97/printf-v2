import { Header } from '@/components/printf/Header';
import { FileUpload } from '@/components/printf/FileUpload';
import { DocumentPreview } from '@/components/printf/DocumentPreview';
import { PrintSettings } from '@/components/printf/PrintSettings';
import { PaymentScreen } from '@/components/printf/PaymentScreen';
import { OTPVerification } from '@/components/printf/OTPVerification';
import { StepIndicator } from '@/components/printf/StepIndicator';
import { PrintfFinder } from '@/components/printf/PrintfFinder';
import { FileProcessing } from '@/components/printf/FileProcessing';
import { EmailInput } from '@/components/printf/EmailInput';
import { QRScanner } from '@/components/printf/QRScanner';
import { usePrintJob } from '@/hooks/usePrintJob';
import { Printf } from '@/types/printf';
import { supabase } from '@/integrations/supabase/client';
import { Printer, Zap, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useRef } from 'react';

const Index = () => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<Printf | null>(null);
  const {
    step,
    setStep,
    file,
    settings,
    job,
    otp,
    amount,
    isLoading,
    uploadProgress,
    pageCount,
    processingStage,
    email,
    setEmail,
    customerName,
    setCustomerName,
    customerMobile,
    setCustomerMobile,
    orderConfirmation,
    selectPrintf,
    uploadFile,
    removeFile,
    createJob,
    proceedToPayment,
    updateSettings,
    handlePaymentSuccess,
    reset,
  } = usePrintJob();

  const handlePrintfSelect = (printf: Printf) => {
    setSelectedPrinter(printf);
    selectPrintf(printf.id);
    toast.success(`Selected ${printf.name}`);
  };

  const handleScanQR = () => {
    setShowQRScanner(true);
  };

  const handleQRScan = async (printfId: string) => {
    setShowQRScanner(false);

    // Verify the PrintF exists and is online
    const { data: printf, error } = await supabase
      .from('printfs')
      .select('*')
      .eq('id', printfId)
      .single();

    if (error || !printf) {
      toast.error('PrintF not found. Please try again.');
      return;
    }

    if (printf.status !== 'online') {
      toast.error(`${printf.name} is currently ${printf.status}. Please try another PrintF.`);
      return;
    }

    setSelectedPrinter(printf as Printf);
    selectPrintf(printfId);
    toast.success(`Connected to ${printf.name}`);
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 pt-28 pb-12">
          {/* PrintF Selection Step */}
          {step === 'printf' && (
            <PrintfFinder onPrintfSelect={handlePrintfSelect} onScanQR={handleScanQR} />
          )}

          {/* Upload Step - Show Hero only when no file */}
          {step === 'upload' && (
            <>
              <div className="max-w-2xl mx-auto text-center mb-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary text-sm font-medium mb-6">
                  <Zap className="w-4 h-4" />
                  Fast & Easy Printing
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 font-display">
                  Print Documents
                  <span className="printf-gradient-text"> Instantly</span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-md mx-auto">
                  Upload your file, customize settings, and get an OTP to print at any PrintF printer. No login required.
                </p>
              </div>

              <StepIndicator currentStep={step} />
              <FileUpload onFileSelect={uploadFile} selectedFile={null} />

              {/* Features */}
              <div className="max-w-3xl mx-auto mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card border border-border rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Printer className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Multiple Formats</h3>
                  <p className="text-sm text-muted-foreground">
                    Support for PDF, Word, PNG, and JPEG files
                  </p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-6 h-6 text-secondary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Secure Printing</h3>
                  <p className="text-sm text-muted-foreground">
                    OTP verification ensures your documents stay private
                  </p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-6 h-6 text-success" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Quick Process</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload, configure, and print in under a minute
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Processing Step - File verification animation */}
          {step === 'processing' && file && (
            <>
              <StepIndicator currentStep="upload" />
              <FileProcessing
                stage={processingStage}
                progress={uploadProgress}
                fileName={file.name}
                pageCount={processingStage === 'completed' ? pageCount : undefined}
              />
            </>
          )}

          {/* Settings Step */}
          {step === 'settings' && file && (
            <>
              <StepIndicator currentStep={step} />
              <div className="w-full max-w-2xl mx-auto">
                <DocumentPreview
                  file={file}
                  pageCount={pageCount}
                  onRemove={() => {
                    removeFile();
                    setStep('upload');
                  }}
                />

                <div className="mt-6">
                  <PrintSettings
                    settings={settings}
                    onSettingsChange={updateSettings}
                    onBack={() => {
                      removeFile();
                      setStep('upload');
                    }}
                    onNext={createJob}
                    isLoading={isLoading}
                    pageCount={pageCount}
                    amount={amount}
                  />
                </div>
              </div>
            </>
          )}

          {/* Email Input Step */}
          {step === 'phone' && job && (
            <>
              <StepIndicator currentStep="settings" />
              <EmailInput
                email={email}
                onEmailChange={setEmail}
                customerName={customerName}
                onCustomerNameChange={setCustomerName}
                customerMobile={customerMobile}
                onCustomerMobileChange={setCustomerMobile}
                onBack={() => setStep('settings')}
                onNext={proceedToPayment}
                isLoading={isLoading}
              />
            </>
          )}

          {/* Payment Step */}
          {step === 'payment' && job && (
            <PaymentScreen
              job={job}
              amount={amount}
              email={email}
              customerName={customerName}
              phone={customerMobile}
              printerName={selectedPrinter?.name}
              printerLocation={selectedPrinter?.location}
              onBack={() => setStep('phone')}
              onSuccess={handlePaymentSuccess}
            />
          )}

          {/* OTP Verification Step */}
          {step === 'otp' && job && otp && (
            <OTPVerification
              otp={otp}
              job={job}
              email={email}
              paymentMethod={orderConfirmation?.payment_method}
              orderNumber={orderConfirmation?.order_number}
              onNewPrint={reset}
              onVerified={() => setIsPrinting(true)}
            />
          )}
        </main>

        {/* Footer - hide on printf step */}
        {step !== 'printf' && (
          <footer className="border-t border-border py-6">
            <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} PrintF. Self-service cloud printing.
            </div>
          </footer>
        )}
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </>
  );
};

export default Index;
