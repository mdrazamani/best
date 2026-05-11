import { FormEvent, useState } from 'react';
import { Panel } from '../components/shared/Panel';
import { useBestContext } from '../contexts/best-context';

export function LoginPage() {
  const { login } = useBestContext();
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('Best@123456');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await login(username, password);
    } catch {
      setError('ورود ناموفق بود.');
    }
  };

  return (
    <div className="login-page" dir="rtl">
      <form onSubmit={submit}>
        <Panel>
          <h1>BEST</h1>
          <p>پنل مدیریت حسابداری تولیدی توری</p>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="نام کاربری" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز عبور" />
          <button>ورود</button>
          {error ? <p className="error">{error}</p> : null}
        </Panel>
      </form>
    </div>
  );
}
