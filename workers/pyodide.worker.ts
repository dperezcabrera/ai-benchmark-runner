
// We need to declare the global importScripts for TypeScript in a worker context
declare function importScripts(...urls: string[]): void;

// Define message types
type WorkerMessage = 
  | { type: 'INIT' }
  | { type: 'INSTALL'; packages: string[] }
  | { type: 'RUN'; files: { name: string; content: string }[] };

let pyodide: any = null;

// Initialize Pyodide
const initPyodide = async () => {
  try {
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js");
    
    // @ts-ignore - loadPyodide is imported via importScripts
    pyodide = await loadPyodide();
    
    // Setup output handling
    const stdoutCallback = (str: string) => {
        const graphPrefix = '__GRAPH_DATA__:';
        const lines = str.trim().split('\n');
        let consoleOutput = '';
        
        for (const line of lines) {
            if (line.startsWith(graphPrefix)) {
                try {
                    const jsonStr = line.substring(graphPrefix.length);
                    const graphData = JSON.parse(jsonStr);
                    self.postMessage({ type: 'GRAPH_DATA', data: graphData });
                } catch (e) {
                    consoleOutput += `\n[ERROR] Failed to parse graph data.\n`;
                }
            } else if (line.trim()) { 
                consoleOutput += line + '\n';
            }
        }
        
        if (consoleOutput) {
            self.postMessage({ type: 'OUTPUT', text: consoleOutput });
        }
    };

    pyodide.setStdout({ batched: stdoutCallback });
    pyodide.setStderr({ batched: (str: string) => self.postMessage({ type: 'OUTPUT', text: str + '\n' }) });

    await pyodide.loadPackage('micropip');
    
    self.postMessage({ type: 'READY' });
  } catch (error: any) {
    self.postMessage({ type: 'ERROR', message: error.message });
  }
};

const installPackages = async (packages: string[]) => {
    if (!pyodide) return;
    try {
        const micropip = pyodide.pyimport('micropip');
        await micropip.install(packages);
        self.postMessage({ type: 'INSTALLED', packages });
    } catch (error: any) {
        self.postMessage({ type: 'INSTALL_ERROR', message: error.message });
    }
};

const runCode = async (files: { name: string; content: string }[]) => {
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
             self.postMessage({ type: 'OUTPUT', text: `> Running tests in ${testFile.name}...\n` });
             const pytest = pyodide.pyimport('pytest');
             const exitCode = await pytest.main(['-v', testFile.name]);
             self.postMessage({ type: 'DONE', success: exitCode === 0 });
        } else if (mainFile) {
            self.postMessage({ type: 'OUTPUT', text: `> Running ${mainFile.name}...\n\n` });
            const mainContent = pyodide.FS.readFile(mainFile.name, { encoding: 'utf8' });
            await pyodide.runPythonAsync(mainContent);
            self.postMessage({ type: 'DONE', success: true });
        } else {
            self.postMessage({ type: 'OUTPUT', text: 'No entrypoint found (e.g., main.py or test_*.py)' });
            self.postMessage({ type: 'DONE', success: false });
        }

    } catch (error: any) {
        self.postMessage({ type: 'OUTPUT', text: `\n\n--- PYTHON ERROR ---\n${error.message}\n` });
        self.postMessage({ type: 'DONE', success: false });
    }
};

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type } = e.data;

  switch (type) {
    case 'INIT':
      await initPyodide();
      break;
    case 'INSTALL':
      if ('packages' in e.data) await installPackages(e.data.packages);
      break;
    case 'RUN':
      if ('files' in e.data) await runCode(e.data.files);
      break;
  }
};
