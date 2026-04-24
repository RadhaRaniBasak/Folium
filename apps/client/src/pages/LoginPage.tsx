import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>🌿 Folium</h1>
        <h2 style={styles.heading}>Sign in</h2>

        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleSubmit} noValidate>
          <label style={styles.label}>
            Email
            <input
              type="email"
              style={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              type="password"
              style={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          <button type="submit" style={styles.button} disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={styles.footer}>
          No account?{' '}
          <Link to="/register" style={styles.link}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f0',
    fontFamily: 'sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: 8,
    padding: '2.5rem',
    width: '100%',
    maxWidth: 380,
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  logo: {
    margin: '0 0 0.5rem',
    fontSize: '1.5rem',
    textAlign: 'center' as const,
  },
  heading: {
    margin: '0 0 1.5rem',
    fontSize: '1.25rem',
    fontWeight: 600,
    textAlign: 'center' as const,
    color: '#222',
  },
  error: {
    color: '#c0392b',
    background: '#fdf0ee',
    borderRadius: 4,
    padding: '0.5rem 0.75rem',
    marginBottom: '1rem',
    fontSize: '0.875rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    marginBottom: '1rem',
    fontSize: '0.875rem',
    color: '#444',
    fontWeight: 500,
  },
  input: {
    padding: '0.55rem 0.75rem',
    borderRadius: 4,
    border: '1px solid #ccc',
    fontSize: '0.95rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  button: {
    marginTop: '0.5rem',
    width: '100%',
    padding: '0.65rem',
    background: '#2d6a4f',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  footer: {
    marginTop: '1.5rem',
    textAlign: 'center' as const,
    fontSize: '0.875rem',
    color: '#666',
  },
  link: {
    color: '#2d6a4f',
    textDecoration: 'none',
    fontWeight: 600,
  },
};
