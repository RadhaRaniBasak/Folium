import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button, Spinner } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { AuthLayout, Field, FormError } from './AuthLayout';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Folium workspace"
      footer={
        <>
          No account?{' '}
          <Link to="/register" className="font-semibold text-strong hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormError message={error} />
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="••••••••"
        />
        <Button
          type="submit"
          variant="primary"
          className="mt-2 h-10 w-full text-[14px]"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Spinner className="border-white/30 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900" />
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
