'use client';

import { useEffect, useState } from 'react';
import { useZboxyStore } from '@/lib/zboxy-store';
import LoginPage from '@/components/zboxy/login-page';
import DriveLayout from '@/components/zboxy/drive-layout';

export default function Home() {
  const user = useZboxyStore(s => s.user);
  const token = useZboxyStore(s => s.token);
  const setUser = useZboxyStore(s => s.setUser);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Auto-restore session from token on mount
  useEffect(() => {
    if (!user && token) {
      fetch('/api/zboxy/auth/me', { headers: { 'x-zboxy-token': token } })
        .then(r => r.ok ? r.json() : null)
        .then(u => { if (u) setUser(u); })
        .catch(() => {});
    }
  }, [user, token, setUser]);

  // Prevent hydration mismatch - wait for client mount
  if (!hydrated) return null;

  if (!user) return <LoginPage />;
  return <DriveLayout />;
}