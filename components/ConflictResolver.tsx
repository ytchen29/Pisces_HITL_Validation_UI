import React, { useState } from 'react';
import { 
  Check, 
  AlertTriangle, 
  HelpCircle, 
  CheckCircle2, 
  Bot, 
  User, 
  ChevronDown, 
  ChevronUp,
  MapPin,
  Pencil,
  X,
  Save,
  FileText
} from 'lucide-react';
import { SFFData, SFFField, SelectionContext } from '../types';

interface ConflictResolverProps {
  data: SFFData | null;
  onUpdateField: (fieldId: string, newValue: any, isResolved: boolean) => void;
  onHoverAlternative: (context: SelectionContext | null) => void;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({ 
  data, 
  onUpdateField,
  onHoverAlternative
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (!data) return <div className="p-8 text-center text-slate-400">Waiting for data extraction...</div>;

  const sections = data.fields.reduce((acc, field) => {
    const sectionName = field.section || "General";
    if (!acc[sectionName]) acc[sectionName] = [];
    acc[sectionName].push(field);
    return acc;
  }, {} as Record<string, SFFField[]>);

  return (
    <div className="p-6 pb-24 space-y-8">
      {(Object.entries(sections) as [string, SFFField[]][]).map(([sectionName, fields]) => (
        <div key={sectionName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div 
            className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => setActiveSection(activeSection === sectionName ? null : sectionName)}
          >
            <h3 className="font-semibold text-slate-800">{sectionName}</h3>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {fields.some(f => f.confidence === 'Low' && !f.isResolved) && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-700">Needs Review</span>
                )}
              </div>
              {activeSection === sectionName ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </div>

          {(activeSection === sectionName || (Object.keys(sections).length === 1)) && (
            <div className="divide-y divide-slate-100">
               {fields.map((field) => (
                <FieldRow 
                  key={field.id} 
                  field={field} 
                  onUpdate={onUpdateField}
                  onHoverAlternative={onHoverAlternative}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const FieldRow: React.FC<{
  field: SFFField;
  onUpdate: (id: string, val: any, resolved: boolean) => void;
  onHoverAlternative: (ctx: SelectionContext | null) => void;
}> = ({ field, onUpdate, onHoverAlternative }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(
    typeof field.value === 'object' ? JSON.stringify(field.value) : String(field.value || '')
  );

  const isConflict = field.confidence !== 'High';
  const statusColor = field.isResolved 
    ? 'border-l-4 border-l-emerald-500 bg-slate-50/50' 
    : isConflict 
      ? 'border-l-4 border-l-rose-500 bg-white'
      : 'border-l-4 border-l-emerald-500 bg-white';

  const renderValue = (val: any) => {
    if (val === null || val === undefined) return <span className="text-slate-400 italic">null</span>;
    if (Array.isArray(val)) return val.join(", ");
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const handleManualSave = () => {
    // Try parse if looks like number or json, else string
    let finalVal: any = editValue;
    if (!isNaN(Number(editValue)) && editValue.trim() !== '') {
        finalVal = Number(editValue);
    } else if (editValue.startsWith('{') || editValue.startsWith('[')) {
        try { finalVal = JSON.parse(editValue); } catch(e) {}
    }
    
    onUpdate(field.id, finalVal, true);
    setIsEditing(false);
  };

  return (
    <div className={`p-4 transition-all ${statusColor}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="max-w-[70%]">
          <div className="flex flex-wrap items-center gap-1 text-xs text-slate-400 mb-1">
             {field.key.split('.').map((part, i, arr) => (
                <React.Fragment key={i}>
                  <span className={i === arr.length - 1 ? "font-medium text-slate-500 uppercase tracking-wide" : ""}>{part}</span>
                  {i < arr.length - 1 && <span className="text-slate-300">›</span>}
                </React.Fragment>
             ))}
          </div>
          <span className="text-sm font-semibold text-slate-800">{field.label}</span>
        </div>

        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border whitespace-nowrap ${
          field.confidence === 'Low' ? 'bg-rose-50 border-rose-100 text-rose-700' : 
          field.confidence === 'Medium' ? 'bg-amber-50 border-amber-100 text-amber-700' :
          'bg-emerald-50 border-emerald-100 text-emerald-700'
        }`}>
          {field.confidence === 'Low' && <AlertTriangle className="w-3 h-3" />}
          {field.confidence === 'Medium' && <HelpCircle className="w-3 h-3" />}
          {field.confidence === 'High' && <CheckCircle2 className="w-3 h-3" />}
          <span>{field.confidence}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
           {isEditing ? (
             <div className="mt-2 bg-white border border-blue-300 rounded-lg p-3 shadow-sm ring-2 ring-blue-100">
               <label className="block text-xs font-semibold text-blue-600 mb-1">Manual Edit</label>
               <input 
                 type="text" 
                 value={editValue}
                 onChange={(e) => setEditValue(e.target.value)}
                 className="w-full p-2 border border-slate-300 rounded mb-2 font-mono text-sm focus:outline-none focus:border-blue-500"
               />
               <div className="flex justify-end gap-2">
                 <button onClick={() => setIsEditing(false)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200">
                   <X className="w-3 h-3" /> Cancel
                 </button>
                 <button onClick={handleManualSave} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700">
                   <Save className="w-3 h-3" /> Save Value
                 </button>
               </div>
             </div>
           ) : (
             <>
               {/* Display Current Value (Hoverable for context) */}
               <div 
                  className="group"
                  onMouseEnter={() => {
                    if (field.source) {
                      onHoverAlternative({
                        fieldId: field.id,
                        page: field.source.page || 1,
                        snippet: field.source.snippet || "",
                        location: field.source.location,
                        type: field.source.type,
                        agent: "Current Value"
                      });
                    }
                  }}
                  onMouseLeave={() => onHoverAlternative(null)}
               >
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-md text-slate-800 font-mono text-sm border flex-1 break-words transition-colors cursor-pointer ${
                      isConflict && !field.isResolved ? 'bg-amber-50 border-amber-200' : 'bg-slate-100 border-slate-200'
                    }`}>
                      {renderValue(field.value)}
                    </div>
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                      title="Edit manually"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Source Indicator for Current Value */}
                  {field.source && (
                    <div className="mt-1 ml-1 flex items-center gap-2 text-[10px] text-slate-400 group-hover:text-blue-600 transition-colors">
                      <FileText className="w-3 h-3" />
                      <span className="font-medium">Source:</span>
                      <span className="truncate max-w-xs">{field.source.location || `Page ${field.source.page}`}</span>
                    </div>
                  )}
               </div>
               
               {/* Alternatives Section (Only if conflict) */}
               {(isConflict) && (
                 <div className="space-y-3 mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                   <div className="text-xs text-slate-500 italic flex items-center gap-2">
                     <div className="h-px bg-slate-200 flex-1"></div>
                     <span>Review Alternatives</span>
                     <div className="h-px bg-slate-200 flex-1"></div>
                   </div>
                   
                   <div className="grid gap-3">
                     {field.alternatives && field.alternatives.length > 0 ? (
                       field.alternatives.map((alt, idx) => (
                       <label 
                        key={idx}
                        className={`relative flex items-start p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                          JSON.stringify(field.value) === JSON.stringify(alt.value) 
                            ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' 
                            : 'border-slate-200 hover:border-blue-300'
                        }`}
                        onMouseEnter={() => {
                          if (alt.source) {
                            onHoverAlternative({
                              fieldId: field.id,
                              page: alt.source.page || 1,
                              snippet: alt.source.snippet || "",
                              location: alt.source.location,
                              type: alt.source.type,
                              agent: alt.agentName || "Unknown Agent"
                            });
                          }
                        }}
                        onClick={() => {
                           // Set context permanently on click? Or just update.
                           // For now, update value.
                           if (alt.source) {
                             onHoverAlternative({
                              fieldId: field.id,
                              page: alt.source.page || 1,
                              snippet: alt.source.snippet || "",
                              location: alt.source.location,
                              type: alt.source.type,
                              agent: alt.agentName || "Unknown Agent"
                            });
                           }
                          onUpdate(field.id, alt.value, true);
                        }}
                        onMouseLeave={() => onHoverAlternative(null)}
                       >
                         <input 
                            type="radio" 
                            name={`field-${field.id}`}
                            className="sr-only"
                            checked={JSON.stringify(field.value) === JSON.stringify(alt.value)}
                            readOnly 
                         />
                         <div className="flex-1 min-w-0">
                           <div className="flex justify-between items-start mb-1">
                             <div className="flex items-center gap-2">
                               <Bot className="w-3 h-3 text-slate-400" />
                               <span className="text-xs font-bold text-slate-700">{alt.agentName}</span>
                             </div>
                             {alt.source && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    {alt.source.page ? `Page ${alt.source.page}` : "Unknown Loc"}
                                </div>
                             )}
                           </div>
                           <div className="font-mono text-sm font-medium text-slate-800 break-words">
                             {renderValue(alt.value)}
                           </div>
                           {alt.source?.location && (
                               <div className="mt-1 text-[10px] text-slate-400 truncate max-w-xs">
                                   {alt.source.location}
                               </div>
                           )}
                         </div>
                         <div className={`w-5 h-5 rounded-full border ml-3 mt-0.5 flex-shrink-0 flex items-center justify-center ${
                           JSON.stringify(field.value) === JSON.stringify(alt.value) 
                            ? 'bg-blue-500 border-blue-500' 
                            : 'border-slate-300'
                         }`}>
                           {JSON.stringify(field.value) === JSON.stringify(alt.value) && (
                             <Check className="w-3 h-3 text-white" />
                           )}
                         </div>
                       </label>
                     ))
                     ) : (
                       <div className="text-xs text-slate-400 italic p-3 text-center border border-dashed rounded bg-slate-50">
                         No alternatives provided by agents.
                       </div>
                     )}
                   </div>
                   
                   <div className="pt-2 text-center">
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        <User className="w-3 h-3" />
                        <span>Enter value manually...</span>
                      </button>
                   </div>
                 </div>
               )}
             </>
           )}
        </div>
      </div>
    </div>
  );
};