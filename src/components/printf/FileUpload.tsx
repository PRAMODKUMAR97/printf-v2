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

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      const file = e.dataTransfer.files[0];
      if (file && validateFile(file)) {
        onFileSelect(file);
      }
    },
    [onFileSelect, validateFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && validateFile(file)) {
        onFileSelect(file);
      }
    },
    [onFileSelect, validateFile]
  );

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="w-8 h-8" />;
    if (type.includes('image')) return <Image className="w-8 h-8" />;
    return <FileType className="w-8 h-8" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (selectedFile) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0">
              {getFileIcon(selectedFile.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">
                {selectedFile.name}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatSize(selectedFile.size)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onFileSelect(null as unknown as File)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <label
        className={cn(
          'relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300',
          'bg-muted/30 hover:bg-muted/50',
          isDragging && 'drop-zone-active'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
          <div className="w-16 h-16 rounded-2xl printf-gradient flex items-center justify-center mb-4 shadow-lg animate-float">
            <Upload className="w-8 h-8 text-primary-foreground" />
          </div>
          <p className="mb-2 text-lg font-semibold text-foreground">
            Drop your file here
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, Word, PNG, JPEG (max 50MB)
          </p>
        </div>
        <input
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          onChange={handleChange}
        />
      </label>
    </div>
  );
}
