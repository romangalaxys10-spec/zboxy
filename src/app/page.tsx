'use client';

import { useZboxyStore } from '@/lib/zboxy-store';
import LoginPage from '@/components/zboxy/login-page';
import DriveLayout from '@/components/zboxy/drive-layout';

export default function Home() {
  const user = useZboxyStore(s => s.user);

  if (!user) return <LoginPage />;
  return <DriveLayout />;
}