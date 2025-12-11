import React, { useEffect, useRef, useState } from 'react';
import { FileText, Search, ExternalLink, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MapPin, Info } from 'lucide-react';
import { SelectionContext } from '../types';

interface PdfViewerProps {
  pdfUrl: string | null;
  selectionContext: SelectionContext | null;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ pdfUrl, selectionContext }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<React.ReactElement[]>([]);

  // Load PDF Document
  useEffect(() => {
    if (!pdfUrl) return;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
      try {
        // @ts-ignore
        const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setPageNum(1);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF. The file might be corrupted or incompatible.');
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [pdfUrl]);

  // Handle Context Jumps
  useEffect(() => {
    if (selectionContext && pdfDoc) {
      const targetPage = Math.max(1, selectionContext.page);
      if (targetPage <= pdfDoc.numPages) {
        setPageNum(targetPage);
      }
    }
  }, [selectionContext, pdfDoc]);

  // Render Page & Compute Highlights
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    // Cancel any ongoing render to prevent race conditions (upside down glitch)
    if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
    }

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');

        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };
          
          const renderTask = page.render(renderContext);
          renderTaskRef.current = renderTask;
          await renderTask.promise;
          
          // --- Text Highlighting Logic ---
          if (selectionContext && selectionContext.page === pageNum && selectionContext.snippet) {
             const textContent = await page.getTextContent();
             const cleanSnippet = selectionContext.snippet.toLowerCase().replace(/\s+/g, '');
             const highlightDivs: React.ReactElement[] = [];
             
             textContent.items.forEach((item: any, index: number) => {
                 const itemStr = item.str.toLowerCase().replace(/\s+/g, '');
                 if (itemStr.length > 3 && cleanSnippet.includes(itemStr)) {
                     // Robust coordinate conversion that handles rotation automatically
                     // transform: [scaleX, skewY, skewX, scaleY, x, y]
                     // convertToViewportRectangle input: [x1, y1, x2, y2] in PDF coords
                     
                     // Assuming item.height is font height. 
                     // PDF coordinates: origin bottom-left.
                     const itemH = item.height || 10; 
                     const itemW = item.width;
                     
                     const pdfX = item.transform[4];
                     const pdfY = item.transform[5];
                     
                     // Construct rect in PDF coordinate space
                     // Note: Y grows upwards in PDF, so top is y + height
                     const pdfRect = [pdfX, pdfY, pdfX + itemW, pdfY + itemH];
                     
                     const viewRect = viewport.convertToViewportRectangle(pdfRect);
                     
                     // viewRect is [xMin, yMin, xMax, yMax] in Canvas coordinates (Top-Left origin)
                     const x = Math.min(viewRect[0], viewRect[2]);
                     const y = Math.min(viewRect[1], viewRect[3]);
                     const width = Math.abs(viewRect[2] - viewRect[0]);
                     const height = Math.abs(viewRect[3] - viewRect[1]);

                     highlightDivs.push(
                         <div
                            key={index}
                            className="absolute bg-yellow-300 mix-blend-multiply opacity-60 pointer-events-none"
                            style={{
                                left: `${x}px`,
                                top: `${y}px`,
                                width: `${width}px`,
                                height: `${height}px`,
                            }}
                         />
                     );
                 }
             });
             setHighlights(highlightDivs);
          } else {
             setHighlights([]);
          }
        }
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
            console.error('Error rendering page:', err);
        }
      } finally {
        // Clear ref if we matched the current task
        // But tracking exact identity is hard without unique IDs, strict cancel above helps.
      }
    };

    renderPage();
    
    return () => {
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
        }
    };
  }, [pdfDoc, pageNum, scale, selectionContext]);

  const changePage = (offset: number) => {
    if (!pdfDoc) return;
    const newPage = pageNum + offset;
    if (newPage >= 1 && newPage <= pdfDoc.numPages) {
      setPageNum(newPage);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 border-r border-slate-700">
      <div className="h-12 bg-slate-900 border-b border-slate-700 flex items-center px-4 justify-between text-slate-300 flex-shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <span className="text-xs font-medium hidden md:inline">Source Viewer</span>
        </div>

        {pdfDoc && (
          <div className="flex items-center gap-2 bg-slate-800 rounded-md p-1">
            <button 
              onClick={() => changePage(-1)} 
              disabled={pageNum <= 1}
              className="p-1 hover:bg-slate-700 rounded disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono w-16 text-center">
              {pageNum} / {pdfDoc.numPages}
            </span>
            <button 
              onClick={() => changePage(1)} 
              disabled={pageNum >= pdfDoc.numPages}
              className="p-1 hover:bg-slate-700 rounded disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
           <div className="flex items-center gap-1 border-r border-slate-700 pr-2 mr-2">
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-1 hover:text-white hover:bg-slate-700 rounded"><ZoomOut className="w-4 h-4" /></button>
              <button onClick={() => setScale(s => Math.min(3.0, s + 0.2))} className="p-1 hover:text-white hover:bg-slate-700 rounded"><ZoomIn className="w-4 h-4" /></button>
           </div>
          {pdfUrl && (
            <a 
              href={pdfUrl} 
              target="_blank" 
              rel="noreferrer"
              className="p-1 hover:text-white hover:bg-slate-700 rounded"
              title="Open in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 relative overflow-auto bg-slate-700 flex items-start justify-center p-8"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800 z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}

        {error ? (
           <div className="text-center p-8 mt-20">
            <div className="w-16 h-16 bg-red-900/30 rounded-lg flex items-center justify-center mx-auto mb-4 text-red-400">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-red-400 font-medium text-lg">Error Loading Document</h3>
            <p className="text-slate-400 max-w-xs mx-auto mt-2 text-sm">{error}</p>
          </div>
        ) : pdfUrl ? (
          <div className="relative shadow-2xl transition-transform duration-200">
             <canvas ref={canvasRef} className="bg-white block rounded-sm" />
             
             {/* Text Highlighting Overlay Layer */}
             <div ref={highlightLayerRef} className="absolute inset-0 pointer-events-none">
                {highlights}
             </div>
             
             {/* Enhanced Context Box */}
             {selectionContext && (
              <div className="fixed bottom-8 left-8 w-[420px] bg-slate-900/95 text-slate-200 border-l-4 border-yellow-500 shadow-2xl rounded-r-md p-4 animate-in slide-in-from-bottom-5 duration-300 z-30 backdrop-blur-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wide flex items-center gap-1">
                        <Search className="w-3 h-3" />
                        Match on Page {selectionContext.page}
                     </span>
                     {selectionContext.type && (
                       <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 capitalize">
                         {selectionContext.type}
                       </span>
                     )}
                  </div>
                </div>
                
                <p className="text-sm font-serif italic leading-relaxed border-l-2 border-slate-600 pl-3 mb-3 text-slate-300">
                  "...{selectionContext.snippet}..."
                </p>
                
                <div className="space-y-1">
                    <div className="flex items-start gap-2 text-[11px] text-slate-400">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span className="font-medium text-slate-300">{selectionContext.location || "Location not specified"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                       <Info className="w-3 h-3 flex-shrink-0" />
                       <span>Source Agent: </span>
                       <span className="font-bold text-white">{selectionContext.agent}</span>
                    </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-8 mt-20">
            <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center mx-auto mb-4 text-slate-600">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-slate-500 font-medium text-lg">No Document Loaded</h3>
            <p className="text-slate-600 max-w-xs mx-auto mt-2 text-sm">
              Upload a PDF to view the source material.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};