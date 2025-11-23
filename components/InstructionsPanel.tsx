import React, { useState, useEffect, useMemo } from 'react';
import { Level } from '../types';
import { LightbulbIcon, KeyIcon } from './icons';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import DOMPurify from 'dompurify';

declare global {
  interface Window {
    hljs?: {
      highlightAll: () => void;
    };
  }
}

interface InstructionsPanelProps {
  level: Level;
  onShowSolution: () => void;
  isDocMode?: boolean;
}

const InstructionsPanel: React.FC<InstructionsPanelProps> = ({ level, onShowSolution, isDocMode = false }) => {
  const [shownHints, setShownHints] = useState<string[]>([]);

  // Reset hints when level changes
  useEffect(() => {
    setShownHints([]);
  }, [level.id]);
  
  // Trigger syntax highlighting for doc pages
  useEffect(() => {
    if (isDocMode && window.hljs) {
      // Use a timeout to ensure the DOM has been updated by React
      setTimeout(() => {
        window.hljs?.highlightAll();
      }, 0);
    }
  }, [level.description, isDocMode]);

  const handleShowHint = () => {
    if (level.hints && shownHints.length < level.hints.length) {
      setShownHints(level.hints.slice(0, shownHints.length + 1));
    }
  };

  const hasHelpers = !isDocMode && (level.hints?.length || level.solution);
  const nextHintIndex = shownHints.length;
  const allHintsShown = level.hints && nextHintIndex === level.hints.length;

  // Sanitize content to prevent XSS while allowing existing HTML structure and styles
  const sanitizedDescription = useMemo(() => {
      return DOMPurify.sanitize(level.description, {
          ADD_ATTR: ['class', 'target'], // Allow Tailwind classes
          USE_PROFILES: { html: true }
      });
  }, [level.description]);

  return (
    <div className="flex flex-col flex-grow bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      <div className="flex-grow p-4 lg:p-6 overflow-y-auto">
        <div className={`prose ${isDocMode ? 'prose-base lg:prose-lg' : 'prose-sm'} prose-invert max-w-none text-slate-300 [&_h4]:text-slate-100 [&_h4]:font-semibold [&_h4]:mb-4 [&_p]:mb-6 [&_img]:rounded-lg [&_img]:shadow-md [&_img]:my-6 [&_pre]:bg-[#0d1117] [&_pre]:border [&_pre]:border-slate-700 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:my-6 [&_pre_code]:bg-transparent [&_code:not(pre_>_code)]:text-amber-400 [&_code:not(pre_>_code)]:font-semibold [&_code:not(pre_>_code)]:bg-transparent [&_code:not(pre_>_code)]:p-0`}>
           <Markdown rehypePlugins={[rehypeRaw]}>
             {sanitizedDescription}
           </Markdown>
        </div>
      </div>
      
      {hasHelpers && (
        <div className="flex-shrink-0 border-t border-slate-700 p-4">
          <h5 className="text-sm font-semibold text-slate-400 mb-3">Stuck? Get some help.</h5>
          {shownHints.length > 0 && (
              <div className="space-y-2 mb-4">
                  {shownHints.map((hint, index) => (
                      <p key={index} className="text-xs text-slate-300 animate-fade-in-up">
                          <strong className="text-cyan-400">Hint {index + 1}:</strong> {hint}
                      </p>
                  ))}
              </div>
          )}
          <div className="flex gap-2">
            {level.hints && level.hints.length > 0 && (
              <button
                onClick={handleShowHint}
                disabled={allHintsShown}
                className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-semibold text-white bg-sky-600 rounded-md hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
              >
                <LightbulbIcon />
                {allHintsShown ? 'All hints shown' : 'I need a hint'}
              </button>
            )}
            {level.solution && (
              <button
                onClick={onShowSolution}
                className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-semibold text-white bg-amber-600 rounded-md hover:bg-amber-500 disabled:bg-slate-600 transition-colors duration-200"
              >
                <KeyIcon />
                Show Solution
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructionsPanel;