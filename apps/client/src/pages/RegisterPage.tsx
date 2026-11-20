import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button, Spinner } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { AuthLayout, Field, FormError } from './AuthLayout';

export function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Use at least 8 characters for your password');
      return;
    }
    setIsSubmitting(true);
    try {
      await register({ name, email, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Notes, docs and plans — edited together, live"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-strong hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormError message={error} />
        <Field
          label="Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          autoFocus
          placeholder="Ada Lovelace"
        />
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
          placeholder="At least 8 characters"
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
            'Create account'
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
