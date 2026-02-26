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
  Trash2,
  MessageSquare,
  ShieldCheck,
  History,
  Search,
  Info,
  BarChart3
} from 'lucide-react';
import { SFFData, SFFField, SelectionContext, ReviewerComment, SourceReference } from '../types';

interface ConflictResolverProps {
  data: SFFData | null;
  reviewerId: string;
  onUpdateField: (fieldId: string, newValue: any, isResolved: boolean) => void;
  onUpdateComment: (fieldId: string, comment: string) => void;
  onHoverAlternative: (context: SelectionContext | null) => void;
  onDeleteSection: (sectionName: string) => void;
  onDeleteField: (fieldId: string) => void;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({ 
  data, 
  reviewerId,
  onUpdateField,
  onUpdateComment,
  onHoverAlternative,
  onDeleteSection,
  onDeleteField
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (!data) return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Load SFF to Begin Validation</div>;

  const lowFields = data.fields.filter(f => f.confidence === 'Low');
  const medFields = data.fields.filter(f => f.confidence === 'Medium');
  const lowResolved = lowFields.filter(f => f.isResolved).length;
  const medResolved = medFields.filter(f => f.isResolved).length;
  const lowPercent = lowFields.length ? Math.round((lowResolved / lowFields.length) * 100) : 100;
  const medPercent = medFields.length ? Math.round((medResolved / medFields.length) * 100) : 100;

  const sections = data.fields.reduce((acc, field) => {
    const sectionName = field.section || "General";
    if (!acc[sectionName]) acc[sectionName] = [];
    acc[sectionName].push(field);
    return acc;
  }, {} as Record<string, SFFField[]>);

  return (
    <div className="p-6 pb-24 space-y-6">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-5 sticky top-4 z-20 backdrop-blur-lg bg-white/90">
        <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em]">Validation Status</h3>
        </div>
        <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-rose-600">
                    <span>Low Confidence</span>
                    <span className="font-mono">{lowResolved}/{lowFields.length}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 transition-all duration-700" style={{ width: `${lowPercent}%` }} />
                </div>
            </div>
            <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-amber-600">
                    <span>Med Confidence</span>
                    <span className="font-mono">{medResolved}/{medFields.length}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 transition-all duration-700" style={{ width: `${medPercent}%` }} />
                </div>
            </div>
        </div>
      </div>

      {(Object.entries(sections) as [string, SFFField[]][]).map(([sectionName, fields]) => {
        const unresolvedLow = fields.filter(f => f.confidence === 'Low' && !f.isResolved).length;
        const unresolvedMed = fields.filter(f => f.confidence === 'Medium' && !f.isResolved).length;

        return (
          <div key={sectionName} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div 
              className="bg-slate-50/80 px-5 py-3 border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-all"
              onClick={() => setActiveSection(activeSection === sectionName ? null : sectionName)}
            >
              <div className="flex items-center gap-3">
                <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-800">{sectionName}</h3>
                <div className="flex items-center gap-1.5">
                  {unresolvedLow > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[8px] font-black uppercase flex items-center gap-1 border border-rose-200">
                      <AlertTriangle className="w-2.5 h-2.5" /> {unresolvedLow} Low
                    </span>
                  )}
                  {unresolvedMed > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[8px] font-black uppercase flex items-center gap-1 border border-amber-200">
                      <HelpCircle className="w-2.5 h-2.5" /> {unresolvedMed} Med
                    </span>
                  )}
                  {unresolvedLow === 0 && unresolvedMed === 0 && fields.some(f => f.isResolved) && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase flex items-center gap-1 border border-emerald-200">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Clear
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                 {activeSection === sectionName ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {(activeSection === sectionName || (Object.keys(sections).length === 1)) && (
              <div className="divide-y divide-slate-50">
                 {fields.map((field) => (
                  <FieldRow 
                    key={field.id} 
                    field={field} 
                    currentReviewer={reviewerId}
                    onUpdate={onUpdateField}
                    onUpdateComment={onUpdateComment}
                    onHoverAlternative={onHoverAlternative}
                    onDelete={onDeleteField}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const SourceContextBox: React.FC<{ source: SourceReference; agentName: string }> = ({ source, agentName }) => (
    <div className="mt-4 bg-slate-900 text-slate-100 rounded-xl p-5 shadow-2xl border-l-[6px] border-blue-500 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Match Context: Page {source.page}</span>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-500 uppercase font-black">{source.type || 'TEXT'}</span>
        </div>
        <p className="text-sm font-serif italic leading-relaxed text-slate-300 border-l-2 border-slate-700 pl-4 py-1 mb-4">
            "...{source.snippet}..."
        </p>
        <div className="flex items-center gap-4 text-[10px] text-slate-500 border-t border-slate-800 pt-3">
            <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-600" />
                <span className="font-bold">{source.location || `Page ${source.page}`}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-600" />
                <span className="uppercase tracking-tight">Source Agent: </span>
                <span className="text-white font-black">{agentName}</span>
            </div>
        </div>
    </div>
);

const FieldRow: React.FC<{
  field: SFFField;
  currentReviewer: string;
  onUpdate: (id: string, val: any, resolved: boolean) => void;
  onUpdateComment: (id: string, comment: string) => void;
  onHoverAlternative: (ctx: SelectionContext | null) => void;
  onDelete: (id: string) => void;
}> = ({ field, currentReviewer, onUpdate, onUpdateComment, onHoverAlternative, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [showSourceInfo, setShowSourceInfo] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(typeof field.value === 'object' ? JSON.stringify(field.value) : String(field.value ?? ''));

  const isConflict = field.confidence !== 'High';
  const statusBorder = field.isResolved ? 'border-l-4 border-l-emerald-500 bg-white/50' : isConflict ? 'border-l-4 border-l-rose-500 bg-white' : 'border-l-4 border-l-emerald-500 bg-white';

  const renderValue = (val: any) => {
    if (val === null || val === undefined) return <span className="text-slate-300 italic">null</span>;
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const currentComment = field.comments.find(c => c.reviewer === currentReviewer)?.text || "";

  const handleManualSave = () => {
    let finalVal: any = editValue;
    if (!isNaN(Number(editValue)) && editValue.trim() !== '') finalVal = Number(editValue);
    else if (editValue.startsWith('{') || editValue.startsWith('[')) { try { finalVal = JSON.parse(editValue); } catch(e) {} }
    onUpdate(field.id, finalVal, true);
    setIsEditing(false);
  };

  const triggerHover = (val: any, src?: SourceReference) => {
    if (src) {
        onHoverAlternative({ 
            fieldId: field.id, 
            page: src.page, 
            snippet: src.snippet, 
            value: val, 
            location: src.location, 
            type: src.type, 
            agent: "Source Evidence" 
        });
    }
  };

  return (
    <div className={`p-5 transition-all group/row ${statusBorder}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">
             {field.key.split('.').map((p, i, arr) => (
                <React.Fragment key={i}>
                  <span className={i === arr.length - 1 ? "text-slate-500 font-black" : ""}>{p}</span>
                  {i < arr.length - 1 && <span className="opacity-30">/</span>}
                </React.Fragment>
             ))}
          </div>
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-black text-slate-800 tracking-tight">{field.label}</h4>
            <div className="flex gap-1">
                {field.reviewedBy.map((rev, i) => (
                    <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[8px] font-black border border-emerald-100 uppercase">
                        <ShieldCheck className="w-2.5 h-2.5" /> <span>{rev}</span>
                    </div>
                ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest ${
               field.confidence === 'Low' ? 'bg-rose-50 border-rose-100 text-rose-600' : 
               field.confidence === 'Medium' ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
           }`}>
             {field.confidence === 'Low' ? <AlertTriangle className="w-3 h-3" /> : field.confidence === 'Medium' ? <HelpCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
             {field.confidence}
           </div>
           <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
              <button onClick={() => setShowCommentBox(!showCommentBox)} className={`p-1.5 rounded-lg transition-all ${field.comments.length > 0 ? 'bg-amber-100 text-amber-600' : 'text-slate-300 hover:text-blue-600 hover:bg-blue-50'}`}><MessageSquare className="w-4 h-4" /></button>
              <button onClick={() => onDelete(field.id)} className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
           </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isEditing ? (
            <div className="flex-1 bg-white border-2 border-blue-500 p-4 rounded-xl shadow-2xl animate-in fade-in zoom-in-95">
                <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono mb-3 outline-none focus:bg-white focus:ring-2 focus:ring-blue-100" />
                <div className="flex justify-end gap-2">
                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                    <button onClick={handleManualSave} className="px-4 py-2 text-[10px] font-black uppercase bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-500/30">Commit</button>
                </div>
            </div>
        ) : (
            <>
                <div 
                    className="flex-1 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-400 hover:shadow-md transition-all cursor-pointer font-mono text-sm text-slate-800 break-all relative group/value"
                    onMouseEnter={() => triggerHover(field.value, field.source)}
                    onMouseLeave={() => onHoverAlternative(null)}
                    onClick={() => field.source && setShowSourceInfo(showSourceInfo === 'current' ? null : 'current')}
                >
                    {renderValue(field.value)}
                </div>
                <div className="flex flex-col gap-1.5">
                    <button onClick={() => setIsEditing(true)} className="p-2.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-xl transition-all shadow-sm hover:shadow-md"><Pencil className="w-4 h-4" /></button>
                    {field.source && (
                        <button 
                            onClick={() => setShowSourceInfo(showSourceInfo === 'current' ? null : 'current')}
                            onMouseEnter={() => triggerHover(field.value, field.source)}
                            className={`p-2.5 rounded-xl transition-all border shadow-sm ${showSourceInfo === 'current' ? 'bg-blue-600 text-white border-blue-700 shadow-blue-500/40' : 'bg-white text-blue-500 border-blue-100 hover:bg-blue-50'}`}
                        >
                            <Search className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </>
        )}
      </div>

      {showSourceInfo === 'current' && field.source && <SourceContextBox source={field.source} agentName="Consensus Output" />}

      {(showCommentBox || field.comments.length > 0) && (
        <div className="mt-5 p-5 bg-amber-50 rounded-2xl border border-amber-100 space-y-4">
            {field.comments.length > 0 && (
                <div className="space-y-2.5">
                    <h5 className="flex items-center gap-2 text-[9px] font-black text-amber-700 uppercase tracking-widest"><History className="w-3 h-3" /> Note History</h5>
                    {field.comments.map((c, i) => (
                        <div key={i} className="bg-white/80 p-3 rounded-xl border border-amber-200/40 text-xs shadow-sm">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="font-black text-slate-800 tracking-tight">{c.reviewer.toUpperCase()}</span>
                                {c.reviewer === currentReviewer && <span className="text-[8px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-black">YOUR NOTE</span>}
                            </div>
                            <p className="text-slate-600 italic">"{c.text}"</p>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex gap-3 pt-3 border-t border-amber-200/50">
                <MessageSquare className="w-5 h-5 text-amber-400 mt-1" />
                <div className="flex-1">
                    <textarea value={currentComment} onChange={e => onUpdateComment(field.id, e.target.value)} placeholder="Type observations..." className="w-full bg-white border border-amber-200 rounded-xl p-3.5 text-sm focus:ring-2 focus:ring-amber-400 outline-none min-h-[80px] shadow-inner" />
                </div>
            </div>
        </div>
      )}

      {isConflict && (
        <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
             <div className="flex items-center gap-3">
                 <div className="h-px bg-slate-100 flex-1" />
                 <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Agent Proposals</span>
                 <div className="h-px bg-slate-100 flex-1" />
             </div>
             <div className="grid gap-3">
                {field.alternatives.map((alt, i) => {
                    const isSelected = JSON.stringify(field.value) === JSON.stringify(alt.value);
                    const altKey = `alt-${i}`;
                    return (
                        <div key={i} className="space-y-2">
                            <div 
                                className={`flex items-center p-4 border rounded-2xl cursor-pointer transition-all hover:shadow-lg ${isSelected ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/10' : 'border-slate-100 bg-white hover:border-blue-200'}`}
                                onClick={() => onUpdate(field.id, alt.value, true)}
                                onMouseEnter={() => triggerHover(alt.value, alt.source)}
                                onMouseLeave={() => onHoverAlternative(null)}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-2.5">
                                        <div className="flex items-center gap-1.5">
                                            <Bot className="w-3.5 h-3.5 text-blue-400" />
                                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-tight">{alt.agentName}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={e => { e.stopPropagation(); setShowSourceInfo(showSourceInfo === altKey ? null : altKey); }} onMouseEnter={() => triggerHover(alt.value, alt.source)} className={`p-1.5 rounded-lg transition-all ${showSourceInfo === altKey ? 'bg-blue-600 text-white shadow-md shadow-blue-500/40' : 'bg-slate-50 text-slate-400 hover:text-blue-600'}`}>
                                                <Search className="w-3.5 h-3.5" />
                                            </button>
                                            <span className="text-[9px] font-black bg-slate-100 px-2.5 py-1 rounded-full text-slate-500 uppercase">P.{alt.source.page}</span>
                                        </div>
                                    </div>
                                    <div className="font-mono text-sm font-black text-slate-900 break-all">{renderValue(alt.value)}</div>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 ml-4 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-500/40' : 'border-slate-100'}`}>
                                    {isSelected && <Check className="w-4 h-4 text-white" />}
                                </div>
                            </div>
                            {showSourceInfo === altKey && <SourceContextBox source={alt.source} agentName={alt.agentName} />}
                        </div>
                    );
                })}
             </div>
        </div>
      )}
    </div>
  );
};
