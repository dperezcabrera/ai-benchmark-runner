
import { useState, useEffect, useRef, useCallback } from 'react';
import { LevelFile } from '../types';

// We define the worker script as a string to avoid issues with 
// bundlers/environments failing to resolve worker file URLs.
// NOTE: We are using the external worker file via imports in production usually, 
// but here we keep the inline approach for portability if needed, OR we rely on the worker file.
// Ideally, we should import the worker class if using Vite with worker support.
// For this environment, we assume the Worker is instantiated from the file created by 'pyodide.worker.ts'.
// However, the existing code uses a Blob. We need to match the new worker code.
// To keep things simple and consistent with the previous file updates, we will update the 
// inline string to match the new worker code with INSTALL_ERROR support.

const PYODIDE_WORKER_CODE = `
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js");

let pyodide = null;

const initPyodide = async () => {
    try {
        pyodide = await loadPyodide();
        
        const stdoutCallback = (str) => {
            const graphPrefix = '__GRAPH_DATA__:';
            const lines = str.trim().split('\\n');
            let consoleOutput = '';
            
            for (const line of lines) {
                if (line.startsWith(graphPrefix)) {
                    try {
                        const jsonStr = line.substring(graphPrefix.length);
                        const graphData = JSON.parse(jsonStr);
                        self.postMessage({ type: 'GRAPH_DATA', data: graphData });
                    } catch (e) {
                        consoleOutput += '\\n[ERROR] Failed to parse graph data.\\n';
                    }
                } else if (line.trim()) {
                    consoleOutput += line + '\\n';
                }
            }
            
            if (consoleOutput) {
                self.postMessage({ type: 'OUTPUT', text: consoleOutput });
            }
        };

        pyodide.setStdout({ batched: stdoutCallback });
        pyodide.setStderr({ batched: (str) => self.postMessage({ type: 'OUTPUT', text: str + '\\n' }) });

        await pyodide.loadPackage('micropip');
        self.postMessage({ type: 'READY' });
    } catch (error) {
        self.postMessage({ type: 'ERROR', message: error.message });
    }
};

const installPackages = async (packages) => {
    if (!pyodide) return;
    try {
        const micropip = pyodide.pyimport('micropip');
        await micropip.install(packages);
        self.postMessage({ type: 'INSTALLED', packages });
    } catch (error) {
        self.postMessage({ type: 'INSTALL_ERROR', message: error.message });
    }
};

const runCode = async (files) => {
    if (!pyodide) return;

    try {
        // 1. Write files to virtual file system
        for (const file of files) {
            pyodide.FS.writeFile(file.name, file.content);
        }

        // 2. Determine entry point
        const testFile = files.find(f => f.name.startsWith('test_'));
        const mainFile = files.find(f => f.name === 'main.py');
        
        // 3. Execute
        if (testFile) {
            self.postMessage({ type: 'OUTPUT', text: \`> Running tests in \${testFile.name}...\\n\` });
            try {
                const pytest = pyodide.pyimport('pytest');
                const exitCode = await pytest.main(['-v', testFile.name]);
                self.postMessage({ type: 'DONE', success: exitCode === 0 });
            } catch(e) {
                 self.postMessage({ type: 'OUTPUT', text: \`Error: pytest not found. Ensure it is in the level packages.\\n\` });
                 self.postMessage({ type: 'DONE', success: false });
            }
        } else if (mainFile) {
            self.postMessage({ type: 'OUTPUT', text: \`> Running \${mainFile.name}...\\n\\n\` });
            const mainContent = pyodide.FS.readFile(mainFile.name, { encoding: 'utf8' });
            await pyodide.runPythonAsync(mainContent);
            self.postMessage({ type: 'DONE', success: true });
        } else {
            self.postMessage({ type: 'OUTPUT', text: 'No entrypoint found (e.g., main.py or test_*.py)' });
            self.postMessage({ type: 'DONE', success: false });
        }

    } catch (error) {
        self.postMessage({ type: 'OUTPUT', text: \`\\n\\n--- PYTHON ERROR ---\\n\${error.message}\\n\` });
        self.postMessage({ type: 'DONE', success: false });
    }
};

self.onmessage = async (e) => {
    const { type } = e.data;

    switch (type) {
        case 'INIT':
            await initPyodide();
            break;
        case 'INSTALL':
            if (e.data.packages) await installPackages(e.data.packages);
            break;
        case 'RUN':
            if (e.data.files) await runCode(e.data.files);
            break;
    }
};
`;

export const usePyodide = () => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [graphData, setGraphData] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  
  // Ref to hold the full output synchronously, avoiding React state update delays
  const fullOutputRef = useRef('');
  
  const workerRef = useRef<Worker | null>(null);
  const runResolveRef = useRef<((value: boolean) => void) | null>(null);
  const readyResolveRef = useRef<(() => void) | null>(null);
  const installResolveRef = useRef<(() => void) | null>(null);
  const installedPackagesRef = useRef<Set<string>>(new Set());

  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
    }
    setIsReady(false);
    setIsExecuting(false);
    setIsInstalling(false);
    // Clear pending promises
    if (runResolveRef.current) {
        runResolveRef.current(false);
        runResolveRef.current = null;
    }
  }, []);

  const initPyodide = useCallback(() => {
      return new Promise<void>((resolve) => {
        // Always start fresh to ensure clean state (sys.modules)
        terminateWorker();

        setIsLoading(true);
        readyResolveRef.current = resolve;
        installedPackagesRef.current = new Set();
        
        // Reset output
        setOutput('');
        fullOutputRef.current = '';

        // Use Blob for worker to avoid URL resolution errors
        const blob = new Blob([PYODIDE_WORKER_CODE], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        
        // Note: We do NOT use { type: 'module' } here because we use importScripts in the worker
        const worker = new Worker(workerUrl);

        worker.onmessage = (e) => {
            const { type, text, data, success, message, packages } = e.data;

            switch (type) {
                case 'READY':
                    setIsReady(true);
                    setIsLoading(false);
                    console.log("Pyodide worker ready.");
                    if (readyResolveRef.current) {
                        readyResolveRef.current();
                        readyResolveRef.current = null;
                    }
                    break;
                case 'OUTPUT':
                    // Update synchronous ref first
                    fullOutputRef.current += text;
                    setOutput(prev => prev + text);
                    break;
                case 'GRAPH_DATA':
                    setGraphData(data);
                    break;
                case 'ERROR':
                    console.error("Worker error:", message);
                    const errorMsg = `\n[SYSTEM ERROR] ${message}\n`;
                    fullOutputRef.current += errorMsg;
                    setOutput(prev => prev + errorMsg);
                    setIsLoading(false);
                    break;
                case 'INSTALLED':
                    setIsInstalling(false);
                    packages.forEach((p: string) => installedPackagesRef.current.add(p));
                    const installMsg = `\n> Installation complete.\n`;
                    fullOutputRef.current += installMsg;
                    setOutput(prev => prev + installMsg);
                    if (installResolveRef.current) {
                        installResolveRef.current();
                        installResolveRef.current = null;
                    }
                    break;
                case 'INSTALL_ERROR':
                    setIsInstalling(false);
                    const installErrorMsg = `\n[ERROR] Package installation failed: ${message}\n`;
                    fullOutputRef.current += installErrorMsg;
                    setOutput(prev => prev + installErrorMsg);
                    // We resolve anyway to allow the chain to continue or fail gracefully in app
                    if (installResolveRef.current) {
                        installResolveRef.current();
                        installResolveRef.current = null;
                    }
                    break;
                case 'DONE':
                    setIsExecuting(false);
                    if (runResolveRef.current) {
                        runResolveRef.current(success);
                        runResolveRef.current = null;
                    }
                    break;
            }
        };

        worker.onerror = (err) => {
            console.error("Worker error event:", err);
            const fatalMsg = `\n[WORKER FATAL ERROR] Terminated.\n`;
            fullOutputRef.current += fatalMsg;
            setOutput(prev => prev + fatalMsg);
            setIsLoading(false);
            setIsExecuting(false);
        };

        workerRef.current = worker;
        worker.postMessage({ type: 'INIT' });
      });
  }, [terminateWorker]);

  const stopExecution = useCallback(() => {
      if (isExecuting || isInstalling) {
          const stopMsg = '\n[SYSTEM] Execution stopped.\n';
          fullOutputRef.current += stopMsg;
          setOutput(prev => prev + stopMsg);
          terminateWorker();
          // We don't auto-restart here to allow caller control
      }
  }, [isExecuting, isInstalling, terminateWorker]);

  const restartWorker = useCallback(async () => {
      stopExecution();
      await initPyodide();
  }, [stopExecution, initPyodide]);

  const installPackages = useCallback((packages: string[]) => {
    return new Promise<void>((resolve) => {
        if (!workerRef.current || !isReady) {
            resolve();
            return;
        }
        
        const newPackages = packages.filter(p => !installedPackagesRef.current.has(p));
        if (newPackages.length === 0) {
            resolve();
            return;
        }

        setIsInstalling(true);
        installResolveRef.current = resolve;
        const msg = `> Installing packages: ${newPackages.join(', ')}...\n`;
        fullOutputRef.current += msg;
        setOutput(prev => prev + msg);
        
        workerRef.current.postMessage({ type: 'INSTALL', packages: newPackages });
    });
  }, [isReady]);

  const runCode = useCallback((files: LevelFile[]): Promise<boolean> => {
    return new Promise((resolve) => {
        if (!workerRef.current || !isReady) {
            resolve(false);
            return;
        }
        
        setIsExecuting(true);
        const msg = '> Executing code...\n';
        fullOutputRef.current += msg;
        setOutput(prev => prev + msg);
        setGraphData(null); // Clear graph on new run
        
        runResolveRef.current = resolve;
        
        // Extract content from files
        const plainFiles = files.map(f => ({ name: f.name, content: f.content }));
        workerRef.current.postMessage({ type: 'RUN', files: plainFiles });
    });
  }, [isReady]);
  
  const clearOutput = useCallback(() => {
    setOutput('');
    fullOutputRef.current = '';
    setGraphData(null);
  }, []);

  const appendOutput = useCallback((text: string) => {
      fullOutputRef.current += text;
      setOutput(prev => prev + text);
  }, []);

  return { 
    initPyodide,
    restartWorker,
    stopExecution,
    isLoading, 
    isExecuting,
    isInstalling,
    output,
    fullOutputRef, // Exposed for synchronous access
    graphData,
    installPackages,
    runCode,
    clearOutput,
    appendOutput,
    isReady
  };
};
