import { useState, useEffect, useCallback } from 'react';
import { FileText, Maximize2, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

// Set the worker source for pdfjs-dist v3.x
GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface DocumentPreviewProps {
  file: File;
  onRemove: () => void;
  onAddMore?: () => void;
  pageCount?: number;
}

export function DocumentPreview({ file, onRemove, pageCount = 1 }: DocumentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [firstPageImage, setFirstPageImage] = useState<string | null>(null);
  const [allPageImages, setAllPageImages] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const isImage = file.type.startsWith('image/');
  const isPDF = file.type === 'application/pdf';

  // Load PDF document once
  useEffect(() => {
    if (!isPDF) return;

    let cancelled = false;

    const loadPdf = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocument({ data: arrayBuffer }).promise;
        if (!cancelled) {
          setPdfDoc(pdf);
          console.log(`PDF loaded with ${pdf.numPages} pages`);
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
        if (!cancelled) {
          setRenderError('Failed to load PDF');
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [file, isPDF]);

  // Render first page for thumbnail
  useEffect(() => {
    if (!pdfDoc) return;

    const renderFirstPage = async () => {
      try {
        const page = await pdfDoc.getPage(1);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (context) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          setFirstPageImage(canvas.toDataURL('image/png'));
        }
      } catch (error) {
        console.error('Error rendering first page:', error);
      }
    };

    renderFirstPage();
  }, [pdfDoc]);

  // Render all pages when dialog opens
  const renderAllPages = useCallback(async () => {
    if (!pdfDoc || isLoadingPages || allPageImages.length > 0) return;

    setIsLoadingPages(true);
    setRenderError(null);

    try {
      const totalPages = pdfDoc.numPages;
      console.log(`Starting to render ${totalPages} pages...`);
      const pages: string[] = [];

      for (let i = 1; i <= totalPages; i++) {
        console.log(`Rendering page ${i}/${totalPages}`);
        const page = await pdfDoc.getPage(i);
        const scale = 1.5; // Reduced scale for better performance
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (context) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          pages.push(canvas.toDataURL('image/jpeg', 0.8)); // Use JPEG for smaller size
        }
      }

      console.log(`Successfully rendered ${pages.length} pages`);
      setAllPageImages(pages);
    } catch (error) {
      console.error('Error rendering PDF pages:', error);
      setRenderError('Failed to render pages');
    } finally {
      setIsLoadingPages(false);
    }
  }, [pdfDoc, isLoadingPages, allPageImages.length]);

  // Trigger page rendering when dialog opens
  useEffect(() => {
    if (isExpanded && isPDF && pdfDoc && allPageImages.length === 0 && !isLoadingPages) {
      renderAllPages();
    }
  }, [isExpanded, isPDF, pdfDoc, allPageImages.length, isLoadingPages, renderAllPages]);

  // Handle image files
  useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, isImage]);

  // Reset state when file changes
  useEffect(() => {
    setAllPageImages([]);
    setFirstPageImage(null);
    setPdfDoc(null);
    setRenderError(null);
    setIsLoadingPages(false);
  }, [file]);

  const totalPages = pdfDoc?.numPages || pageCount;

  return (
    <>
      <div className="w-full">
        {/* Preview Area */}
        <div className="bg-muted/30 rounded-2xl p-8 min-h-[350px] flex items-center justify-center">
          {/* Document Preview Card */}
          <div className="bg-card rounded-xl shadow-xl border border-border overflow-hidden max-w-[280px] w-full">
            {/* Document Content Preview - First Page */}
            <div className="relative bg-white min-h-[280px] max-h-[320px] overflow-hidden flex items-center justify-center">
              {isImage && previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-contain p-2"
                />
              ) : isPDF && firstPageImage ? (
                <img
                  src={firstPageImage}
                  alt="PDF First Page Preview"
                  className="w-full h-auto object-contain"
                />
              ) : isPDF ? (
                <div className="w-full h-[280px] flex flex-col items-center justify-center text-muted-foreground animate-pulse">
                  <FileText className="w-12 h-12 mb-2" />
                  <p className="text-sm">Loading preview...</p>
                </div>
              ) : (
                <div className="w-full h-[280px] flex flex-col items-center justify-center text-muted-foreground">
                  <FileText className="w-16 h-16 mb-2" />
                  <p className="text-sm">{file.name}</p>
                </div>
              )}

              {/* Action Buttons - Top Right */}
              <div className="absolute top-3 right-3 flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 bg-white/90 hover:bg-white text-muted-foreground hover:text-foreground shadow-md border border-border"
                  onClick={() => setIsExpanded(true)}
                >
                  <Maximize2 className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 bg-white/90 hover:bg-white text-destructive hover:text-destructive shadow-md border border-border"
                  onClick={onRemove}
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* File Info Footer */}
            <div className="px-4 py-3 bg-muted/50 border-t border-border">
              <p className="text-sm font-medium text-foreground truncate">
                {file.name}
              </p>
              {isPDF && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {totalPages} Page{totalPages > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Accepted Formats */}
        <p className="text-center text-sm text-muted-foreground mt-4">
          Accepted formats: PDF, DOCX, JPG, PNG. Max 50MB per file.
        </p>
      </div>

      {/* Fullscreen Preview Dialog */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col" aria-describedby={undefined}>
          <VisuallyHidden>
            <DialogTitle>Document Preview - {file.name}</DialogTitle>
          </VisuallyHidden>
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium text-foreground">{file.name}</span>
              {isPDF && (
                <span className="text-sm text-muted-foreground">
                  ({totalPages} page{totalPages > 1 ? 's' : ''})
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onRemove}
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>

          {/* Document View - Scrollable */}
          <div className="flex-1 min-h-0 bg-muted/30 overflow-y-auto">
            {isImage && previewUrl ? (
              <div className="w-full h-full flex items-center justify-center p-4">
                <img
                  src={previewUrl}
                  alt="Full preview"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                />
              </div>
            ) : isPDF && isLoadingPages ? (
              <div className="w-full h-64 flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="w-12 h-12 mb-4 animate-spin" />
                <p className="text-lg font-medium">Loading {totalPages} pages...</p>
              </div>
            ) : isPDF && renderError ? (
              <div className="w-full h-64 flex flex-col items-center justify-center text-destructive">
                <FileText className="w-16 h-16 mb-4" />
                <p className="text-lg font-medium">{renderError}</p>
              </div>
            ) : isPDF && allPageImages.length > 0 ? (
              <div className="p-6 space-y-6">
                {allPageImages.map((pageImage, index) => (
                  <div key={index} className="relative mx-auto" style={{ maxWidth: '100%' }}>
                    <img
                      src={pageImage}
                      alt={`Page ${index + 1}`}
                      className="w-full shadow-lg rounded-lg border border-border"
                    />
                    <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      Page {index + 1} of {allPageImages.length}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full h-64 flex flex-col items-center justify-center text-muted-foreground">
                <FileText className="w-24 h-24 mb-4" />
                <p className="text-lg font-medium">{file.name}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
