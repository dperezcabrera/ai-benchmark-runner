
import React from 'react';
import { CheckCircleIcon } from './icons';

interface LevelNavigatorProps {
  currentLevelTitle: string;
  isCompleted: boolean;
}

const LevelNavigator: React.FC<LevelNavigatorProps> = ({ 
  currentLevelTitle, 
  isCompleted
}) => {
  return (
    <div className="flex items-center justify-center p-2 rounded-lg bg-slate-800 border border-slate-700">
      <div className="flex items-center gap-2 px-2" >
        <div className="text-center" title={currentLevelTitle}>
            <h2 className="text-lg font-bold text-cyan-400 truncate">
                {currentLevelTitle}
            </h2>
        </div>
        {isCompleted && (
          <span className="text-green-400" title="Completed!">
            <CheckCircleIcon />
          </span>
        )}
      </div>
    </div>
  );
};

export default LevelNavigator;
