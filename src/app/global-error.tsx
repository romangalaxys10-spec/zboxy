'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Zboxy Global Error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#f8fafc',
          padding: '1rem',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '32rem' }}>
            <div style={{
              width: '4rem', height: '4rem', margin: '0 auto 1.5rem',
              backgroundColor: '#fef2f2', borderRadius: '1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem',
            }}>!</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Something went wrong</h1>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              An unexpected error occurred in Zboxy.
            </p>
            <div style={{
              backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem',
              padding: '1rem', marginBottom: '1.5rem', textAlign: 'left',
              overflow: 'auto', maxHeight: '8rem',
            }}>
              <code style={{ fontSize: '0.875rem', color: '#b91c1c', wordBreak: 'break-all' }}>{error.message}</code>
            </div>
            <button
              onClick={reset}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: '#059669', color: 'white',
                border: 'none', borderRadius: '0.5rem',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
