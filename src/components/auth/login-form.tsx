'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';

function dashboardUrlForRole(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return '/admin';
    case 'MANAGE':
      return '/manage';
    case 'DRIVER':
      return '/driver';
    default:
      return '/sales';
  }
}

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    let res: Response;
    let data: Record<string, string> = {};
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      data = await res.json();
    } catch {
      setError('Terjadi kesalahan jaringan, coba lagi');
      setLoading(false);
      return;
    }

    if (!res.ok) {
      setError(data.error || 'Username atau password salah');
      setLoading(false);
      return;
    }

    router.push(dashboardUrlForRole(data.role));
    router.refresh();
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[44%] bg-sidebar flex-col justify-between p-14 relative overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full pointer-events-none"
          style={{ background: 'oklch(1 0 0 / 0.04)' }}
        />
        <div
          className="absolute -bottom-28 -right-20 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{ background: 'oklch(1 0 0 / 0.04)' }}
        />

        <div className="relative z-10">
          <Image src="/logo.png" alt="Millenials Farm" width={44} height={44} className="mb-10" />
          <h1
            className="text-[3.25rem] leading-[1.15] text-sidebar-primary"
            style={{ fontFamily: 'var(--font-dm-serif)' }}
          >
            Millenials<br />Farm
          </h1>
          <p
            className="mt-5 text-sm leading-relaxed max-w-[260px]"
            style={{ color: 'oklch(0.92 0 0 / 0.50)' }}
          >
            Sistem manajemen penjualan hewan qurban berkualitas — kambing, domba, dan sapi pilihan terbaik.
          </p>
        </div>

        <div className="relative z-10 text-xs" style={{ color: 'oklch(0.92 0 0 / 0.28)' }}>
          © {new Date().getFullYear()} Millenials Farm
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col justify-center items-center bg-background px-6 py-16">
        <div className="w-full max-w-[340px]">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <Image src="/logo.png" alt="Millenials Farm" width={36} height={36} />
            <span className="text-xl" style={{ fontFamily: 'var(--font-dm-serif)' }}>
              Millenials Farm
            </span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Masuk</h2>
            <p className="text-muted-foreground text-sm mt-1">Masuk ke dashboard pengelolaan</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk'}
            </Button>
          </form>

          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Website
          </Link>
        </div>
      </div>
    </div>
  );
}
