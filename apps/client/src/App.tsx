import { useState, useEffect } from 'react';
import { APP_NAME, ROUTES } from '@shared/constants';
import type { HealthResponse, ApiResponse } from '@shared/types';

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(ROUTES.HEALTH)
      .then((res) => res.json() as Promise<ApiResponse<HealthResponse>>)
      .then((data) => {
        if (data.success && data.data) {
          setHealth(data.data);
        }
      })
      .catch(() => setError('Could not reach the server'));
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>🌿 {APP_NAME}</h1>
      <p>A full-stack monorepo with React + Express sharing TypeScript types.</p>

      <h2>Server Health</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {health ? (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {Object.entries(health).map(([key, value]) => (
              <tr key={key}>
                <td style={{ padding: '4px 8px', fontWeight: 'bold', border: '1px solid #ccc' }}>
                  {key}
                </td>
                <td style={{ padding: '4px 8px', border: '1px solid #ccc' }}>{String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        !error && <p>Loading…</p>
      )}
    </div>
  );
}

export default App;
