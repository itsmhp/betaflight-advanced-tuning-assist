import { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

export default function CLIOutput({ commands, title = 'CLI Commands' }) {
  const [copied, setCopied] = useState(false);

  if (!commands || commands.length === 0) return null;

  const text = commands.join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text + '\nsave\n');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text + '\nsave\n';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Terminal size={14} className="text-violet-400" />
          {title}
        </h4>
        <button
          onClick={handleCopy}
          className={`text-xs px-3 py-1 rounded flex items-center gap-1 transition-colors ${
            copied
              ? 'bg-green-600/30 text-green-400 border border-green-500/50'
              : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-violet-400 hover:border-violet-500/50'
          }`}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy All'}
        </button>
      </div>
      <div className="cli-box">
        <pre className="text-xs leading-relaxed">
          <span className="text-gray-500"># Paste into Betaflight CLI tab{'\n'}</span>
          {commands.map((cmd, i) => (
            <span key={i}>
              <span className="text-violet-400">{'> '}</span>
              <span className="text-green-300">{cmd}</span>
              {'\n'}
            </span>
          ))}
          <span className="text-violet-400">{'> '}</span>
          <span className="text-yellow-400">save</span>
        </pre>
      </div>
    </div>
  );
}
