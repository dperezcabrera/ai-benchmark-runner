
import React, { useState } from 'react';
import { SpinnerIcon, XMarkIcon } from './icons';

interface PresetCourse {
  name: string;
  url: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadCourse: (url: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  presets?: PresetCourse[];
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onLoadCourse, isLoading, error, presets = [] }) => {
  const [url, setUrl] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleLoadClick = () => {
    if (url.trim()) {
      onLoadCourse(url.trim());
    }
  };

  const handlePresetClick = (presetUrl: string) => {
    setUrl(presetUrl);
    onLoadCourse(presetUrl);
  };
  
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
      <div className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-lg border border-slate-700 relative animate-fade-in-up">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Load Course</h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
            <XMarkIcon />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label htmlFor="course-url" className="block text-sm font-medium text-slate-300 mb-2">
              Load from URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="course-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/course.json"
                className="flex-grow bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                disabled={isLoading}
              />
              <button
                onClick={handleLoadClick}
                disabled={!url.trim() || isLoading}
                className="flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-cyan-600 rounded-md shadow-lg w-32 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading ? <SpinnerIcon /> : 'Load'}
              </button>
            </div>
          </div>

          {presets.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">
                Or select a preset course
              </h3>
              <div className="space-y-2">
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handlePresetClick(preset.url)}
                    disabled={isLoading || !preset.url}
                    className="w-full text-left p-3 bg-slate-700/50 rounded-md hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <p className={`font-semibold ${!preset.url ? 'text-slate-400' : 'text-cyan-400'}`}>{preset.name}</p>
                    {preset.url && (
                        <p className="text-xs text-slate-400">{preset.url}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm p-3 rounded-md">
                <p><strong>Error:</strong> {error}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;