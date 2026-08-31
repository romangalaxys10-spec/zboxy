'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Box } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Zboxy Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-lg text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
          <Box className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
        <p className="text-slate-500">An unexpected error occurred. This has been logged to the console.</p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left overflow-auto max-h-48">
          <p className="text-sm font-mono text-red-700 break-all">{error.message}</p>
          {error.digest && <p className="text-xs text-red-400 mt-2">Error ID: {error.digest}</p>}
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="outline">Try Again</Button>
          <Button onClick={() => { window.location.href = '/'; }} className="bg-emerald-600 hover:bg-emerald-700">Go Home</Button>
        </div>
      </div>
    </div>
  );
}
