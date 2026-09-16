'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // company_name et full_name partent dans les metadata Supabase Auth :
    // le trigger SQL handle_new_user() s'en sert pour créer
    // automatiquement l'organisation (l'entreprise cliente) et le profil admin.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          company_name: companyName,
          full_name: fullName,
        },
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="auth-shell">
      <div className="auth-box">
        <div className="brand">SOURA <span>DIGITAL</span></div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Créer votre espace entreprise</h2>
          <p style={{ color: 'var(--text-mid)', fontSize: '0.9rem', marginTop: '-8px' }}>
            Vos données seront visibles uniquement par les membres de votre entreprise.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Nom de l'entreprise</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="ex. SOURA BTP ET PRESTATIONS"
                required
              />
            </div>
            <div className="field">
              <label>Votre nom</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
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
                minLength={8}
                required
              />
            </div>
            {error && <div className="error">{error}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Création en cours…' : 'Créer mon compte'}
            </button>
          </form>
          <p style={{ marginTop: 18, fontSize: '0.85rem', color: 'var(--text-mid)' }}>
            Déjà un compte ? <a href="/login" style={{ color: 'var(--gold)' }}>Se connecter</a>
          </p>
        </div>
      </div>
    </div>
  );
}
