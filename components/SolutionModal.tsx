import React, { useMemo } from 'react';
import { XMarkIcon } from './icons';
import TabbedCodeEditor from './TabbedCodeEditor';
import { Level, LevelFile } from '../types';

interface SolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  level: Level;
}

const SolutionModal: React.FC<SolutionModalProps> = ({ isOpen, onClose, level }) => {
  const solutionFiles = useMemo(() => {
    if (!level.solution) return level.files;
    
    // Create a new set of files, overriding content with the solution where available
    return level.files.map((file): LevelFile => ({
        ...file,
        content: level.solution?.[file.name] ?? file.content,
    }));
  }, [level]);

  if (!isOpen) {
    return null;
  }
  
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
          onClose();
      }
  };

  return (
    <div 
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
    >
      <div className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] border border-slate-700 relative animate-fade-in-up flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">Solution for: <span className="text-cyan-400">{level.title}</span></h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
            <XMarkIcon />
          </button>
        </div>
        
        <div className="p-4 flex-grow min-h-0">
            <p className="text-sm text-slate-300 mb-4">This is the complete solution for this level. The editor is read-only.</p>
            <div className="h-[calc(100%-40px)]">
                <TabbedCodeEditor 
                    files={solutionFiles}
                    onFilesChange={() => {}} // No-op as it's read-only
                    isReadOnly
                />
            </div>
        </div>
      </div>
    </div>
  );
};

export default SolutionModal;
