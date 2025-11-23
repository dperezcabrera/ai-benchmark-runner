import React, { useRef, useEffect } from 'react';

interface ConsoleOutputProps {
  output: string;
}

const ConsoleOutput: React.FC<ConsoleOutputProps> = ({ output }) => {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="h-full p-4">
      <pre
        ref={preRef}
        className="text-sm font-mono whitespace-pre-wrap break-words text-white h-full overflow-y-auto"
      >
        {output}
      </pre>
    </div>
  );
};

export default ConsoleOutput;