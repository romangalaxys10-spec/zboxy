'use client';

import { useState } from 'react';
import { useZboxyStore } from '@/lib/zboxy-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster, toast } from 'sonner';
import { Box, KeyRound, UserPlus, LogIn, Copy, Check, FolderOpen } from 'lucide-react';

export default function LoginPage() {
  const { setToken, setUser } = useZboxyStore();
  const [name, setName] = useState('');
  const [token, setLocalToken] = useState('');
  const [registering, setRegistering] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [copied, setCopied] = useState(false);

  const handleRegister = async () => {
    if (!name.trim()) return;
    setRegistering(true);
    try {
      const res = await fetch('/api/zboxy/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      setNewToken(data.token);
      setToken(data.token);
      setUser(data);
      toast.success(`Welcome to Zboxy, ${data.name}!`);
    } catch {
      toast.error('Failed to create account');
    } finally {
      setRegistering(false);
    }
  };

  const handleLogin = async () => {
    if (!token.trim()) return;
    setLoggingIn(true);
    try {
      const res = await fetch('/api/zboxy/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      setToken(data.token);
      setUser(data);
      toast.success(`Welcome back, ${data.name}!`);
    } catch {
      toast.error('Failed to login');
    } finally {
      setLoggingIn(false);
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (newToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
              <FolderOpen className="w-8 h-8 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl">Your Zboxy Token</CardTitle>
            <CardDescription>Save this token to log in anytime. This is the only time you will see it!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-lg break-all select-all leading-relaxed">
              {newToken}
            </div>
            <Button onClick={copyToken} className="w-full" variant={copied ? "outline" : "default"}>
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy Token'}
            </Button>
            <p className="text-xs text-center text-slate-500">Your drive is ready. Start uploading files or create new documents!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Toaster richColors position="top-center" />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Box className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Zboxy</CardTitle>
          <CardDescription className="text-base">Your free, unlimited cloud drive with built-in office editors</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="register" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="register" className="gap-1.5"><UserPlus className="w-3.5 h-3.5" /> New Account</TabsTrigger>
              <TabsTrigger value="login" className="gap-1.5"><KeyRound className="w-3.5 h-3.5" /> Login</TabsTrigger>
            </TabsList>
            <TabsContent value="register" className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Name</label>
                <Input
                  placeholder="Enter your name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                  className="h-11"
                />
              </div>
              <Button onClick={handleRegister} disabled={registering || !name.trim()} className="w-full h-11 gap-2">
                {registering ? 'Creating...' : <><UserPlus className="w-4 h-4" /> Create Account & Get Token</>}
              </Button>
            </TabsContent>
            <TabsContent value="login" className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Token</label>
                <Input
                  placeholder="Paste your token here..."
                  value={token}
                  onChange={(e) => setLocalToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="h-11 font-mono text-sm"
                />
              </div>
              <Button onClick={handleLogin} disabled={loggingIn || !token.trim()} className="w-full h-11 gap-2">
                {loggingIn ? 'Logging in...' : <><LogIn className="w-4 h-4" /> Login with Token</>}
              </Button>
            </TabsContent>
          </Tabs>
          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-xs text-slate-500">Free & unlimited storage. No email required. Your files, your control.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}