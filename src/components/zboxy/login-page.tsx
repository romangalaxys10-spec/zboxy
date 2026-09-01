'use client';

import { useState } from 'react';
import { useZboxyStore } from '@/lib/zboxy-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster, toast } from 'sonner';
import {
  Box, KeyRound, UserPlus, LogIn, Copy, Check, FolderOpen,
  Sparkles, ArrowRight, Github, ExternalLink, Zap, Shield, HardDrive,
  FileText, Table2, Presentation, Music, Share2, Brain, ChevronRight,
} from 'lucide-react';

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
      if (!res.ok) { toast.error(data.error); return; }
      setNewToken(data.token);
      setToken(data.token);
      setUser(data);
      toast.success(`Welcome to Zboxy, ${data.name}!`);
    } catch { toast.error('Failed to create account'); }
    finally { setRegistering(false); }
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
      if (!res.ok) { toast.error(data.error); return; }
      setToken(data.token);
      setUser(data);
      toast.success(`Welcome back, ${data.name}!`);
    } catch { toast.error('Failed to login'); }
    finally { setLoggingIn(false); }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (newToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4 relative overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 w-full max-w-lg">
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl shadow-lg shadow-emerald-500/20 mb-4">
                <FolderOpen className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-white tracking-tight">Your Access Token</h2>
              <p className="text-sm text-white/50 mt-2 leading-relaxed">Save this token securely. It is your only key to access your drive.</p>
            </div>

            <div className="bg-black/40 border border-white/[0.06] rounded-2xl p-4 mb-4">
              <code className="text-emerald-400 font-mono text-xs break-all leading-relaxed select-all block">{newToken}</code>
            </div>

            <Button
              onClick={copyToken}
              className={`w-full h-12 rounded-xl text-sm font-medium transition-all duration-300 ${copied
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-white text-black hover:bg-white/90'
              }`}
              variant={copied ? "outline" : "default"}
            >
              {copied ? <><Check className="w-4 h-4 mr-2" /> Copied to Clipboard</> : <><Copy className="w-4 h-4 mr-2" /> Copy Token</>}
            </Button>

            <p className="text-xs text-center text-white/30 mt-4">Your drive is ready. Start uploading or creating documents.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden">
      <Toaster richColors position="top-center" />

      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-emerald-500/[0.07] via-teal-500/[0.03] to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-tl from-violet-500/[0.04] to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '48px 48px' }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col min-h-screen">

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center">
              <Box className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Zboxy</span>
          </div>
          <a
            href="https://github.com/rommarkdev/zboxy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.04]"
          >
            <Github className="w-4 h-4" />
            <span className="hidden sm:inline">Star on GitHub</span>
          </a>
        </header>

        {/* Center: two-column layout */}
        <div className="flex-1 flex items-center justify-center px-6 pb-8">
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: Hero copy */}
            <div className="space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/[0.05] border border-white/[0.08] rounded-full px-4 py-1.5 text-xs text-white/60">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Entirely built by GLM 5 Turbo
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1]">
                Your files.{' '}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                Your rules.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-white/50 leading-relaxed max-w-lg mx-auto lg:mx-0">
                A free, unlimited cloud drive with built-in document, spreadsheet, and presentation editors. No email. No limits. No compromises.
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-2 pt-2">
                {[
                  { icon: FileText, label: 'Rich Docs', color: 'text-blue-400' },
                  { icon: Table2, label: 'Spreadsheets', color: 'text-emerald-400' },
                  { icon: Presentation, label: 'Slides', color: 'text-orange-400' },
                  { icon: Music, label: 'Music Box', color: 'text-pink-400' },
                  { icon: Share2, label: 'Share Links', color: 'text-violet-400' },
                  { icon: Brain, label: 'AI Slides', color: 'text-cyan-400' },
                ].map(f => (
                  <span key={f.label} className="inline-flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1.5 text-xs text-white/60">
                    <f.icon className={`w-3.5 h-3.5 ${f.color}`} />
                    {f.label}
                  </span>
                ))}
              </div>

              {/* Live demo link */}
              <div className="pt-2">
                <a
                  href="https://zboxy.space-z.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Live Demo: zboxy.space-z.ai
                </a>
              </div>
            </div>

            {/* Right: Auth card */}
            <div>
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl shadow-lg shadow-emerald-500/15 mb-3">
                    <Box className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight">Get Started</h2>
                  <p className="text-sm text-white/40 mt-1">No email required. Just a name.</p>
                </div>

                <Tabs defaultValue="register" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-white/[0.04] border border-white/[0.06] rounded-xl h-11 p-1">
                    <TabsTrigger value="register" className="rounded-lg text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm transition-all">
                      <UserPlus className="w-3.5 h-3.5" /> New Account
                    </TabsTrigger>
                    <TabsTrigger value="login" className="rounded-lg text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm transition-all">
                      <KeyRound className="w-3.5 h-3.5" /> Login
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="register" className="space-y-3 mt-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-white/60">Your Name</label>
                      <Input
                        placeholder="Enter your name..."
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                        className="h-11 bg-white/[0.04] border-white/[0.08] rounded-xl text-white placeholder:text-white/25 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                      />
                    </div>
                    <Button
                      onClick={handleRegister}
                      disabled={registering || !name.trim()}
                      className="w-full h-11 rounded-xl bg-white text-black hover:bg-white/90 font-medium text-sm gap-2 transition-all"
                    >
                      {registering ? 'Creating...' : <><UserPlus className="w-4 h-4" /> Create Account</>}
                    </Button>
                  </TabsContent>

                  <TabsContent value="login" className="space-y-3 mt-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-white/60">Access Token</label>
                      <Input
                        placeholder="Paste your token here..."
                        value={token}
                        onChange={(e) => setLocalToken(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        className="h-11 bg-white/[0.04] border-white/[0.08] rounded-xl text-white font-mono text-sm placeholder:text-white/25 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                      />
                    </div>
                    <Button
                      onClick={handleLogin}
                      disabled={loggingIn || !token.trim()}
                      className="w-full h-11 rounded-xl bg-white text-black hover:bg-white/90 font-medium text-sm gap-2 transition-all"
                    >
                      {loggingIn ? 'Logging in...' : <><LogIn className="w-4 h-4" /> Login</>}
                    </Button>
                  </TabsContent>
                </Tabs>

                <div className="mt-5 pt-4 border-t border-white/[0.06] text-center">
                  <p className="text-[11px] text-white/30">Free &amp; unlimited. No email. Your files, your control.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom footer */}
        <footer className="relative z-10 px-6 pb-6 pt-4">
          <div className="max-w-5xl mx-auto space-y-4">

            {/* GLM 5 Turbo banner */}
            <a
              href="https://z.ai/subscribe?ic=R0K78RJKNW"
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500/[0.08] via-teal-500/[0.06] to-cyan-500/[0.08] border border-emerald-500/20 rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5">
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <Brain className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">Built with Z.AI GLM 5 Turbo</span>
                        <span className="text-[10px] font-medium bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">10% OFF</span>
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">This entire app was AI-generated from scratch by GLM 5 Turbo</p>
                    </div>
                  </div>
                  <div className="sm:ml-auto flex items-center gap-2 text-sm text-emerald-400 group-hover:text-emerald-300 transition-colors shrink-0">
                    <span className="text-xs font-medium">Try GLM Coding Plan</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </a>

            {/* GitHub + Credits row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              {/* GitHub badge */}
              <a
                href="https://github.com/rommarkdev/zboxy"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-2 text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all"
              >
                <Github className="w-4 h-4" />
                <span>Support on GitHub</span>
                <ChevronRight className="w-3 h-3" />
              </a>

              {/* Developer credits */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/25">
                <span className="text-white/40 font-medium">Developed by Roman</span>
                <a href="https://t.me/VibeCodePrompterSystem" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">Telegram: @VibeCodePrompterSystem</a>
                <a href="https://www.linkedin.com/in/r%D0%BEman-m-793b3310/" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">LinkedIn</a>
                <a href="https://www.rommark.dev" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">rommark.dev</a>
                <a href="https://claw.rommark.dev" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">LLM Blog</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
