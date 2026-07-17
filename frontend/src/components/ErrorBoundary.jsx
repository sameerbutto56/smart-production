import React from 'react';
import { AlertCircle, Bug } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    if (
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.message?.includes('ChunkLoadError') ||
      error?.name === 'ChunkLoadError'
    ) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 max-w-md w-full">
            <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <h2 className="text-lg font-black text-white mb-2 text-center">Something went wrong</h2>
            <p className="text-sm text-gray-400 mb-4 font-medium text-center">Please refresh the page to continue.</p>
            {err && (
              <div className="mb-4 bg-gray-950 rounded-lg p-3 border border-gray-800 max-h-48 overflow-y-auto">
                <p className="text-xs text-red-400 font-mono break-all">{err.message}</p>
                {err.stack && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-300 flex items-center gap-1"><Bug size={10} /> Stack</summary>
                    <pre className="text-[9px] text-gray-500 font-mono mt-1 whitespace-pre-wrap break-all">{err.stack}</pre>
                  </details>
                )}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black px-6 py-2.5 rounded-xl text-sm"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
