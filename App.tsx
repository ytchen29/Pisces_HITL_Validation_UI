
import React, { useState, useEffect } from 'react';
import { Upload, Download, Eye, FileJson, CheckCircle, FileUp, Settings, Info, Sparkles, Bot, ShieldCheck, ArrowRight, Database, Cpu, FileSearch, User, Edit3, CheckCircle2, Shield, PlusCircle, Files } from 'lucide-react';
import { PdfViewer } from './components/PdfViewer';
import { ConflictResolver } from './components/ConflictResolver';
import { SFFData, SelectionContext, SFFField, AgentContribution, ReviewerComment } from './types';
import { MOCK_SFF_DATA } from './constants';

interface PdfDocument {
  id: string;
  name: string;
  url: string;
}

const base64ToBlob = (base64: string, type = 'application/pdf') => {
  const binStr = atob(base64.split(',')[1]);
  const len = binStr.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = binStr.charCodeAt(i);
  }
  return new Blob([arr], { type });
};

const parsePageNumber = (locationString?: string): number => {
  if (!locationString) return 1;
  const match = locationString.match(/Page\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : 1;
};

const normalizeConfidence = (conf: any): 'High' | 'Medium' | 'Low' => {
  if (!conf) return 'High';
  const level = typeof conf === 'string' ? conf : conf.level;
  if (!level) return 'High';
  const lower = level.toLowerCase();
  if (lower === 'high') return 'High';
  if (lower === 'medium') return 'Medium';
  if (lower === 'low') return 'Low';
  return 'High';
};

const parseSffData = (json: any, fileName: string, currentReviewer: string): SFFData => {
  const root = Array.isArray(json) ? json[0] : json;
  const fields: SFFField[] = [];
  let fieldCounter = 0;
  let fileReviewerId = currentReviewer;

  if (root.metadata && root.metadata.reviewer_id && root.metadata.reviewer_id.value) {
    fileReviewerId = String(root.metadata.reviewer_id.value);
  }

  const traverse = (node: any, section: string, pathPrefix: string, keyPrefix: string) => {
    if (!node || typeof node !== 'object') return;

    if (Object.prototype.hasOwnProperty.call(node, 'value')) {
      let parentValue = node.value;
      const confInput = node.confidence;
      const isResolved = node.reviewed === true;

      // Handle stringified JSON in value field
      if (typeof parentValue === 'string' && (parentValue.trim().startsWith('{') || parentValue.trim().startsWith('['))) {
        try {
          const parsed = JSON.parse(parentValue);
          if (parsed && typeof parsed === 'object') {
            parentValue = parsed;
          }
        } catch (e) {}
      }

      const reviewedByList: string[] = [];
      if (node.reviewed_by) {
        if (Array.isArray(node.reviewed_by)) reviewedByList.push(...node.reviewed_by.map(String));
        else reviewedByList.push(String(node.reviewed_by));
      } else if (isResolved && fileReviewerId) {
        reviewedByList.push(fileReviewerId);
      }

      const comments: ReviewerComment[] = [];
      if (node.comments && Array.isArray(node.comments)) {
        comments.push(...node.comments);
      } else if (node.comment) {
        comments.push({ reviewer: fileReviewerId || "Previous Reviewer", text: node.comment });
      }

      const getAlternatives = (altSource: any[]) => altSource.map((alt: any) => {
        let val = alt.value;
        if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
          try {
            const p = JSON.parse(val);
            if (p && typeof p === 'object') val = p;
          } catch(e) {}
        }
        return {
          agentName: alt.source || "Unknown Agent",
          value: val,
          source: {
            page: parsePageNumber(alt.source_details?.location),
            paragraph: alt.source_details?.location || "Unknown Location",
            location: alt.source_details?.location,
            type: alt.source_details?.type,
            snippet: alt.source_details?.snippet || ""
          }
        };
      });

      const getSource = (srcObj: any) => {
        if (!srcObj) return undefined;
        return {
          page: parsePageNumber(srcObj.location),
          paragraph: srcObj.location,
          location: srcObj.location,
          type: srcObj.type,
          snippet: srcObj.snippet || ""
        };
      };

      const sharedAlternatives = getAlternatives(node.alternatives || []);
      const sharedSource = getSource(node.source || node.confidence?.source_details);

      // EXTENDED FORM: Split object values into individual rows
      if (parentValue && typeof parentValue === 'object' && !Array.isArray(parentValue)) {
        Object.keys(parentValue).forEach(subKey => {
          const fieldId = `field-${fieldCounter++}`;
          fields.push({
            id: fieldId,
            section,
            path: `${pathPrefix}.value.${subKey}`,
            key: `${keyPrefix}.${subKey}`,
            label: subKey,
            value: parentValue[subKey],
            confidence: normalizeConfidence(confInput),
            confidenceDescription: (confInput && typeof confInput === 'object') ? confInput.description : undefined,
            alternatives: sharedAlternatives.map(alt => ({
              ...alt,
              value: (alt.value && typeof alt.value === 'object') ? alt.value[subKey] : alt.value
            })),
            isResolved,
            reviewedBy: reviewedByList,
            source: sharedSource,
            comments: comments
          });
        });
        return;
      }

      // Standard field
      const fieldId = `field-${fieldCounter++}`;
      fields.push({
        id: fieldId,
        section,
        path: pathPrefix,
        key: keyPrefix,
        label: keyPrefix.split('.').pop() || keyPrefix, 
        value: parentValue,
        confidence: normalizeConfidence(confInput),
        confidenceDescription: (confInput && typeof confInput === 'object') ? confInput.description : undefined,
        alternatives: sharedAlternatives,
        isResolved,
        reviewedBy: reviewedByList,
        source: sharedSource,
        comments: comments
      });
      return; 
    }

    if (Array.isArray(node)) {
      node.forEach((item, idx) => {
        traverse(item, section, `${pathPrefix}[${idx}]`, `${keyPrefix}[${idx}]`);
      });
      return;
    }

    Object.keys(node).forEach(key => {
      if (['confidence', 'source_details', 'alternatives', 'comment', 'comments', 'source', 'reviewed', 'reviewed_by', 'value'].includes(key)) return;
      const newPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      const newKey = keyPrefix ? `${keyPrefix}.${key}` : key;
      traverse(node[key], section, newPath, newKey);
    });
  };

  const getDisplayId = (idNode: any): string => {
    if (!idNode) return "Unknown";
    if (typeof idNode === 'object' && idNode.hasOwnProperty('value')) return String(idNode.value);
    return String(idNode);
  };

  if (root.metadata) {
    const rootPath = Array.isArray(json) ? "[0].metadata" : "metadata";
    traverse(root.metadata, "Metadata", rootPath, "");
  }

  // Generalized section traversal
  const possibleSections = ['units', 'streams', 'chemicals', 'units_operations', 'equipment'];
  possibleSections.forEach(secKey => {
    if (root[secKey] && Array.isArray(root[secKey])) {
      root[secKey].forEach((item: any, idx: number) => {
        const itemId = getDisplayId(item.id);
        const sectionName = `${secKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').slice(0, -1)}: ${itemId}`;
        const itemPath = Array.isArray(json) ? `[0].${secKey}[${idx}]` : `${secKey}[${idx}]`;
        Object.keys(item).forEach(key => traverse(item[key], sectionName, `${itemPath}.${key}`, key));
      });
    }
  });

  if (root.utilities) {
    const utilsRootPath = Array.isArray(json) ? `[0].utilities` : `utilities`;
    Object.keys(root.utilities).forEach(utilityType => {
      const utilGroup = root.utilities[utilityType];
      if (Array.isArray(utilGroup)) {
        utilGroup.forEach((util: any, idx: number) => {
          const utilId = getDisplayId(util.id);
          const sectionName = `Utility: ${utilId}`;
          const utilPath = `${utilsRootPath}.${utilityType}[${idx}]`;
          Object.keys(util).forEach(key => traverse(util[key], sectionName, `${utilPath}.${key}`, key));
        });
      }
    });
  }

  return {
    fileName: fileName,
    reviewerId: fileReviewerId,
    fields: fields,
    originalJson: json
  };
};

const setByPath = (obj: any, path: string, value: any) => {
  if (path.startsWith('.')) path = path.slice(1);
  const keys = path.match(/([^[.\]]+|\[\d+\])/g);
  if (!keys) return;
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    let key = keys[i];
    if (key.startsWith('[') && key.endsWith(']')) {
      const index = parseInt(key.slice(1, -1), 10);
      current = current[index];
    } else {
      if (!current[key]) current[key] = {};
      current = current[key];
    }
  }
  const lastKey = keys[keys.length - 1];
  if (lastKey.startsWith('[') && lastKey.endsWith(']')) {
     const index = parseInt(lastKey.slice(1, -1), 10);
     current[index] = value;
  } else {
     current[lastKey] = value;
  }
};

const deleteByPath = (obj: any, path: string) => {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(p => p);
  if (parts.length === 0) return;
  const lastKey = parts.pop();
  let current = obj;
  for (const key of parts) {
      if (current && typeof current === 'object' && key in current) {
          current = current[key];
      } else {
          return;
      }
  }
  if (current && typeof current === 'object' && lastKey) {
      if (Array.isArray(current)) {
          delete current[lastKey as any];
      } else {
          delete current[lastKey];
      }
  }
};

function App() {
  const [pdfDocuments, setPdfDocuments] = useState<PdfDocument[]>([]);
  const [reviewerId, setReviewerId] = useState<string>("");
  const [sffData, setSffData] = useState<SFFData | null>(null);
  const [selectionContext, setSelectionContext] = useState<SelectionContext | null>(null);
  const [cleanExport, setCleanExport] = useState(false);

  useEffect(() => {
    return () => { 
      pdfDocuments.forEach(doc => URL.revokeObjectURL(doc.url));
    };
  }, []);

  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const newDoc: PdfDocument = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        url: URL.createObjectURL(file)
      };
      setPdfDocuments(prev => [...prev, newDoc]);
    }
    // Reset target value to allow uploading same file if needed (e.g. if deleted)
    event.target.value = '';
  };

  const handleJsonUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type.includes('json') || file.name.toLowerCase().endsWith('.json'))) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          const parsedData = parseSffData(json, file.name, reviewerId || "Expert_Reviewer");
          setSffData(parsedData);
          if (!reviewerId) setReviewerId(parsedData.reviewerId);
        } catch (error) {
          alert("Failed to parse the JSON file.");
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    }
  };

  const handleUpdateField = (fieldId: string, newValue: any, isResolved: boolean) => {
    if (!sffData) return;
    setSffData({
      ...sffData,
      fields: sffData.fields.map(field => {
        if (field.id !== fieldId) return field;
        const newReviewers = [...field.reviewedBy];
        if (isResolved && !newReviewers.includes(reviewerId)) {
          newReviewers.push(reviewerId);
        }
        return { 
          ...field, 
          value: newValue, 
          isResolved, 
          reviewedBy: newReviewers 
        };
      })
    });
  };

  const handleUpdateComment = (fieldId: string, commentText: string) => {
    if (!sffData) return;
    setSffData({
      ...sffData,
      fields: sffData.fields.map(field => {
        if (field.id !== fieldId) return field;
        const existingCommentIdx = field.comments.findIndex(c => c.reviewer === reviewerId);
        const updatedComments = [...field.comments];
        if (existingCommentIdx > -1) {
          if (commentText.trim() === "") updatedComments.splice(existingCommentIdx, 1);
          else updatedComments[existingCommentIdx] = { ...updatedComments[existingCommentIdx], text: commentText };
        } else if (commentText.trim() !== "") {
          updatedComments.push({ reviewer: reviewerId, text: commentText });
        }
        return { ...field, comments: updatedComments };
      })
    });
  };

  const handleDeleteField = (fieldId: string) => {
    if (!sffData) return;
    setSffData(prev => prev ? ({ ...prev, fields: prev.fields.filter(f => f.id !== fieldId) }) : null);
  };

  const handleDeleteSection = (sectionName: string) => {
    if (!sffData) return;
    setSffData(prev => prev ? ({ ...prev, fields: prev.fields.filter(f => (f.section || "General") !== sectionName) }) : null);
  };

  const handleDownload = () => {
    if (!sffData || !sffData.originalJson) return;
    const clonedJson = JSON.parse(JSON.stringify(sffData.originalJson));
    sffData.fields.forEach(field => {
      if (!cleanExport) {
        if (field.comments.length > 0) setByPath(clonedJson, field.path + ".comments", field.comments);
        if (field.reviewedBy.length > 0) setByPath(clonedJson, field.path + ".reviewed_by", field.reviewedBy);
      }
      if (field.isResolved) {
         setByPath(clonedJson, field.path + ".value", field.value);
         if (!cleanExport) setByPath(clonedJson, field.path + ".reviewed", true);
      }
    });
    if (cleanExport) {
        const removeKeys = (obj: any, keys: string[]) => {
             if (typeof obj !== 'object' || obj === null) return;
             if (Array.isArray(obj)) { obj.forEach(i => removeKeys(i, keys)); return; }
             keys.forEach(key => { if (key in obj) delete obj[key]; });
             Object.keys(obj).forEach(k => removeKeys(obj[k], keys));
        };
        removeKeys(clonedJson, ['alternatives', 'reviewed', 'comment', 'comments', 'reviewer_id', 'reviewed_by']);
    }
    const blob = new Blob([JSON.stringify(clonedJson, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `validated_${sffData.fileName.replace('.json', '') || 'export'}.json`;
    link.click();
  };

  const handleRemovePdf = (id: string) => {
    setPdfDocuments(prev => {
        const target = prev.find(d => d.id === id);
        if (target) URL.revokeObjectURL(target.url);
        return prev.filter(d => d.id !== id);
    });
  };

  if (pdfDocuments.length === 0 && !sffData) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 items-center justify-center p-6 sm:p-12 overflow-y-auto">
         {/* Hero Header */}
         <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
           <h1 className="text-5xl sm:text-7xl font-black mb-6 tracking-tight">
             Validate. Resolve. <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Perfect.</span>
           </h1>
           <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
             A Human-in-the-Loop interface for bioprocess data extraction. Review multi-agent consensus, resolve low-confidence conflicts, and verify source grounding in real-time.
           </p>
         </div>

         {/* Reviewer Input & Action */}
         <div className="bg-slate-900/50 p-8 rounded-3xl shadow-2xl border border-slate-800 w-full max-w-lg mb-20 backdrop-blur-sm animate-in zoom-in-95 delay-200 fill-mode-both">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-3 ml-1">Reviewer Identity</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" 
                    value={reviewerId} 
                    onChange={e => setReviewerId(e.target.value)} 
                    placeholder="Enter expert name or ID..." 
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-700 font-medium" 
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl text-center cursor-pointer transition-all shadow-lg shadow-blue-900/20 active:scale-95">
                  <Upload className="w-5 h-5" />
                  Upload PDF to Start
                  <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
                </label>
                
                <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest pt-2">Then load extraction results inside</p>
              </div>
            </div>
         </div>

         {/* Feature Grid */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl animate-in fade-in slide-in-from-bottom-4 delay-300 fill-mode-both">
            <div className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 hover:border-blue-500/50 transition-all group">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
                <Bot className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Multi-Agent Consensus</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Aggregates extractions from multiple LLMs to identify high-confidence data and flag discrepancies.
              </p>
            </div>

            <div className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 hover:border-emerald-500/50 transition-all group">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-500/20 transition-colors">
                <FileSearch className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Source Grounding</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Interactive PDF viewer that highlights exactly where data was extracted from for instant verification.
              </p>
            </div>

            <div className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 hover:border-purple-500/50 transition-all group">
              <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-500/20 transition-colors">
                <Database className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Faithful Export</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Exports validated SFF JSON that maintains the original structure while incorporating human reviews.
              </p>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="font-black text-xl text-blue-600 tracking-tighter">PISCES</span>
          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
          <div className="hidden sm:flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{reviewerId || "Expert_Reviewer"}</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
             <label className="text-[10px] font-black bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl cursor-pointer hover:bg-slate-50 transition-all uppercase tracking-widest flex items-center gap-2 shadow-sm">
               <PlusCircle className="w-3.5 h-3.5 text-blue-500" />
               Add Supplement PDF
               <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
             </label>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shadow-inner group">
            <div className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                id="clean-export-toggle"
                className="sr-only peer"
                checked={cleanExport}
                onChange={(e) => setCleanExport(e.target.checked)}
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              <label htmlFor="clean-export-toggle" className="ms-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer select-none">
                Clean Export
              </label>
            </div>
            <div className="group-hover:block hidden absolute top-14 bg-white border border-slate-200 p-3 rounded-lg shadow-xl text-[10px] text-slate-500 font-bold uppercase tracking-wider w-48 z-50">
              Strip all reviewer names, comments, and audit trails from the final JSON.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[10px] font-black bg-slate-950 text-white px-5 py-2.5 rounded-xl cursor-pointer hover:bg-slate-800 transition-all uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-slate-200">
               <FileUp className="w-3.5 h-3.5" />
               Load Results
               <input type="file" accept="application/json" className="hidden" onChange={handleJsonUpload} />
            </label>
            <button onClick={handleDownload} className="text-[10px] font-black bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-all shadow-sm uppercase tracking-widest flex items-center gap-2 group">
               <Download className={`w-3.5 h-3.5 ${cleanExport ? 'text-emerald-500' : 'text-slate-400'}`} />
               Export {cleanExport ? 'Final' : 'Full'} SFF
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <div className="w-1/2 h-full">
          <PdfViewer 
            pdfDocuments={pdfDocuments} 
            selectionContext={selectionContext} 
            onRemoveDocument={handleRemovePdf}
          />
        </div>
        <div className="w-1/2 h-full overflow-y-auto bg-slate-50/50">
           <ConflictResolver 
              data={sffData} 
              reviewerId={reviewerId || "Expert_Reviewer"}
              onUpdateField={handleUpdateField}
              onUpdateComment={handleUpdateComment}
              onHoverAlternative={setSelectionContext}
              onDeleteSection={handleDeleteSection}
              onDeleteField={handleDeleteField}
           />
        </div>
      </main>
    </div>
  );
}

export default App;
