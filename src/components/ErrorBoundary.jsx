import { Component } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="card max-w-lg w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={22} className="text-red-400" />
              <h2 className="text-lg font-bold text-red-300">Something went wrong</h2>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              An error occurred while rendering this page. This is usually caused by
              unexpected data format in the uploaded file.
            </p>
            {this.state.error && (
              <pre className="text-xs text-red-300 bg-red-950/30 border border-red-900/40 rounded p-3 mb-4 text-left overflow-auto max-h-32">
                {this.state.error.toString()}
              </pre>
            )}
            <button
              className="btn-primary flex items-center gap-2 mx-auto"
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.hash = '/';
              }}
            >
              <RotateCcw size={14} />
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
