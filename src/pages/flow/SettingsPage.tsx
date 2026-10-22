import { StepIndicator } from '@/components/printf/StepIndicator';
import { DocumentPreview } from '@/components/printf/DocumentPreview';
import { PrintSettings } from '@/components/printf/PrintSettings';
import { RouteSkeleton } from '@/components/printf/loading/Skeletons';
import { usePrintFlow } from '@/components/printf/flow/PrintFlowContext';
const SettingsPage = () => {
  const { file, pageCount, settings, updateSettings, createJob, isLoading, amount, removeFile, setStep } = usePrintFlow();
  if (!file) return <RouteSkeleton />;
  const backToUpload = () => { removeFile(); setStep('upload'); };
  return <div className="container mx-auto px-6 py-14"><StepIndicator currentStep="settings" /><div className="mx-auto grid w-full max-w-4xl gap-8 lg:grid-cols-[0.9fr_1.1fr]"><DocumentPreview file={file} pageCount={pageCount} onRemove={backToUpload} /><PrintSettings settings={settings} onSettingsChange={updateSettings} onBack={backToUpload} onNext={createJob} isLoading={isLoading} pageCount={pageCount} amount={amount} /></div></div>;
};
export default SettingsPage;
