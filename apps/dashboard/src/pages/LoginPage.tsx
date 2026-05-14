import { FormEvent, useState } from 'react';
import { Lock, User2 } from 'lucide-react';
import { useBestContext } from '../contexts/best-context';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';

export function LoginPage() {
  const { login } = useBestContext();
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('Best@123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch {
      setError('ورود ناموفق بود. اطلاعات را بررسی کنید.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.15),transparent_45%)]" />
      <div className="relative flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">ورود به پنل مدیریت BEST</CardTitle>
            <CardDescription>حساب کاربری خود را برای ورود وارد کنید.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="relative">
                <User2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="نام کاربری" className="pr-9" />
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز عبور" className="pr-9" />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button className="w-full" disabled={loading}>
                {loading ? 'در حال ورود...' : 'ورود'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}