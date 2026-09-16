'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<'creer' | 'rejoindre'>('creer');
  const [companyName, setCompanyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // company_name / invite_code / full_name partent dans les metadata
    // Supabase Auth : le trigger SQL handle_new_user() s'en sert pour soit
    // créer une nouvelle organisation (mode "creer"), soit rattacher la
    // personne à l'organisation correspondant au code (mode "rejoindre").
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data:
          mode === 'creer'
            ? { company_name: companyName, full_name: fullName }
            : { invite_code: inviteCode.trim(), full_name: fullName },
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
          <h2 style={{ marginTop: 0 }}>
            {mode === 'creer' ? 'Créer votre espace entreprise' : 'Rejoindre votre entreprise'}
          </h2>
          <p style={{ color: 'var(--text-mid)', fontSize: '0.9rem', marginTop: '-8px' }}>
            {mode === 'creer'
              ? 'Vos données seront visibles uniquement par les membres de votre entreprise.'
              : "Demandez le code d'invitation à l'administrateur de votre entreprise."}
          </p>

          <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
            <button
              type="button"
              className={mode === 'creer' ? '' : 'secondary'}
              onClick={() => setMode('creer')}
              style={{ flex: 1 }}
            >
              Créer une entreprise
            </button>
            <button
              type="button"
              className={mode === 'rejoindre' ? '' : 'secondary'}
              onClick={() => setMode('rejoindre')}
              style={{ flex: 1 }}
            >
              Rejoindre avec un code
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'creer' ? (
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
            ) : (
              <div className="field">
                <label>Code d'invitation</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="ex. a1b2c3d4"
                  required
                />
              </div>
            )}
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
              {loading ? 'Création en cours…' : mode === 'creer' ? 'Créer mon compte' : 'Rejoindre l\'entreprise'}
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
