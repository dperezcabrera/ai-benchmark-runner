
import React, { useState } from 'react';
import { RunResultDetail } from '../types';
import { CheckCircleIcon, XMarkIcon, SpinnerIcon } from './icons';

interface RankingTableProps {
  results: RunResultDetail[];
  wave?: number;
  runningModelName?: string | null;
}

const RankingTable: React.FC<RankingTableProps> = ({ results, wave = 0, runningModelName }) => {
  const [sortField, setSortField] = useState<keyof RunResultDetail>('score');
  const [sortAsc, setSortAsc] = useState(true); // Default Ascending for Tokens (Cost)

  const sortedResults = [...results].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    
    // Always put failures at the bottom
    if (!a.verified && b.verified) return 1;
    if (a.verified && !b.verified) return -1;

    if (valA === undefined || valB === undefined) return 0;
    
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleHeaderClick = (field: keyof RunResultDetail) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      // For time, batches, and score (tokens), lower is better -> Ascending default
      setSortAsc(field === 'time' || field === 'batches' || field === 'score');
    }
  };

  const SortIcon = ({ field }: { field: keyof RunResultDetail }) => {
    if (sortField !== field) return <span className="text-slate-700 ml-1 opacity-0 group-hover:opacity-50">↕</span>;
    return <span className="text-cyan-400 ml-1">{sortAsc ? '↑' : '↓'}</span>;
  };

  if (results.length === 0 && !runningModelName) {
      return (
          <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500 bg-slate-800/30 rounded-lg border-2 border-dashed border-slate-700">
              <div className="text-4xl mb-4">🏆</div>
              <p className="text-xl font-medium text-slate-400">No benchmark results yet.</p>
              <p className="text-sm mt-2">Press Play to start the competition.</p>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg border border-slate-700 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <h2 className="font-bold text-white text-xl tracking-tight">🏆 Benchmark Leaderboard</h2>
                {wave > 0 && (
                    <span className="bg-cyan-900/50 text-cyan-300 text-xs px-2 py-1 rounded-full font-mono border border-cyan-800">
                        Rounds: {wave}
                    </span>
                )}
            </div>
            <div className="text-sm text-slate-400">
                Sorted by <span className="text-cyan-400 font-semibold uppercase">{sortField === 'score' ? 'TOKENS' : sortField}</span>
            </div>
        </div>
        <div className="flex-grow overflow-auto">
            <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-900 z-10 shadow-md">
                    <tr className="text-slate-400 text-sm uppercase tracking-wider font-semibold">
                        <th className="p-4 w-16 text-center">Rank</th>
                        <th className="p-4 cursor-pointer hover:text-white group transition-colors" onClick={() => handleHeaderClick('model')}>
                            Model / Algo <SortIcon field="model" />
                        </th>
                        <th className="p-4 cursor-pointer hover:text-white group transition-colors text-right" onClick={() => handleHeaderClick('score')}>
                            Total Tokens <SortIcon field="score" />
                        </th>
                         <th className="p-4 text-center cursor-pointer hover:text-white group transition-colors" onClick={() => handleHeaderClick('completedWaves')}>
                            Rounds <SortIcon field="completedWaves" />
                        </th>
                        <th className="p-4 text-right cursor-pointer hover:text-white group transition-colors" onClick={() => handleHeaderClick('batches')}>
                            Total Batches <SortIcon field="batches" />
                        </th>
                        <th className="p-4 text-right cursor-pointer hover:text-white group transition-colors" onClick={() => handleHeaderClick('time')}>
                            Total Time (s) <SortIcon field="time" />
                        </th>
                        <th className="p-4 text-center w-24">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                    {sortedResults.map((row, idx) => {
                        const isRunning = row.name === runningModelName;
                        return (
                        <tr key={idx} className={`group hover:bg-slate-800/60 transition-colors ${!row.verified && !isRunning ? 'bg-red-900/10' : ''}`}>
                            <td className="p-4 text-center">
                                <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold mx-auto ${
                                    idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 
                                    idx === 1 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/50' : 
                                    idx === 2 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/50' : 
                                    'text-slate-500'
                                }`}>
                                    {idx + 1}
                                </div>
                            </td>
                            <td className="p-4">
                                <div className="font-bold text-white text-lg">{row.model}</div>
                                <div className="text-sm text-cyan-400 font-mono mt-0.5">{row.algorithm}</div>
                            </td>
                            <td className="p-4 text-right font-bold text-2xl text-amber-400 tabular-nums">
                                {row.score.toLocaleString()}
                            </td>
                             <td className="p-4 text-center font-mono text-cyan-400 text-lg tabular-nums font-bold">
                                {row.completedWaves}
                            </td>
                            <td className="p-4 text-right font-mono text-slate-300 text-lg tabular-nums">
                                {row.batches}
                            </td>
                            <td className="p-4 text-right font-mono text-slate-300 text-lg tabular-nums">
                                {row.time.toFixed(2)}
                            </td>
                            <td className="p-4 text-center">
                                {isRunning ? (
                                    <div className="flex flex-col items-center justify-center text-cyan-400">
                                        <div className="animate-spin text-cyan-400 mb-1">
                                            <SpinnerIcon />
                                        </div>
                                        <span className="text-[10px] uppercase font-bold tracking-wider">Running</span>
                                    </div>
                                ) : row.verified ? (
                                    <div className="flex flex-col items-center justify-center text-green-400">
                                        <CheckCircleIcon />
                                        <span className="text-[10px] uppercase font-bold mt-1 tracking-wider">Pass</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-red-500" title={row.error || "Verification Failed"}>
                                        <XMarkIcon />
                                        <span className="text-[10px] uppercase font-bold mt-1 tracking-wider">
                                            {row.error === 'Timeout' ? 'Timeout' : 'Fail'}
                                        </span>
                                    </div>
                                )}
                            </td>
                        </tr>
                    );
                    })}
                </tbody>
            </table>
        </div>
        {results.length > 0 && (
             <div className="p-4 bg-slate-800/50 border-t border-slate-700 text-xs text-slate-500 flex justify-between">
                 <span>Showing {results.length} results</span>
                 <span>Score = Cumulative Token Cost over {wave} rounds (Lower is better)</span>
             </div>
        )}
    </div>
  );
};

export default RankingTable;
