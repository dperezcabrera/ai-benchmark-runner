
import React, { useState, useEffect } from 'react';
import CodeEditor from './CodeEditor';
import { BenchmarkFile } from '../types';

interface TabbedCodeEditorProps {
  files: BenchmarkFile[];
  onFilesChange: (files: BenchmarkFile[]) => void;
  isReadOnly?: boolean;
}

const TabbedCodeEditor: React.FC<TabbedCodeEditorProps> = ({ files, onFilesChange, isReadOnly = false }) => {
  const [activeTabName, setActiveTabName] = useState<string>(files[0]?.name);

  useEffect(() => {
    // Ensure active tab exists
    if (!files.some(f => f.name === activeTabName)) {
        setActiveTabName(files[0]?.name);
    }
  }, [files, activeTabName]);

  const handleFileContentChange = (newContent: string) => {
    if (isReadOnly) return;
    const updatedFiles = files.map((file) => 
      file.name === activeTabName ? { ...file, content: newContent } : file
    );
    onFilesChange(updatedFiles);
  };

  const activeFile = files.find(f => f.name === activeTabName);

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="flex-shrink-0 flex items-center bg-slate-800 overflow-x-auto custom-scrollbar">
        {files.map((file) => (
          <button
            key={file.name}
            onClick={() => setActiveTabName(file.name)}
            className={`px-4 py-2 text-sm font-medium border-r border-slate-700 whitespace-nowrap
              ${activeTabName === file.name
                ? 'text-cyan-400 bg-slate-900 border-t-2 border-t-cyan-400'
                : 'text-slate-400 bg-slate-800 hover:text-white hover:bg-slate-700 border-t-2 border-t-transparent'
              }
            `}
          >
            {file.name}
          </button>
        ))}
      </div>
      <div className="flex-grow min-h-0 relative">
        {activeFile ? (
          <CodeEditor
            value={activeFile.content}
            onChange={handleFileContentChange}
            isReadOnly={isReadOnly || activeFile.readOnly}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500">
            No file selected.
          </div>
        )}
      </div>
    </div>
  );
};

export default TabbedCodeEditor;
