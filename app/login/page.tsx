'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const desactive = searchParams.get('desactive') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError('E-mail ou mot de passe incorrect.');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="auth-shell">
      <div className="auth-box">
        <div className="brand">SOURA <span>DIGITAL</span></div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Connexion</h2>
          {desactive && (
            <div className="error" style={{ marginBottom: 12 }}>
              Votre accès a été désactivé par l'administrateur de votre entreprise. Contactez-le pour plus d'informations.
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <div className="error">{error}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
          <p style={{ marginTop: 18, fontSize: '0.85rem', color: 'var(--text-mid)' }}>
            Pas encore de compte ? <a href="/signup" style={{ color: 'var(--gold)' }}>Créer une entreprise</a>
          </p>
        </div>
      </div>
    </div>
  );
}
