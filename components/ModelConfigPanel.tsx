

import React, { useState, useRef } from 'react';
import { ModelProposal } from '../types';
import { TrashIcon, XMarkIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from './icons';
import CodeEditor from './CodeEditor';
import JSZip from 'jszip';

interface ModelConfigPanelProps {
  proposals: ModelProposal[];
  onChange: (proposals: ModelProposal[]) => void;
}

const DEFAULT_CODE_TEMPLATE = `from typing import Dict, List

def calculate_batches(context_size: int, file_sizes: Dict[str, int], overhead_tokens: int = 0) -> List[List[str]]:
    """
    Implement your algorithm here.
    Returns a list of batches (each batch is a list of file paths).
    """
    batches = []
    current_batch = []
    current_size = overhead_tokens # Account for overhead in empty batch
    
    for path, size in file_sizes.items():
        if current_size + size > context_size:
            batches.append(current_batch)
            current_batch = [path]
            current_size = size + overhead_tokens
        else:
            current_batch.append(path)
            current_size += size
    
    if current_batch:
        batches.append(current_batch)
        
    return batches
`;

const ModelConfigPanel: React.FC<ModelConfigPanelProps> = ({ proposals, onChange }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addProposal = () => {
    const newId = Math.random().toString(36).substring(7);
    onChange([
      ...proposals, 
      { 
        id: newId, 
        modelName: 'New Model', 
        algorithmName: 'My Algorithm', 
        code: DEFAULT_CODE_TEMPLATE, 
        active: true 
      }
    ]);
  };

  const updateProposal = (id: string, field: keyof ModelProposal, value: any) => {
    onChange(proposals.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeProposal = (id: string) => {
    // Directly remove without confirmation as requested previously
    onChange(proposals.filter(p => p.id !== id));
  };

  const activeProposal = proposals.find(p => p.id === editingId);

  // --- ZIP Functions ---

  const handleExportZip = async () => {
    if (proposals.length === 0) {
        alert("No proposals to export.");
        return;
    }

    const zip = new JSZip();

    // 1. Create a Manifest JSON
    const manifest = proposals.map(p => ({
        id: p.id,
        modelName: p.modelName,
        algorithmName: p.algorithmName,
        active: p.active
    }));
    zip.file("config.json", JSON.stringify(manifest, null, 2));

    // 2. Add individual Python files
    proposals.forEach(p => {
        zip.file(`${p.id}.py`, p.code);
    });

    try {
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = `benchmark_participants_${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Failed to generate zip", e);
        alert("Error generating zip file.");
    }
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const zip = await JSZip.loadAsync(file);
        
        // 1. Load config.json
        const configParams = await zip.file("config.json")?.async("string");
        if (!configParams) {
            alert("Invalid ZIP: Missing config.json");
            return;
        }

        const manifest = JSON.parse(configParams) as Omit<ModelProposal, 'code'>[];
        const newProposals: ModelProposal[] = [];

        // 2. Load Python files
        for (const item of manifest) {
            const codeFile = zip.file(`${item.id}.py`);
            if (codeFile) {
                const code = await codeFile.async("string");
                // Regenerate ID to avoid collisions if re-importing, or keep? 
                // Let's keep ID to allow restoring state exactly, but maybe safer to regen if we care about dupes.
                // For this use case, trusting the ZIP ID is fine, but we should check for duplicates in current list?
                // Let's just append.
                newProposals.push({
                    ...item,
                    code: code
                });
            }
        }

        if (newProposals.length > 0) {
            onChange([...proposals, ...newProposals]);
        } else {
            alert("No valid proposals found in ZIP.");
        }

    } catch (err) {
        console.error(err);
        alert("Failed to load ZIP file. Ensure it is a valid export.");
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };


  return (
    <div className="h-full flex flex-col bg-slate-900 overflow-hidden relative">
      <div className="flex-grow overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto w-full">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Benchmark Competition</h2>
              <p className="text-slate-400 mt-1">Add models and define their batching algorithms via Python code.</p>
            </div>
            
            <div className="flex items-center gap-2">
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImportZip} 
                    className="hidden" 
                    accept=".zip"
                 />
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-600 transition-colors"
                    title="Import ZIP"
                 >
                    <ArrowUpTrayIcon />
                 </button>
                 <button 
                    onClick={handleExportZip}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-600 transition-colors"
                    title="Export ZIP"
                 >
                    <ArrowDownTrayIcon />
                 </button>

                 <div className="w-px h-6 bg-slate-700 mx-1"></div>

                 <button 
                  onClick={addProposal}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md font-semibold transition-colors flex items-center justify-center gap-2"
                  title="Add Proposal"
                >
                  <span className="text-xl font-bold leading-none">+</span>
                </button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                  <th className="p-4 w-12 text-center">On</th>
                  <th className="p-4 w-1/4">Model Name</th>
                  <th className="p-4 w-1/4">Algorithm Name</th>
                  <th className="p-4">Implementation</th>
                  <th className="p-4 w-16 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {proposals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                      No proposals configured. Click "+" to start or upload a configuration ZIP.
                    </td>
                  </tr>
                ) : (
                  proposals.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="p-4 text-center">
                        <input 
                          type="checkbox" 
                          checked={p.active} 
                          onChange={(e) => updateProposal(p.id, 'active', e.target.checked)}
                          className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-4">
                        <input 
                          type="text" 
                          value={p.modelName}
                          onChange={(e) => updateProposal(p.id, 'modelName', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:border-cyan-500 outline-none"
                          placeholder="e.g. GPT-4o"
                        />
                      </td>
                      <td className="p-4">
                        <input 
                          type="text" 
                          value={p.algorithmName}
                          onChange={(e) => updateProposal(p.id, 'algorithmName', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-amber-400 font-mono text-sm focus:border-cyan-500 outline-none"
                          placeholder="e.g. Greedy v2"
                        />
                      </td>
                      <td className="p-4">
                        <button 
                            onClick={() => setEditingId(p.id)}
                            className="text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 text-cyan-400 rounded border border-slate-600 transition-colors font-mono"
                        >
                            {`def calculate_batches(...)`}
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          type="button"
                          onClick={() => removeProposal(p.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded hover:bg-slate-700"
                          title="Remove"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6 p-4 bg-sky-900/20 border border-sky-800 rounded-lg text-sm text-sky-200">
             <strong>How it works:</strong> Click the code button to implement <code>calculate_batches</code>. The system will create a dynamic Python module for each active proposal, run your function against the generated file set, and verify if it meets the constraints (Context limit, Coverage, Pairwise overlap).
          </div>
        </div>
      </div>

      {/* Code Editor Modal */}
      {editingId && activeProposal && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-8 backdrop-blur-sm animate-fade-in-up">
              <div className="bg-slate-800 w-full max-w-5xl h-full max-h-[90vh] rounded-lg shadow-2xl flex flex-col border border-slate-600 overflow-hidden min-h-0">
                  <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900 rounded-t-lg">
                      <div>
                          <h3 className="text-lg font-bold text-white">
                              Editing: <span className="text-cyan-400">{activeProposal.modelName}</span>
                          </h3>
                          <p className="text-xs text-slate-400">Function signature must be maintained.</p>
                      </div>
                      <button 
                        onClick={() => setEditingId(null)}
                        className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                      >
                          <XMarkIcon />
                      </button>
                  </div>
                  <div className="flex-grow relative bg-slate-900 overflow-hidden min-h-0">
                      <CodeEditor 
                        value={activeProposal.code}
                        onChange={(val) => updateProposal(activeProposal.id, 'code', val)}
                      />
                  </div>
                  <div className="p-4 border-t border-slate-700 bg-slate-900 rounded-b-lg flex justify-end">
                      <button 
                        onClick={() => setEditingId(null)}
                        className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold"
                      >
                          Done
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ModelConfigPanel;