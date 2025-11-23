
import React, { useState, useEffect, useRef } from 'react';
import ConsoleOutput from './components/ConsoleOutput';
import TabbedCodeEditor from './components/TabbedCodeEditor';
import ModelConfigPanel from './components/ModelConfigPanel';
import RankingTable from './components/RankingTable';
import OverviewPanel from './components/OverviewPanel';
import { usePyodide } from './hooks/usePyodide';
import { PlayIcon, SpinnerIcon, TrashIcon, CogIcon, PencilIcon, CheckCircleIcon, XMarkIcon, PauseIcon, ArrowPathIcon, InfoIcon, DocumentTextIcon, UserGroupIcon, ClipboardIcon } from './components/icons';
import { BenchmarkFile, BenchmarkResult, ModelProposal, RunResultDetail } from './types';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import CodeEditor from './components/CodeEditor';

// --- INITIAL DATA & FILES ---

const DEFAULT_FILES: BenchmarkFile[] = [
  {
    name: "main.py",
    content: `from __future__ import annotations
import sys
import json
import random
import time
import importlib
from verification import verify_plan
from algorithms import FunctionalPlanner

def load_config_and_instantiate_algorithms():
    """Reads config.json injected by the UI and instantiates algo adapters."""
    try:
        with open('config.json', 'r') as f:
            config = json.load(f)
    except FileNotFoundError:
        print("No config.json found.")
        return []

    algos = []
    
    for item in config:
        module_name = item.get('module')
        model_name = item.get('modelName')
        algo_name = item.get('algoName')
        
        try:
            user_module = importlib.import_module(module_name)
            if not hasattr(user_module, 'calculate_batches'):
                print(f"[ERROR] '{model_name}': Function 'calculate_batches' not found in {module_name}.")
                continue
            
            func = getattr(user_module, 'calculate_batches')
            full_name = f"{model_name} - {algo_name}"
            instance = FunctionalPlanner(func, name=full_name)
            
            instance._ui_metadata = {
                "model": model_name,
                "algorithm": algo_name
            }
            algos.append(instance)
            
        except Exception as e:
            print(f"[ERROR] Failed to load '{model_name}': {e}")

    return algos

def generate_example_files(num_files: int, context_size: int, seed: int = 42) -> dict[str, int]:
    random.seed(seed)
    max_allowed = max(1, context_size // 4)
    file_sizes = {}
    for i in range(num_files):
        size = random.randint(max_allowed // 4 or 1, max_allowed)
        path = f"file_{i+1:03d}.txt"
        file_sizes[path] = size
    return file_sizes

def main():
    context_size = 8000
    overhead_tokens = 200
    max_workers = 1 
    num_files = 20
    
    seed = 0
    try:
        with open('params.json', 'r') as f:
            params = json.load(f)
            seed = params.get('seed', 0)
    except:
        pass
        
    file_sizes = generate_example_files(num_files, context_size, seed)
    algorithms_list = load_config_and_instantiate_algorithms()
    
    if not algorithms_list:
        print("No valid algorithms to run.")
        return

    # Sequential execution loop with streaming results
    for algo in algorithms_list:
        print(f"Running {algo.name}...")
        start_time = time.time()
        ui_meta = getattr(algo, '_ui_metadata', {})
        
        algo_score = 0
        verified = False
        error_msg = None
        batches = []
        elapsed = 0.0

        try:
             # Run Plan
             result = algo.plan(
                context_size=context_size, 
                file_sizes=file_sizes, 
                max_workers=max_workers,
                overhead_tokens=overhead_tokens
            )
             batches = result.batches
             elapsed = result.elapsed_seconds
             if elapsed == 0.0: elapsed = time.time() - start_time
             
             # Calculate Tokens
             total_tokens = 0
             if batches:
                 for batch in batches:
                     batch_sum = sum(file_sizes.get(f, 0) for f in batch)
                     total_tokens += batch_sum + overhead_tokens
             
             algo_score = total_tokens
             
             # Verify
             verify_plan(context_size, file_sizes, batches, overhead_tokens)
             verified = True

        except Exception as e:
            error_msg = str(e)
            elapsed = time.time() - start_time
            # print(f"Error in {algo.name}: {e}")
        
        step_result = {
            "name": algo.name,
            "model": ui_meta.get('model', 'Unknown'),
            "algorithm": ui_meta.get('algorithm', 'Unknown'),
            "version": "",
            "batches": len(batches),
            "time": elapsed,
            "verified": verified,
            "score": int(algo_score) if verified else 0,
            "error": error_msg
        }
        
        print(f"__BENCHMARK_STEP__:{json.dumps(step_result)}")

if __name__ == "__main__":
    main()
`
  },
  {
    name: "benchmark.py",
    content: `from __future__ import annotations
from typing import Dict, Iterable, List, Optional
import time
from algorithms import PlanningAlgorithm
from models import PlanResult
from verification import verify_plan

# Kept for compatibility, though main.py now implements the loop directly for streaming
def benchmark_algorithms(
    context_size: int,
    file_sizes: Dict[str, int],
    algorithms: Iterable[PlanningAlgorithm],
    max_workers: int,
    overhead_tokens: int = 0,
    verify: bool = True,
    timeout_seconds: Optional[float] = None,
) -> List[PlanResult]:
    results = []
    for algo in algorithms:
        try:
            result = algo.plan(context_size, file_sizes, max_workers, overhead_tokens)
            results.append(result)
        except Exception:
            pass
    return results
`
  },
  {
    name: "models.py",
    content: `from dataclasses import dataclass, field
from typing import Any, Dict, List

@dataclass
class PlanResult:
    name: str
    batches: List[List[str]]
    elapsed_seconds: float
    total_tokens: int
    max_workers: int
    metadata: Dict[str, Any] = field(default_factory=dict)
    verified: bool = False
    timed_out: bool = False
`
  },
  {
    name: "algorithms.py",
    content: `from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Dict, List
import inspect
from models import PlanResult

class PlanningAlgorithm(ABC):
    name: str = "Base"
    @abstractmethod
    def plan(
        self,
        context_size: int,
        file_sizes: Dict[str, int],
        max_workers: int,
        overhead_tokens: int = 0,
    ) -> PlanResult:
        raise NotImplementedError

class FunctionalPlanner(PlanningAlgorithm):
    """Adapter to treat a standalone function as a PlanningAlgorithm."""
    
    def __init__(self, func, name: str):
        self.name = name
        self._func = func
        
    def plan(self, context_size: int, file_sizes: Dict[str, int], max_workers: int, overhead_tokens: int = 0) -> PlanResult:
        sig = inspect.signature(self._func)
        kwargs = {}
        if 'overhead_tokens' in sig.parameters:
            kwargs['overhead_tokens'] = overhead_tokens
            
        batches = self._func(context_size, file_sizes, **kwargs)
        
        return PlanResult(
            name=self.name,
            batches=batches,
            elapsed_seconds=0.0, 
            total_tokens=0,
            max_workers=max_workers
        )
`
  },
  {
    name: "verification.py",
    content: `from __future__ import annotations
from typing import Dict, List, Set, Tuple
from itertools import combinations

class VerificationError(Exception):
    pass

def verify_plan(
    context_size: int,
    file_sizes: Dict[str, int],
    batches: List[List[str]],
    overhead_tokens: int = 0
) -> None:
    if context_size <= 0:
        raise VerificationError("context_size must be positive")
    if not file_sizes:
        return

    files = list(file_sizes.keys())
    file_set = set(files)
    appeared: Set[str] = set()

    for batch_idx, batch in enumerate(batches):
        if not batch:
            raise VerificationError(f"Empty batch at index {batch_idx}")
        seen: Set[str] = set()
        batch_tokens = overhead_tokens 
        
        for path in batch:
            if path not in file_set:
                raise VerificationError(f"Batch {batch_idx} unknown file: {path}")
            if path in seen:
                raise VerificationError(f"Batch {batch_idx} duplicate file: {path}")
            seen.add(path)
            appeared.add(path)
            batch_tokens += file_sizes[path]
            
        if batch_tokens > context_size:
            raise VerificationError(f"Batch {batch_idx} exceeds context: {batch_tokens} > {context_size}")

    missing = file_set - appeared
    if missing:
        raise VerificationError(f"Missing files: {sorted(missing)}")
        
    if len(files) > 1:
        required_pairs = set()
        sorted_files = sorted(files)
        for a, b in combinations(sorted_files, 2):
            required_pairs.add((a, b))

        for batch in batches:
            for a, b in combinations(sorted(batch), 2):
                if (a, b) in required_pairs:
                    required_pairs.remove((a, b))

        if required_pairs:
            examples = list(required_pairs)[:3]
            raise VerificationError(f"Missing pairwise coverage for {len(required_pairs)} pairs. Examples: {examples}")
`
  }
];

const DEFAULT_PROMPT = `**You are an expert in algorithm design and Python optimization.
Your task is to write a specific Python function to solve the "Pairwise Document Coverage" scheduling problem.**

<br/>

<br/>

## 🔍 **Problem Description**

You are given a set of files, each with a specific token size. You need to group these files into "batches" (API calls) such that:
1.  **Constraint:** The total tokens in a batch (sum of file sizes + \`overhead_tokens\`) must not exceed \`context_size\`.
2.  **Requirement:** Every pair of distinct files must appear together in at least one batch.
3.  **Objective:** Minimize the total token cost (sum of tokens of all batches).

<br/>

<br/>

## 💻 **Implementation Requirements**

You must implement a Python function named \`calculate_batches\`.

**Function Signature:**
\`\`\`python
from typing import Dict, List

def calculate_batches(
    context_size: int, 
    file_sizes: Dict[str, int], 
    overhead_tokens: int = 0
) -> List[List[str]]:
    ...
\`\`\`

*   **Inputs:**
    *   \`context_size\` (int): Maximum tokens allowed per batch.
    *   \`file_sizes\` (Dict[str, int]): Dictionary mapping filenames to their token counts.
    *   \`overhead_tokens\` (int): Fixed token cost added to every batch.
*   **Output:**
    *   \`List[List[str]]\`: A list of batches, where each batch is a list of filename strings.

<br/>

<br/>

## 📝 **Output Example**

Your response should contain **only** valid Python code containing the function and necessary imports.

**Example Structure:**

\`\`\`python
from typing import Dict, List
import itertools

def calculate_batches(context_size: int, file_sizes: Dict[str, int], overhead_tokens: int = 0) -> List[List[str]]:
    """
    Greedy implementation to ensure pairwise coverage.
    """
    filenames = list(file_sizes.keys())
    batches = []
    
    # ... logic to create batches ...
    
    return batches
\`\`\`

<br/>

<br/>

## 🧠 **Guidelines**

1.  **Deterministic:** The result should be consistent.
2.  **Efficient:** Use a greedy strategy. Do not use brute force.
3.  **Correctness:** Ensure \`sum(files) + overhead <= context_size\` for every batch.

**Final Instruction:** Please provide the code in a single code block without comments.
`;

// Initial Proposals
const DEFAULT_PROPOSALS: ModelProposal[] = [];

export default function App() {
  const { 
    initPyodide,
    restartWorker,
    stopExecution,
    isLoading: isPyodideLoading, 
    isExecuting, 
    isInstalling, 
    output,
    installPackages, 
    runCode, 
    clearOutput: pyodideClearOutput,
    appendOutput,
    isReady,
    fullOutputRef
  } = usePyodide();

  // State
  const [files, setFiles] = useState<BenchmarkFile[]>(DEFAULT_FILES);
  const [dependencies, setDependencies] = useState<string>('');
  const [promptContent, setPromptContent] = useState<string>(DEFAULT_PROMPT);
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [timeoutSecs, setTimeoutSecs] = useState<number>(5); // Default 5 seconds
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [proposals, setProposals] = useState<ModelProposal[]>(DEFAULT_PROPOSALS);
  
  // Continuous Benchmark State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaveRunning, setIsWaveRunning] = useState(false);
  const [wave, setWave] = useState(0);
  const [leaderboard, setLeaderboard] = useState<RunResultDetail[]>([]);
  const [runningModelName, setRunningModelName] = useState<string | null>(null);
  
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult>({
      status: 'IDLE',
      executionTime: 0,
      verified: false
  });

  const [activeTab, setActiveTab] = useState('overview'); 

  // Output processing
  const isPlayingRef = useRef(false); // Ref for sync access in loops
  
  useEffect(() => {
      isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    initPyodide();
  }, [initPyodide]);

  // Handle Output Streaming (Logging Only)
  // We removed the updateLeaderboard logic from here to prevent race conditions.
  // The runBenchmarkSequence loop now handles result parsing synchronously.

  const updateLeaderboard = (result: RunResultDetail, waveIndex: number) => {
      setLeaderboard(prevLeaderboard => {
          const newLeaderboard = [...prevLeaderboard];
          const existingIndex = newLeaderboard.findIndex(item => item.name === result.name);
          
          if (existingIndex >= 0) {
              const existing = newLeaderboard[existingIndex];
              
              // Prevent double counting for the same wave
              if (existing.lastVerifiedWave === waveIndex) {
                  return prevLeaderboard;
              }

              newLeaderboard[existingIndex] = {
                  ...existing,
                  batches: existing.batches + result.batches,
                  score: existing.score + result.score,
                  time: existing.time + result.time,
                  verified: existing.verified && result.verified,
                  // Only increment completedWaves if this specific run was verified
                  completedWaves: existing.completedWaves + (result.verified ? 1 : 0),
                  lastVerifiedWave: waveIndex,
                  error: result.error || existing.error // keep error if new run failed
              };
          } else {
              newLeaderboard.push({
                  ...result,
                  completedWaves: result.verified ? 1 : 0,
                  lastVerifiedWave: waveIndex
              });
          }
          return newLeaderboard;
      });
  };

  // Countdown timer
  useEffect(() => {
      let interval: any;
      if (benchmarkResult.status === 'RUNNING' && timeLeft > 0) {
          interval = setInterval(() => {
              setTimeLeft(prev => Math.max(0, prev - 1));
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [benchmarkResult.status, timeLeft]);

  const togglePlay = () => {
      setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
      setIsPlaying(false);
      stopExecution();
      setIsWaveRunning(false);
      setRunningModelName(null);
      setBenchmarkResult(prev => ({ ...prev, status: 'IDLE', message: 'Stopped by user' }));
  };

  const handleReset = () => {
      if (confirm("Reset leaderboard and round count?")) {
          setIsPlaying(false);
          setIsWaveRunning(false);
          setWave(0);
          setLeaderboard([]);
          setRunningModelName(null);
          setBenchmarkResult({ status: 'IDLE', executionTime: 0, verified: false });
          pyodideClearOutput();
      }
  };

  const clearOutput = () => {
      pyodideClearOutput();
  };

  // Main execution loop
  useEffect(() => {
      if (isPlaying && !isWaveRunning && isReady) {
          runBenchmarkSequence();
      }
  }, [isPlaying, isWaveRunning, isReady]);


  const runBenchmarkSequence = async () => {
      setIsWaveRunning(true);
      setBenchmarkResult(prev => ({ ...prev, status: 'RUNNING', executionTime: 0 }));
      
      const activeProposals = proposals.filter(p => p.active);
      const pkgs = dependencies.split('\n').map(s => s.trim()).filter(s => s);
      const currentWaveSeed = wave; // capture current wave

      // Log Start of Wave
      appendOutput(`\n\n========================================\n           STARTING ROUND ${wave}\n========================================\n\n`);

      // Ensure packages are installed before wave starts
      if (pkgs.length > 0) {
          await installPackages(pkgs);
      }

      for (const proposal of activeProposals) {
          if (!isPlayingRef.current) break; // Check ref for immediate stop

          const fullName = `${proposal.modelName} - ${proposal.algorithmName}`;

          // CHECK DISQUALIFICATION:
          // If model exists in leaderboard and is NOT verified (failed previously), skip it.
          const existingEntry = leaderboard.find(l => l.name === fullName);
          if (existingEntry && !existingEntry.verified) {
              continue; 
          }

          setTimeLeft(timeoutSecs); // Reset timeout for THIS proposal
          setRunningModelName(fullName);

          // Ensure leaderboard has an entry for this model so users can see it running
          setLeaderboard(prev => {
              if (prev.some(p => p.name === fullName)) return prev;
              return [...prev, {
                  name: fullName,
                  model: proposal.modelName,
                  algorithm: proposal.algorithmName,
                  version: "",
                  batches: 0,
                  time: 0,
                  verified: true, // Start optimistic
                  score: 0,
                  completedWaves: 0,
                  lastVerifiedWave: -1
              }];
          });

          // Prepare Files for this specific proposal
          const config = [{
              module: `user_algo_${proposal.id}`, 
              modelName: proposal.modelName,
              algoName: proposal.algorithmName
          }];

          const userAlgoFile = {
              name: `user_algo_${proposal.id}.py`,
              content: proposal.code
          };

          const filesToRun = [
              ...files,
              userAlgoFile,
              { name: 'config.json', content: JSON.stringify(config) },
              { name: 'params.json', content: JSON.stringify({ seed: currentWaveSeed, timeout: timeoutSecs }) }
          ];

          // Capture start length of output to parse ONLY the new output for this run
          const startOutputLength = fullOutputRef.current.length;

          // Run with Race condition for Timeout
          let timedOut = false;
          let timerId: ReturnType<typeof setTimeout> | undefined;

          const timeoutPromise = new Promise<boolean>((resolve) => {
              timerId = setTimeout(() => {
                  timedOut = true;
                  resolve(false);
              }, timeoutSecs * 1000);
          });

          // Execute
          // We use runCode which resolves to boolean (success)
          const runPromise = runCode(filesToRun);
          
          // Race
          const success = await Promise.race([runPromise, timeoutPromise]);
          
          // Clear the timer if run finished first
          if (timerId) clearTimeout(timerId);

          if (timedOut) {
               // Handle Timeout
               updateLeaderboard({
                    name: fullName,
                    model: proposal.modelName,
                    algorithm: proposal.algorithmName,
                    version: "",
                    batches: 0,
                    time: timeoutSecs,
                    verified: false,
                    score: 0,
                    error: "Timeout",
                    completedWaves: 0
               }, currentWaveSeed);
               
               await restartWorker();
               if (pkgs.length > 0) await installPackages(pkgs);

          } else if (!success) {
               // Handle Crash/Error reported by worker (not timeout)
                updateLeaderboard({
                    name: fullName,
                    model: proposal.modelName,
                    algorithm: proposal.algorithmName,
                    version: "",
                    batches: 0,
                    time: 0,
                    verified: false,
                    score: 0,
                    error: "Runtime Error",
                    completedWaves: 0
               }, currentWaveSeed);
               
               await restartWorker();
               if (pkgs.length > 0) await installPackages(pkgs);
          } else {
               // Success Execution -> Synchronously parse output for this run
               const runOutput = fullOutputRef.current.slice(startOutputLength);
               const lines = runOutput.split('\n');
               let resultFound = false;

               for (const line of lines) {
                    if (line.trim().startsWith('__BENCHMARK_STEP__:')) {
                        try {
                            const jsonPart = line.substring(line.indexOf('__BENCHMARK_STEP__:') + '__BENCHMARK_STEP__:'.length);
                            const result = JSON.parse(jsonPart) as RunResultDetail;
                            updateLeaderboard(result, currentWaveSeed);
                            resultFound = true;
                            break; 
                        } catch (e) {
                            console.error("Failed to parse step result", e);
                        }
                    }
               }

               if (!resultFound) {
                   // If code ran successfully but didn't output the benchmark step (e.g. no main() call or print failure)
                   updateLeaderboard({
                        name: fullName,
                        model: proposal.modelName,
                        algorithm: proposal.algorithmName,
                        version: "",
                        batches: 0,
                        time: 0,
                        verified: false,
                        score: 0,
                        error: "Output Parsing Failed",
                        completedWaves: 0
                   }, currentWaveSeed);
               }
          }
          
          setRunningModelName(null);
      }
      
      if (isPlayingRef.current) {
          // Console Log for next round
          appendOutput(`\n>>> ROUND ${wave} COMPLETE. NEXT ROUND STARTING IN 3s...\n`);
          
          await new Promise(r => setTimeout(r, 3000));
          
          setWave(w => w + 1);
      } else {
          setBenchmarkResult(prev => ({ ...prev, status: 'IDLE' }));
      }
      
      setIsWaveRunning(false);
      setRunningModelName(null);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200 font-sans overflow-hidden relative">
        {/* Header */}
        <header className="flex-shrink-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between shadow-sm z-20 relative overflow-hidden">
             {/* Timeout Progress Bar */}
             {benchmarkResult.status === 'RUNNING' && runningModelName && (
                 <div 
                    className="absolute bottom-0 left-0 h-1 bg-cyan-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${(timeLeft / timeoutSecs) * 100}%` }}
                 />
             )}

            <div className="flex items-center gap-3 relative z-10">
                <div className="bg-cyan-900/50 p-2 rounded-lg text-cyan-400">
                  <CogIcon />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">Benchmark Runner</h1>
            </div>
            
            <div className="flex items-center gap-4 relative z-10">
                <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-md border border-slate-600">
                    <span className="text-xs text-slate-400 font-medium px-1">TIMEOUT (s):</span>
                    <input 
                        type="number" 
                        value={timeoutSecs}
                        onChange={(e) => setTimeoutSecs(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 bg-transparent text-white text-sm text-center outline-none font-mono"
                    />
                </div>
                
                {benchmarkResult.status === 'RUNNING' && (
                    <div className="font-mono text-cyan-400 font-bold w-8 text-center">
                        {timeLeft}
                    </div>
                )}
                
                <div className="h-6 w-px bg-slate-700 mx-2"></div>

                <button 
                    onClick={handleReset} 
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                    title="Reset Leaderboard"
                >
                    <ArrowPathIcon />
                </button>

                {isPlaying ? (
                     <button 
                        onClick={togglePlay}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-md font-bold shadow-md transition-colors"
                        title="Pause Benchmark"
                     >
                         <PauseIcon />
                     </button>
                ) : (
                    <button 
                        onClick={togglePlay} 
                        disabled={!isReady || (isWaveRunning && isExecuting)} // Allow starting if ready
                        title="Run Benchmark"
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-md font-bold shadow-md transition-colors"
                    >
                         {(isPyodideLoading || (isWaveRunning && isExecuting)) ? <SpinnerIcon /> : <PlayIcon />}
                    </button>
                )}
            </div>
        </header>

        {/* Top Tabs (Navigation) */}
        <div className="flex-shrink-0 bg-slate-800 border-b border-slate-700 flex px-4 gap-1">
             <button 
                onClick={() => setActiveTab('overview')} 
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'overview' ? 'border-cyan-500 text-cyan-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'}`}
            >
                <InfoIcon />
                Overview
            </button>
            <button 
                onClick={() => setActiveTab('prompt')} 
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'prompt' ? 'border-cyan-500 text-cyan-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'}`}
            >
                <DocumentTextIcon />
                Prompt
            </button>
            <button 
                onClick={() => setActiveTab('participants')} 
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'participants' ? 'border-cyan-500 text-cyan-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'}`}
            >
                <UserGroupIcon />
                Participants
            </button>
            <button 
                onClick={() => setActiveTab('code')} 
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'code' ? 'border-cyan-500 text-cyan-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'}`}
            >
                Core Code
            </button>
            <button 
                onClick={() => setActiveTab('dependencies')} 
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'dependencies' ? 'border-cyan-500 text-cyan-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'}`}
            >
                Dependencies
            </button>
            <button 
                onClick={() => setActiveTab('ranking')} 
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ranking' ? 'border-cyan-500 text-cyan-400 bg-slate-700/50' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'}`}
            >
                Leaderboard
            </button>
        </div>

        {/* Main Workspace */}
        <div className="flex-grow flex min-h-0">
            
            {/* Center Area */}
            <div className="flex-grow flex flex-col min-w-0 bg-slate-900 border-r border-slate-700 relative">
                
                {activeTab === 'overview' && (
                    <OverviewPanel />
                )}

                {activeTab === 'prompt' && (
                   <div className="flex flex-col h-full relative bg-slate-900">
                        {/* Toolbar with Separator */}
                        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center backdrop-blur-sm">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                Initial Prompt
                            </h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigator.clipboard.writeText(promptContent)}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                                    title="Copy to Clipboard"
                                >
                                    <ClipboardIcon />
                                </button>

                                <div className="h-4 w-px bg-slate-700 mx-1"></div>

                                {isEditingInstructions ? (
                                    <>
                                        <button 
                                            onClick={() => setIsEditingInstructions(false)} 
                                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                        >
                                            <XMarkIcon /> Cancel
                                        </button>
                                        <button 
                                            onClick={() => setIsEditingInstructions(false)} 
                                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-sm transition-colors"
                                        >
                                            <CheckCircleIcon /> Save Changes
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        onClick={() => setIsEditingInstructions(true)} 
                                        className="p-2 text-cyan-400 hover:bg-slate-700 rounded-md transition-colors"
                                        title="Edit Instructions"
                                    >
                                        <PencilIcon />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-grow relative overflow-hidden">
                            {isEditingInstructions ? (
                                <CodeEditor 
                                    value={promptContent} 
                                    onChange={setPromptContent} 
                                />
                            ) : (
                                <div className="absolute inset-0 overflow-y-auto p-8 custom-scrollbar">
                                    <div className="max-w-4xl mx-auto prose prose-invert prose-lg max-w-none pb-20">
                                        <Markdown rehypePlugins={[rehypeRaw]}>{promptContent}</Markdown>
                                    </div>
                                </div>
                            )}
                        </div>
                   </div>
                )}

                {activeTab === 'participants' && (
                    <ModelConfigPanel proposals={proposals} onChange={setProposals} />
                )}

                {activeTab === 'ranking' && (
                    <div className="h-full w-full bg-slate-900 p-8 overflow-hidden">
                         <div className="max-w-6xl mx-auto h-full flex flex-col">
                            <RankingTable results={leaderboard} wave={wave} runningModelName={runningModelName} />
                         </div>
                    </div>
                )}

                {activeTab === 'code' && (
                    <TabbedCodeEditor 
                        files={files} 
                        onFilesChange={setFiles} 
                    />
                )}

                {activeTab === 'dependencies' && (
                    <div className="h-full w-full p-8 bg-slate-900">
                        <div className="max-w-2xl mx-auto">
                            <h3 className="text-lg font-bold text-white mb-2">Python Dependencies</h3>
                            <p className="text-sm text-slate-400 mb-4">Enter pip packages to install via micropip, one per line.</p>
                            <textarea 
                                className="w-full h-64 bg-slate-950 text-slate-200 font-mono p-4 rounded-md border border-slate-700 focus:border-cyan-500 outline-none resize-none"
                                value={dependencies}
                                onChange={(e) => setDependencies(e.target.value)}
                                placeholder="numpy&#10;pandas"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Right Panel: Results & Console */}
            <div className="w-[400px] flex-shrink-0 flex flex-col bg-slate-950 shadow-2xl z-10">
                {/* Status Bar */}
                <div className="p-3 bg-slate-900 border-b border-slate-800 text-xs text-slate-400 flex justify-between items-center">
                     <div className="flex items-center gap-2">
                         <span className="font-bold uppercase tracking-wider">Status:</span>
                         <span className={`font-bold ${benchmarkResult.status === 'SUCCESS' ? 'text-green-400' : benchmarkResult.status === 'FAILURE' ? 'text-red-400' : 'text-slate-300'}`}>
                            {benchmarkResult.status}
                         </span>
                     </div>
                     <span className="font-mono bg-slate-800 px-2 py-1 rounded text-slate-300">
                        Round {wave} • {benchmarkResult.executionTime.toFixed(2)}s
                     </span>
                </div>

                {/* Console */}
                <div className="flex-grow min-h-0 flex flex-col bg-black">
                    <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-500 font-bold uppercase flex justify-between items-center">
                        <span>Console Output</span>
                        <button onClick={clearOutput} className="hover:text-white"><TrashIcon /></button>
                    </div>
                    <div className="flex-grow min-h-0">
                        <ConsoleOutput output={output} />
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
