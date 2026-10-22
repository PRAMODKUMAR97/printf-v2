import { useState, useCallback } from 'react';
import { Upload, FileText, Image, FileType, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE = 50 * 1024 * 1024;

export function FileUpload({ onFileSelect, selectedFile }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = useCallback((file: File): boolean => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Please upload PDF, Word, PNG, or JPEG files.');
      return false;
    }
    if (file.size > MAX_SIZE) {
      toast.error('File too large. Maximum size is 50MB.');
      return false;
    }
    return true;
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && validateFile(file)) onFileSelect(file);
  }, [onFileSelect, validateFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) onFileSelect(file);
  }, [onFileSelect, validateFile]);

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-6 w-6" />;
    if (type.includes('image')) return <Image className="h-6 w-6" />;
    return <FileType className="h-6 w-6" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (selectedFile) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <div className="panel-raised p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-surface-sunken text-foreground">
              {getFileIcon(selectedFile.type)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{selectedFile.name}</p>
              <p className="mt-1 text-sm text-muted-foreground tabular-nums">{formatSize(selectedFile.size)}</p>
            </div>
            <Button variant="ghost" size="icon" className="flex-shrink-0 rounded-full text-muted-foreground hover:text-destructive"
              onClick={() => onFileSelect(null as unknown as File)} aria-label="Remove selected file">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <label
        className={cn(
          'group relative flex h-72 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-hairline bg-card text-center shadow-elev-1 transition-all duration-500 ease-out-soft',
          'hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-elev-2',
          isDragging && 'drop-zone-active'
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="dot-field pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_65%_60%_at_50%_50%,black,transparent)]" />
        <div className="doc3d-scene relative z-10 flex flex-col items-center px-6">
          <div className="relative mb-8 h-20 w-16">
            <div className="doc3d-lift h-full w-full">
              <div className="doc3d relative h-full w-full">
                <span className="doc3d-sheet doc3d-sheet-back absolute left-1/2 top-2 h-14 w-11 rounded-md border border-border bg-card shadow-elev-1" />
                <span className="doc3d-sheet doc3d-sheet-mid absolute left-1/2 top-1 h-14 w-11 rounded-md border border-border bg-card shadow-elev-1" />
                <span className="doc3d-sheet doc3d-sheet-front absolute left-1/2 top-0 flex h-14 w-11 items-center justify-center overflow-hidden rounded-md border border-border bg-card shadow-elev-2">
                  <span className="absolute inset-x-2.5 top-3 h-px bg-border" />
                  <span className="absolute inset-x-2.5 top-5 h-px bg-border" />
                  <Upload className="doc3d-arrow relative mt-1 h-4 w-4 text-accent" />
                </span>
              </div>
            </div>
            <div aria-hidden="true" className="doc3d-shadow-wrap pointer-events-none absolute -bottom-1 left-1/2 w-12 -translate-x-1/2">
              <span className="doc3d-shadow block h-2 w-full rounded-[50%] bg-foreground/15 blur-[6px]" />
            </div>
          </div>
          <p className="font-display text-2xl leading-none text-foreground">Drop your document</p>
          <p className="mt-2.5 text-sm text-muted-foreground">or <span className="text-foreground underline decoration-hairline underline-offset-4">browse your files</span></p>
          <p className="mt-6 text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground/80">PDF · Word · PNG · JPEG — up to 50 MB</p>
        </div>
        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleChange} />
      </label>
    </div>
  );
}
