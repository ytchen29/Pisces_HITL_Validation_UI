
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { FileText, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, Files, ExternalLink, Search as SearchIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { SelectionContext } from '../types';

interface PdfDocument {
  id: string;
  name: string;
  url: string;
}

interface SearchResult {
  page: number;
  matchIndex: number; // Index in the normalized searchable flow
  termLength: number;
}

interface PdfViewerProps {
  pdfDocuments: PdfDocument[];
  selectionContext: SelectionContext | null;
  onRemoveDocument?: (id: string) => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ pdfDocuments, selectionContext, onRemoveDocument }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [loading, setLoading] = useState(false);
  const [highlights, setHighlights] = useState<React.ReactElement[]>([]);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentSearchIdx, setCurrentSearchIdx] = useState(-1);

  // Set initial active doc if none set
  useEffect(() => {
    if (pdfDocuments.length > 0 && !activeDocId) {
      setActiveDocId(pdfDocuments[0].id);
    }
  }, [pdfDocuments]);

  const activeDoc = useMemo(() => pdfDocuments.find(d => d.id === activeDocId), [pdfDocuments, activeDocId]);

  useEffect(() => {
    if (!activeDoc) {
      setPdfDoc(null);
      setSearchResults([]);
      setCurrentSearchIdx(-1);
      return;
    }
    const loadPdf = async () => {
      setLoading(true);
      if (renderTaskRef.current) renderTaskRef.current.cancel();
      try {
        // @ts-ignore
        const doc = await window.pdfjsLib.getDocument(activeDoc.url).promise;
        setPdfDoc(doc);
        setPageNum(1);
        setSearchResults([]);
        setCurrentSearchIdx(-1);
      } catch (err) {
        console.error("PDF load error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadPdf();
  }, [activeDoc]);

  // Global Search Implementation
  const handleGlobalSearch = useCallback(async (query: string) => {
    if (!pdfDoc || !query.trim()) {
      setSearchResults([]);
      setCurrentSearchIdx(-1);
      return;
    }

    setIsSearching(true);
    const results: SearchResult[] = [];
    const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!normalizedQuery) {
      setIsSearching(false);
      return;
    }

    try {
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        
        let searchableFlow = "";
        textContent.items.forEach((item: any) => {
          const str = (item.str || "").toLowerCase().replace(/[^a-z0-9]/g, '');
          searchableFlow += str + " ";
        });

        let pos = searchableFlow.indexOf(normalizedQuery);
        while (pos !== -1) {
          results.push({
            page: i,
            matchIndex: pos,
            termLength: normalizedQuery.length
          });
          pos = searchableFlow.indexOf(normalizedQuery, pos + 1);
        }
      }

      setSearchResults(results);
      if (results.length > 0) {
        setCurrentSearchIdx(0);
        setPageNum(results[0].page);
      } else {
        setCurrentSearchIdx(-1);
      }
    } catch (err) {
      console.error("Search Error:", err);
    } finally {
      setIsSearching(false);
    }
  }, [pdfDoc]);

  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    let nextIdx = direction === 'next' ? currentSearchIdx + 1 : currentSearchIdx - 1;
    
    if (nextIdx >= searchResults.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = searchResults.length - 1;
    
    setCurrentSearchIdx(nextIdx);
    setPageNum(searchResults[nextIdx].page);
  };

  useEffect(() => {
    if (selectionContext && pdfDoc) {
      const targetPage = Math.max(1, selectionContext.page);
      if (targetPage <= pdfDoc.numPages) {
        setPageNum(targetPage);
      }
    }
  }, [selectionContext, pdfDoc]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    if (renderTaskRef.current) renderTaskRef.current.cancel();

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');

        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const renderContext = { canvasContext: context, viewport: viewport };
          const renderTask = page.render(renderContext);
          renderTaskRef.current = renderTask;
          await renderTask.promise;
          
          const textContent = await page.getTextContent();
          const highlightDivs: React.ReactElement[] = [];

          // Helper to draw highlights
          const drawItems = (matchStart: number, matchEnd: number, isSearch: boolean, isCurrent: boolean = false) => {
             // 1. Build character-to-item map
             let rawFlow = "";
             let rawFlowIndices: number[] = [];
             textContent.items.forEach((item: any, itemIdx: number) => {
                const str = item.str || "";
                for(let i=0; i < str.length; i++) {
                   rawFlow += str[i];
                   rawFlowIndices.push(itemIdx);
                }
                rawFlow += " ";
                rawFlowIndices.push(itemIdx);
             });

             let searchableFlow = "";
             let flowToRawIndices: number[] = [];
             for(let i=0; i < rawFlow.length; i++) {
                const char = rawFlow[i].toLowerCase();
                if (/[a-z0-9]/.test(char)) {
                   searchableFlow += char;
                   flowToRawIndices.push(i);
                }
             }

             // Find actual start/end in raw space
             // For search, matchStart is index in searchableFlow
             const rawStart = flowToRawIndices[matchStart];
             const rawEnd = flowToRawIndices[matchEnd];

             if (rawStart === undefined || rawEnd === undefined) return;

             const matchedItemIndices = new Set<number>();
             for (let i = rawStart; i <= rawEnd; i++) {
                const itemIdx = rawFlowIndices[i];
                if (itemIdx !== undefined) matchedItemIndices.add(itemIdx);
             }

             matchedItemIndices.forEach(itemIdx => {
                const item = textContent.items[itemIdx];
                if (!item) return;
                const itemH = item.height || 10; 
                const itemW = item.width || 0;
                const pdfRect = [item.transform[4], item.transform[5], item.transform[4] + itemW, item.transform[5] + itemH];
                const viewRect = viewport.convertToViewportRectangle(pdfRect);
                const x = Math.min(viewRect[0], viewRect[2]);
                const y = Math.min(viewRect[1], viewRect[3]);
                const width = Math.max(2, Math.abs(viewRect[2] - viewRect[0]));
                const height = Math.max(2, Math.abs(viewRect[3] - viewRect[1]));

                const colorClass = isSearch 
                    ? (isCurrent ? "bg-yellow-400 border-orange-500 shadow-[0_0_12px_rgba(245,158,11,0.6)] z-20" : "bg-yellow-300/60 border-yellow-400/50 z-10") 
                    : "bg-blue-500/35 border-blue-400/50 shadow-[0_0_10px_rgba(59,130,246,0.5)] z-10";

                highlightDivs.push(
                  <div
                    key={`${isSearch ? 's' : 'g'}-${itemIdx}-${matchStart}`}
                    className={`absolute mix-blend-multiply pointer-events-none rounded-sm border transition-all duration-300 ${colorClass}`}
                    style={{ left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` }}
                  />
                );
             });
          };

          // 1. Draw Search Highlights
          searchResults.forEach((res, idx) => {
            if (res.page === pageNum) {
                drawItems(res.matchIndex, res.matchIndex + res.termLength - 1, true, idx === currentSearchIdx);
            }
          });

          // 2. Draw Selection Context (Grounding)
          if (selectionContext && selectionContext.page === pageNum) {
             const normalizeForSearch = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
             const terms = [normalizeForSearch(selectionContext.snippet || ""), normalizeForSearch(String(selectionContext.value || ""))].filter(t => t.length > 2);
             
             let rawFlow = "";
             textContent.items.forEach((item: any) => { rawFlow += (item.str || "") + " "; });
             let searchableFlow = "";
             for(let i=0; i < rawFlow.length; i++) { if (/[a-z0-9]/.test(rawFlow[i].toLowerCase())) searchableFlow += rawFlow[i].toLowerCase(); }

             for (const term of terms) {
               const idx = searchableFlow.indexOf(term);
               if (idx !== -1) {
                  drawItems(idx, idx + term.length - 1, false);
                  break;
               }
             }
          }

          setHighlights(highlightDivs);
        }
      } catch (err) {
        console.error("Render/Highlight Error:", err);
      }
    };

    renderPage();
    return () => { if (renderTaskRef.current) renderTaskRef.current.cancel(); };
  }, [pdfDoc, pageNum, scale, selectionContext, searchResults, currentSearchIdx]);

  if (pdfDocuments.length === 0) {
    return (
      <div className="flex flex-col h-full bg-slate-100 items-center justify-center border-r border-slate-200 p-12 text-center">
        <Files className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">No PDF Source Loaded</h3>
        <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">Please upload a primary PDF from the welcome screen or use the 'Add Supplement' button in the header.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-100 border-r border-slate-200">
      {/* Dynamic Tab Bar */}
      <div className="flex items-center bg-white border-b border-slate-200 overflow-x-auto no-scrollbar scroll-smooth">
        {pdfDocuments.map((doc, idx) => (
          <div 
            key={doc.id}
            onClick={() => setActiveDocId(doc.id)}
            className={`flex items-center gap-2 px-5 h-12 border-r border-slate-100 cursor-pointer transition-all min-w-[140px] relative group ${
              activeDocId === doc.id ? 'bg-white' : 'bg-slate-50/50 hover:bg-slate-50 opacity-60 hover:opacity-100'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-blue-500' : 'bg-purple-500'}`} />
            <span className={`text-[10px] font-black uppercase tracking-tight truncate max-w-[120px] ${activeDocId === doc.id ? 'text-slate-900' : 'text-slate-500'}`}>
              {doc.name}
            </span>
            {pdfDocuments.length > 1 && (
              <button 
                onClick={(e) => { e.stopPropagation(); onRemoveDocument?.(doc.id); if (activeDocId === doc.id) setActiveDocId(pdfDocuments[idx-1]?.id || pdfDocuments[idx+1]?.id || null); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded-lg transition-all"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
            {activeDocId === doc.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </div>
        ))}
      </div>

      <div className="h-10 bg-white/80 backdrop-blur-sm border-b border-slate-200 flex items-center px-4 justify-between text-slate-500 z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">View</span>
          </div>
          
          {/* Global Search Bar */}
          <div className="flex items-center bg-slate-100 rounded-lg px-2 py-0.5 border border-slate-200 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <SearchIcon className="w-3 h-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search PDF..." 
              className="bg-transparent border-none outline-none text-[10px] font-bold px-2 w-28 placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGlobalSearch(searchQuery)}
            />
            {searchResults.length > 0 && (
                <div className="flex items-center gap-1 border-l border-slate-200 ml-1 pl-1">
                    <span className="text-[9px] font-black text-slate-500 w-8 text-center">{currentSearchIdx + 1}/{searchResults.length}</span>
                    <button onClick={() => navigateSearch('prev')} className="p-0.5 hover:bg-slate-200 rounded"><ChevronUp className="w-3 h-3" /></button>
                    <button onClick={() => navigateSearch('next')} className="p-0.5 hover:bg-slate-200 rounded"><ChevronDown className="w-3 h-3" /></button>
                </div>
            )}
            {isSearching && <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-1" />}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {selectionContext && selectionContext.page === pageNum && (
             <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[8px] font-black uppercase border border-blue-200 animate-pulse">
               <ExternalLink className="w-2.5 h-2.5" /> Source
             </div>
          )}
          {pdfDoc && (
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-0.5 border border-slate-200 shadow-sm">
              <button onClick={() => setPageNum(p => Math.max(1, p - 1))} className="p-1 hover:bg-white rounded transition-colors disabled:opacity-20"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <span className="text-[9px] font-black w-14 text-center text-slate-600">{pageNum} / {pdfDoc.numPages}</span>
              <button onClick={() => setPageNum(p => Math.min(pdfDoc.numPages, p + 1))} className="p-1 hover:bg-white rounded transition-colors disabled:opacity-20"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <div className="flex gap-1">
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600"><ZoomOut className="w-3.5 h-3.5" /></button>
              <button onClick={() => setScale(s => Math.min(4.0, s + 0.25))} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600"><ZoomIn className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
      
      <div ref={containerRef} className="flex-1 relative overflow-auto bg-slate-200/50 flex items-start justify-center p-8 sm:p-12">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px] z-20 animate-in fade-in duration-300">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Initializing PDF Stream...</span>
          </div>
        )}
        {activeDoc && (
          <div className="relative shadow-2xl transition-all duration-300 transform-gpu origin-top group/pdf">
             <canvas ref={canvasRef} className="bg-white block rounded-sm" />
             <div className="absolute inset-0 pointer-events-none">{highlights}</div>
             <div className="absolute inset-0 border border-black/5 pointer-events-none" />
          </div>
        )}
      </div>
    </div>
  );
};
