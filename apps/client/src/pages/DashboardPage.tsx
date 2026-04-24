import { useAuth } from '../contexts/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.logo}>🌿 Folium</span>
        <button onClick={logout} style={styles.logoutBtn}>
          Sign out
        </button>
      </header>

      <main style={styles.main}>
        <h1 style={styles.heading}>Welcome, {user?.name ?? 'there'}!</h1>
        <p style={styles.sub}>Your workspace is ready. Pages and documents will appear here.</p>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    fontFamily: 'sans-serif',
    background: '#f5f5f0',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    background: '#fff',
    borderBottom: '1px solid #e0e0da',
  },
  logo: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#2d6a4f',
  },
  logoutBtn: {
    padding: '0.4rem 0.9rem',
    background: 'transparent',
    border: '1px solid #ccc',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#555',
  },
  main: {
    maxWidth: 640,
    margin: '4rem auto',
    padding: '0 1rem',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#222',
    marginBottom: '0.5rem',
  },
  sub: {
    color: '#666',
    fontSize: '1rem',
  },
};
