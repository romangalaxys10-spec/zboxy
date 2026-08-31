'use client';

import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }

  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center">
          <h2 className="text-lg font-bold text-red-600 mb-2">Something went wrong</h2>
          <pre className="text-sm text-slate-600 bg-red-50 p-4 rounded-lg text-left overflow-auto max-h-64">{this.state.error?.message}\n\n{this.state.error?.stack}</pre>
          <button onClick={() => this.setState({ hasError: false, error: null })} className="mt-4 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200">Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
