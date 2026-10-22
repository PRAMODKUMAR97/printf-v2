import { StepIndicator } from '@/components/printf/StepIndicator';
import { FileProcessing } from '@/components/printf/FileProcessing';
import { RouteSkeleton } from '@/components/printf/loading/Skeletons';
import { usePrintFlow } from '@/components/printf/flow/PrintFlowContext';
const ProcessingPage = () => {
  const { file, processingStage, uploadProgress, pageCount } = usePrintFlow();
  if (!file) return <RouteSkeleton />;
  return <div className="container mx-auto px-6 py-14"><StepIndicator currentStep="upload" /><FileProcessing stage={processingStage} progress={uploadProgress} fileName={file.name} pageCount={processingStage === 'completed' ? pageCount : undefined} /></div>;
};
export default ProcessingPage;
