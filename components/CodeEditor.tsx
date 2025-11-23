
import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { githubDark } from '@uiw/codemirror-theme-github';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  isReadOnly?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, isReadOnly = false }) => {
  return (
    <div className="h-full w-full overflow-hidden">
      <CodeMirror
        value={value}
        height="100%"
        extensions={[python()]}
        theme={githubDark}
        onChange={onChange}
        readOnly={isReadOnly}
        style={{ height: '100%' }}
      />
    </div>
  );
};

export default CodeEditor;
