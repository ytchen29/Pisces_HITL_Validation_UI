import React, { useState, useEffect } from 'react';
import { Upload, Download, Eye, FileJson, CheckCircle, FileUp, Settings, Info, Sparkles, Bot, ShieldCheck, ArrowRight, Database, Cpu, FileSearch } from 'lucide-react';
import { PdfViewer } from './components/PdfViewer';
import { ConflictResolver } from './components/ConflictResolver';
import { SFFData, SelectionContext, SFFField, AgentContribution } from './types';
import { MOCK_SFF_DATA } from './constants';

// A simple 1-page PDF "Hello World" base64 for demo purposes
const DEMO_PDF_DATA_URI = "data:application/pdf;base64,JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmogCjw8CiAgL1R5cGUgL1BhZ2VzCiAgL01lZGlhQm94IFsgMCAwIDU5NS4yOCA4NDEuODkgXQogIC9Db3VudCAxCiAgL0tpZHMgWyAzIDAgUiBdCj4+CmVuZG9YmoKCjMgMCBvYmogCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCj4+CiAgPj4KICAvQ29udGVudHMgNSAwIFIKPj4KZW5kb2JqCgo0IDAgb2JqCjw8CiAgL1R5cGUgL0ZvbnQKICAvU3VidHlwZSAvVHlwZTEKICAvQmFzZUZvbnQgL1RpbWVzLVJvbWFuCj4+CmVuZG9YmoKCjUgMCBvYmogCjw8CiAgL0xlbmd0aCA0NAo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjcyIDcyIFRkCihQSVNDRVMgRGVtbyBQREYgQ29udGVudCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9YagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNjAgMDAwMDAwIG4gCjAwMDAwMDAxNTcgMDAwMDAwIG4gCjAwMDAwMDAyNTUgMDAwMDAwIG4gCjAwMDAwMDAzNDIgMDAwMDAwIG4gCnRyYWlsZXIKPDwKICAvU2l6ZSA2CiAgL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjQzNQQlJUVPRgo=";

// Helper to convert base64 data URI to Blob
const base64ToBlob = (base64: string, type = 'application/pdf') => {
  const binStr = atob(base64.split(',')[1]);
  const len = binStr.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = binStr.charCodeAt(i);
  }
  return new Blob([arr], { type });
};

// --- SFF Parser Logic ---

const parsePageNumber = (locationString?: string): number => {
  if (!locationString) return 1;
  const match = locationString.match(/Page\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : 1;
};

const normalizeConfidence = (conf: any): 'High' | 'Medium' | 'Low' => {
  if (!conf) return 'Low';
  const level = typeof conf === 'string' ? conf : conf.level;
  if (!level) return 'Low';
  const lower = level.toLowerCase();
  if (lower === 'high') return 'High';
  if (lower === 'medium') return 'Medium';
  return 'Low';
};

const parseSffData = (json: any, fileName: string): SFFData => {
  const root = Array.isArray(json) ? json[0] : json;
  const fields: SFFField[] = [];
  let fieldCounter = 0;

  // Recursive traverser to find "Field Objects" (objects with value & confidence)
  // pathPrefix: Absolute path for JSON updates (e.g. "units[0].design_input_specs")
  // keyPrefix: Relative key for display (e.g. "design_input_specs")
  const traverse = (node: any, section: string, pathPrefix: string, keyPrefix: string) => {
    if (!node || typeof node !== 'object') return;

    // Detection: Is this a Field Object?
    if (node.hasOwnProperty('value') && node.hasOwnProperty('confidence')) {
      const fieldId = `field-${fieldCounter++}`;
      
      const alternatives: AgentContribution[] = (node.alternatives || []).map((alt: any) => ({
        agentName: alt.source || "Unknown Agent",
        value: alt.value,
        source: {
          page: parsePageNumber(alt.source_details?.location),
          paragraph: alt.source_details?.location || "Unknown Location",
          location: alt.source_details?.location,
          type: alt.source_details?.type,
          snippet: alt.source_details?.snippet || ""
        }
      }));

      // Extract source for the main value (often exists in medium confidence fields)
      let mainSource = undefined;
      if (node.confidence?.source_details) {
         mainSource = {
            page: parsePageNumber(node.confidence.source_details.location),
            paragraph: node.confidence.source_details.location,
            location: node.confidence.source_details.location,
            type: node.confidence.source_details.type,
            snippet: node.confidence.source_details.snippet || ""
         };
      } else if (alternatives.length > 0) {
        // Fallback: if value matches an alternative, use its source? 
        // Logic for now: explicit source details take precedence.
      }

      fields.push({
        id: fieldId,
        section: section,
        path: pathPrefix,
        key: keyPrefix,
        label: keyPrefix.split('.').pop() || keyPrefix, 
        value: node.value,
        confidence: normalizeConfidence(node.confidence),
        alternatives: alternatives,
        isResolved: false,
        source: mainSource,
        comment: node.comment || undefined // Load existing comment if any
      });
      return;
    }

    // Recursion: Array
    if (Array.isArray(node)) {
      node.forEach((item, idx) => {
        traverse(item, section, `${pathPrefix}[${idx}]`, `${keyPrefix}[${idx}]`);
      });
      return;
    }

    // Recursion: Object
    Object.keys(node).forEach(key => {
      // Skip metadata keys of the field itself
      if (['confidence', 'source_details', 'alternatives', 'comment'].includes(key)) return;
      
      const newPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      const newKey = keyPrefix ? `${keyPrefix}.${key}` : key;
      traverse(node[key], section, newPath, newKey);
    });
  };

  // 1. Metadata
  if (root.metadata) {
    // If root is array, path is [0].metadata
    const rootPath = Array.isArray(json) ? "[0].metadata" : "metadata";
    traverse(root.metadata, "Metadata", rootPath, "");
  }

  // 2. Units
  if (root.units && Array.isArray(root.units)) {
    root.units.forEach((unit: any, idx: number) => {
      const unitId = unit.id || "Unknown Unit";
      const sectionName = `Unit: ${unitId}`;
      const unitPath = Array.isArray(json) ? `[0].units[${idx}]` : `units[${idx}]`;
      
      Object.keys(unit).forEach(key => {
        if (key === 'id') return; 
        traverse(unit[key], sectionName, `${unitPath}.${key}`, key);
      });
    });
  }

  // 3. Streams
  if (root.streams && Array.isArray(root.streams)) {
    root.streams.forEach((stream: any, idx: number) => {
      const streamId = stream.id || "Unknown Stream";
      const sectionName = `Stream: ${streamId}`;
      const streamPath = Array.isArray(json) ? `[0].streams[${idx}]` : `streams[${idx}]`;
      
      Object.keys(stream).forEach(key => {
        if (key === 'id') return;
        traverse(stream[key], sectionName, `${streamPath}.${key}`, key);
      });
    });
  }

  // 4. Chemicals
  if (root.chemicals && Array.isArray(root.chemicals)) {
    root.chemicals.forEach((chem: any, idx: number) => {
      const chemId = chem.id || "Unknown Chemical";
      const sectionName = `Chemical: ${chemId}`;
      const chemPath = Array.isArray(json) ? `[0].chemicals[${idx}]` : `chemicals[${idx}]`;
      
      Object.keys(chem).forEach(key => {
        if (key === 'id') return;
        traverse(chem[key], sectionName, `${chemPath}.${key}`, key);
      });
    });
  }

  // 5. Utilities
  if (root.utilities) {
    const utilsRootPath = Array.isArray(json) ? `[0].utilities` : `utilities`;
    Object.keys(root.utilities).forEach(utilityType => {
      const utilGroup = root.utilities[utilityType];
      if (Array.isArray(utilGroup)) {
        utilGroup.forEach((util: any, idx: number) => {
          const utilId = util.id || utilityType;
          const sectionName = `Utility: ${utilId}`;
          const utilPath = `${utilsRootPath}.${utilityType}[${idx}]`;
          
          Object.keys(util).forEach(key => {
             if (key === 'id') return;
             traverse(util[key], sectionName, `${utilPath}.${key}`, key);
          });
        });
      }
    });
  }

  return {
    fileName: fileName,
    fields: fields,
    originalJson: json
  };
};

// --- Safe Set Value Helper ---
const setByPath = (obj: any, path: string, value: any) => {
  if (path.startsWith('.')) path = path.slice(1);
  const keys = path.match(/([^[.\]]+|\[\d+\])/g);
  if (!keys) return;

  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    let key = keys[i];
    if (key.startsWith('[') && key.endsWith(']')) {
      const index = parseInt(key.slice(1, -1), 10);
      if (!Array.isArray(current)) { /* assume exists */ }
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

// --- Helper to Delete Property by Path (For Cleaning Deletions) ---
const deleteByPath = (obj: any, path: string) => {
  if (path.startsWith('.')) path = path.slice(1);
  const keys = path.match(/([^[.\]]+|\[\d+\])/g);
  if (!keys) return;

  const lastKey = keys.pop();
  if (!lastKey) return;

  let current = obj;
  for (const key of keys) {
     if (key.startsWith('[') && key.endsWith(']')) {
        const index = parseInt(key.slice(1, -1), 10);
        if (current[index] === undefined) return;
        current = current[index];
     } else {
        if (current[key] === undefined) return;
        current = current[key];
     }
  }

  // Only delete object properties. Avoid splicing arrays by index to prevent shifts.
  if (!(lastKey.startsWith('[') && lastKey.endsWith(']'))) {
      if (current) delete current[lastKey];
  }
};


function App() {
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [sffData, setSffData] = useState<SFFData | null>(null);
  const [selectionContext, setSelectionContext] = useState<SelectionContext | null>(null);
  const [cleanExport, setCleanExport] = useState(false);

  // Stats calculation
  const totalFields = sffData?.fields.length || 0;
  const resolvedFields = sffData?.fields.filter(f => f.isResolved).length || 0;
  const totalProgress = totalFields === 0 ? 0 : Math.round((resolvedFields / totalFields) * 100);

  // Granular Stats
  const lowFields = sffData?.fields.filter(f => f.confidence === 'Low') || [];
  const mediumFields = sffData?.fields.filter(f => f.confidence === 'Medium') || [];
  
  const resolvedLow = lowFields.filter(f => f.isResolved).length;
  const resolvedMedium = mediumFields.filter(f => f.isResolved).length;

  const lowProgress = lowFields.length === 0 ? 100 : Math.round((resolvedLow / lowFields.length) * 100);
  const mediumProgress = mediumFields.length === 0 ? 100 : Math.round((resolvedMedium / mediumFields.length) * 100);

  useEffect(() => {
    return () => {
      if (pdfFile) {
        URL.revokeObjectURL(pdfFile);
      }
    };
  }, [pdfFile]);

  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const fileUrl = URL.createObjectURL(file);
      setPdfFile(fileUrl);
    } else {
      alert("Please upload a valid PDF file.");
    }
  };

  const handleJsonUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type.includes('json') || file.name.toLowerCase().endsWith('.json'))) {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const json = JSON.parse(content);
          
          const parsedData = parseSffData(json, file.name);
          setSffData(parsedData);

        } catch (error) {
          console.error("Error parsing JSON:", error);
          alert("Failed to parse the JSON file. Please ensure it follows the SFF format.");
        }
      };
      
      reader.readAsText(file);
      event.target.value = '';
    } else {
      alert("Please upload a valid JSON file.");
    }
  };

  const loadDemo = () => {
    const blob = base64ToBlob(DEMO_PDF_DATA_URI);
    const url = URL.createObjectURL(blob);
    setSffData(MOCK_SFF_DATA);
    setPdfFile(url);
  };

  const handleUpdateField = (fieldId: string, newValue: any, isResolved: boolean) => {
    if (!sffData) return;
    
    setSffData({
      ...sffData,
      fields: sffData.fields.map(field => 
        field.id === fieldId 
          ? { ...field, value: newValue, isResolved } 
          : field
      )
    });
  };

  const handleUpdateComment = (fieldId: string, comment: string) => {
    if (!sffData) return;
    
    setSffData({
      ...sffData,
      fields: sffData.fields.map(field => 
        field.id === fieldId 
          ? { ...field, comment } 
          : field
      )
    });
  };

  const handleDeleteField = (fieldId: string) => {
    if (!sffData) return;
    // Removed confirmation for faster workflow ("I want it to disappear")
    setSffData(prev => prev ? ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== fieldId)
    }) : null);
  };

  const handleDeleteSection = (sectionName: string) => {
    if (!sffData) return;
    // Removed confirmation for immediate deletion as requested
    setSffData(prev => prev ? ({
      ...prev,
      fields: prev.fields.filter(f => (f.section || "General") !== sectionName)
    }) : null);
  };

  const handleDownload = () => {
    if (!sffData || !sffData.originalJson) return;
    
    // 1. Deep clone the original JSON
    const clonedJson = JSON.parse(JSON.stringify(sffData.originalJson));

    // 2. Identify and Remove Deleted Fields
    // We re-parse the original JSON to know what fields SHOULD be there originally.
    const originalState = parseSffData(sffData.originalJson, "temp");
    const currentPathSet = new Set(sffData.fields.map(f => f.path));

    // Find fields that were in original but are missing in current sffData
    const deletedFields = originalState.fields.filter(f => !currentPathSet.has(f.path));
    
    deletedFields.forEach(f => {
       deleteByPath(clonedJson, f.path);
    });

    // 3. Prune Sections (Arrays) if they are now empty or their section was removed
    // We iterate through known top-level arrays and keep only items that still have fields in sffData.
    const arraySections = ['units', 'streams', 'chemicals'];
    arraySections.forEach(sectionKey => {
       if (Array.isArray(clonedJson[sectionKey])) {
          clonedJson[sectionKey] = clonedJson[sectionKey].filter((_item: any, index: number) => {
             // If any field in current sffData starts with "units[index]", keep the item.
             const prefix = `${sectionKey}[${index}]`;
             return sffData.fields.some(f => f.path.startsWith(prefix));
          });
       }
    });

    // Handle utilities separately as it might be an object of arrays
    if (clonedJson.utilities && typeof clonedJson.utilities === 'object') {
       Object.keys(clonedJson.utilities).forEach(utilType => {
           if (Array.isArray(clonedJson.utilities[utilType])) {
               clonedJson.utilities[utilType] = clonedJson.utilities[utilType].filter((_: any, index: number) => {
                   const prefix = `utilities.${utilType}[${index}]`;
                   return sffData.fields.some(f => f.path.startsWith(prefix));
               });
           }
       });
    }

    // 4. Update Values and Comments
    sffData.fields.forEach(field => {
      // FIX: Write comment if present, regardless of resolution status
      if (field.comment && !cleanExport) {
         setByPath(clonedJson, field.path + ".comment", field.comment);
      }

      if (field.isResolved) {
         // Update Value
         setByPath(clonedJson, field.path + ".value", field.value);
         
         // Mark as reviewed
         if (!cleanExport) {
            setByPath(clonedJson, field.path + ".reviewed", true);
         }
      }
    });

    // 5. Clean properties if requested
    if (cleanExport) {
        const removeKeys = (obj: any, keys: string[]) => {
             if (typeof obj !== 'object' || obj === null) return;
             if (Array.isArray(obj)) {
                 obj.forEach(i => removeKeys(i, keys));
                 return;
             }
             keys.forEach(key => {
                 if (key in obj) delete obj[key];
             });
             Object.keys(obj).forEach(k => removeKeys(obj[k], keys));
        };
        // Remove 'alternatives', 'reviewed', and 'comment'
        removeKeys(clonedJson, ['alternatives', 'reviewed', 'comment']);
    }

    const jsonString = JSON.stringify(clonedJson, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `validated_${sffData.fileName.replace('.pdf', '') || 'export'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // If no files loaded, show landing page
  if (!sffData && !pdfFile) {
    return (
      <div className="flex flex-col h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
        {/* Modern Landing Page Hero */}
        <div className="relative flex-1 flex flex-col items-center justify-center p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950">
           {/* Abstract Background Elements */}
           <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]"></div>
              <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[100px]"></div>
           </div>

           <div className="relative z-10 max-w-4xl w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
              <div className="space-y-4">
                 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
                    <Sparkles className="w-3 h-3" />
                    PISCES HITL Resolver v1.0
                 </div>
                 <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-4">
                    Validate. Resolve. <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Perfect.</span>
                 </h1>
                 <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    A Human-in-the-Loop interface for bioprocess data extraction. 
                    Review multi-agent consensus, resolve low-confidence conflicts, and verify source grounding in real-time.
                 </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                 <label className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all cursor-pointer overflow-hidden">
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    <div className="flex items-center gap-3">
                       <Upload className="w-5 h-5" />
                       <span>Upload PDF to Start</span>
                    </div>
                    <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
                 </label>
              </div>
           </div>

           {/* Feature Grid */}
           <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full z-10 px-4">
              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/80 transition-colors">
                 <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center mb-4">
                    <Bot className="w-6 h-6" />
                 </div>
                 <h3 className="text-lg font-bold text-white mb-2">Multi-Agent Consensus</h3>
                 <p className="text-sm text-slate-400">Aggregates extractions from multiple LLMs to identify high-confidence data and flag discrepancies.</p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/80 transition-colors">
                 <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center mb-4">
                    <FileSearch className="w-6 h-6" />
                 </div>
                 <h3 className="text-lg font-bold text-white mb-2">Source Grounding</h3>
                 <p className="text-sm text-slate-400">Interactive PDF viewer that highlights exactly where data was extracted from for instant verification.</p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/80 transition-colors">
                 <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-lg flex items-center justify-center mb-4">
                    <Database className="w-6 h-6" />
                 </div>
                 <h3 className="text-lg font-bold text-white mb-2">Faithful Export</h3>
                 <p className="text-sm text-slate-400">Exports validated SFF JSON that maintains the original structure while incorporating human reviews.</p>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
            P
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight tracking-tight">PISCES HITL Resolver</h1>
            <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Validation Workflow</p>
          </div>
        </div>

        {/* Progress Bars */}
        {sffData && (
          <div className="flex flex-col gap-1.5 flex-1 max-w-md mx-8 justify-center">
            {/* Low Confidence Bar */}
            <div className="flex items-center gap-3 w-full">
               <span className="text-[10px] font-bold text-rose-600 uppercase w-12 text-right tracking-wider">Low</span>
               <div className="h-1.5 flex-1 bg-rose-50 rounded-full overflow-hidden border border-rose-100 relative">
                  <div 
                    className="h-full bg-rose-500 transition-all duration-500 relative" 
                    style={{ width: `${lowProgress}%` }}
                  ></div>
               </div>
               <span className="text-[10px] font-medium text-slate-500 w-8 text-right">{lowProgress}%</span>
            </div>

            {/* Medium Confidence Bar */}
            <div className="flex items-center gap-3 w-full">
               <span className="text-[10px] font-bold text-amber-600 uppercase w-12 text-right tracking-wider">Med</span>
               <div className="h-1.5 flex-1 bg-amber-50 rounded-full overflow-hidden border border-amber-100 relative">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-500 relative" 
                    style={{ width: `${mediumProgress}%` }}
                  ></div>
               </div>
               <span className="text-[10px] font-medium text-slate-500 w-8 text-right">{mediumProgress}%</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          {!sffData ? (
             <button 
               onClick={loadDemo}
               className="text-sm text-slate-600 hover:text-blue-600 font-medium px-4 py-2 transition-colors"
             >
               Load Demo Data
             </button>
          ) : (
             <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 mr-2 shadow-sm">
               <FileJson className="w-4 h-4 text-slate-400" />
               <span className="truncate max-w-[150px] font-medium">{sffData.fileName}</span>
             </div>
          )}
          
          <label className="flex items-center gap-2 px-3 py-2 bg-white text-slate-700 text-sm font-medium rounded-md border border-slate-300 hover:bg-slate-50 hover:border-slate-400 cursor-pointer transition-all shadow-sm">
            <Upload className="w-4 h-4" />
            <span>PDF</span>
            <input 
              type="file" 
              accept="application/pdf"
              className="hidden"
              onChange={handlePdfUpload}
            />
          </label>

          <label className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 cursor-pointer transition-all shadow-sm">
            <FileUp className="w-4 h-4" />
            <span>SFF</span>
            <input 
              type="file" 
              accept="application/json,.json"
              className="hidden"
              onChange={handleJsonUpload}
            />
          </label>

          {sffData && (
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200 relative">
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none hover:text-slate-900 group">
                <input 
                  type="checkbox" 
                  checked={cleanExport} 
                  onChange={(e) => setCleanExport(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="group-hover:text-blue-700 transition-colors">Clean Export</span>
              </label>
              
              <div className="group relative">
                <Info className="w-3.5 h-3.5 text-slate-400 cursor-help hover:text-blue-500 transition-colors" />
                <div className="absolute top-full mt-2 right-[-20px] w-48 bg-slate-800 text-white text-[10px] px-3 py-2 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none">
                  All alternatives are removed from the file
                  <div className="absolute bottom-full right-6 border-4 border-transparent border-b-slate-800"></div>
                </div>
              </div>

              <button 
                onClick={handleDownload}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border shadow-sm transition-all ml-2 ${
                  totalProgress === 100 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-700 shadow-emerald-200' 
                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300'
                }`}
              >
                {totalProgress === 100 ? <CheckCircle className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                <span>Export</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel: PDF Viewer */}
        <div className="w-1/2 min-w-[400px] h-full border-r border-slate-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-0">
          <PdfViewer 
            pdfUrl={pdfFile} 
            selectionContext={selectionContext}
          />
        </div>

        {/* Right Panel: Resolver Interface */}
        <div className="w-1/2 min-w-[400px] h-full overflow-y-auto bg-slate-50/50 relative">
          <div className="max-w-4xl mx-auto">
             {!sffData && pdfFile ? (
              <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-12 text-center">
                 <div className="relative mb-6 group">
                    <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl group-hover:blur-2xl transition-all"></div>
                    <div className="relative w-20 h-20 bg-white border border-slate-200 text-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <FileUp className="w-10 h-10" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                       <CheckCircle className="w-4 h-4" />
                    </div>
                 </div>
                 
                <h3 className="text-2xl font-bold text-slate-800 mb-2">PDF Document Ready</h3>
                <p className="text-slate-500 max-w-sm mb-8 leading-relaxed">
                  The source document has been loaded. Now, please upload the corresponding SFF JSON file to begin the validation workflow.
                </p>
                
                <label className="group relative px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium shadow-lg shadow-blue-200 cursor-pointer transition-all flex items-center gap-2 overflow-hidden">
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    <FileJson className="w-4 h-4" />
                    Upload SFF (JSON)
                    <input type="file" accept="application/json,.json" className="hidden" onChange={handleJsonUpload} />
                </label>
              </div>
            ) : (
              <ConflictResolver 
                data={sffData} 
                onUpdateField={handleUpdateField}
                onUpdateComment={handleUpdateComment}
                onHoverAlternative={setSelectionContext}
                onDeleteSection={handleDeleteSection}
                onDeleteField={handleDeleteField}
              />
            )}
          </div>
          
          {sffData && (
            <div className="sticky bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-3 text-center text-xs font-medium text-slate-500 shadow-lg">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
              Reviewing {sffData.fields.filter(f => !f.isResolved).length} pending fields requiring human attention.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;