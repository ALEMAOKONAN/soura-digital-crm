'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Copy, Check, ShieldCheck, ShieldOff, UserX, UserCheck } from 'lucide-react';
import { useToast } from '@/lib/toast';
import Spinner from '../../components/spinner';

type Membre = { id: string; full_name: string | null; role: string; actif: boolean };

const ROLE_LABEL: Record<string, string> = { admin: 'Administrateur', membre: 'Membre' };

export default function EquipePage() {
  const supabase = createClient();
  const { showToast } = useToast();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [monId, setMonId] = useState<string | null>(null);
  const [monRole, setMonRole] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copie, setCopie] = useState(false);

  async function chargerTout() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: monProfil } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user!.id)
      .single();

    setMonId(user!.id);
    setMonRole(monProfil?.role ?? null);
    setOrganizationId(monProfil?.organization_id ?? null);

    const [{ data: org }, { data: profils }] = await Promise.all([
      supabase.from('organizations').select('invite_code').eq('id', monProfil!.organization_id).single(),
      supabase.from('profiles').select('id, full_name, role, actif').eq('organization_id', monProfil!.organization_id),
    ]);

    setInviteCode(org?.invite_code ?? null);
    setMembres(profils ?? []);
    setLoading(false);
  }

  useEffect(() => {
    chargerTout();
  }, []);

  function copierLeCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopie(true);
    showToast('success', 'Code copié.');
    setTimeout(() => setCopie(false), 2000);
  }

  async function changerRole(membre: Membre, nouveauRole: string) {
    const { error } = await supabase.from('profiles').update({ role: nouveauRole }).eq('id', membre.id);
    if (error) {
      showToast('error', "Impossible de modifier le rôle.");
      return;
    }
    showToast('success', `${membre.full_name || 'Membre'} est maintenant ${ROLE_LABEL[nouveauRole].toLowerCase()}.`);
    chargerTout();
  }

  async function changerStatut(membre: Membre, nouveauStatut: boolean) {
    const { error } = await supabase.from('profiles').update({ actif: nouveauStatut }).eq('id', membre.id);
    if (error) {
      showToast('error', "Impossible de modifier l'accès de ce membre.");
      return;
    }
    showToast('success', nouveauStatut ? `${membre.full_name || 'Membre'} réactivé.` : `${membre.full_name || 'Membre'} désactivé.`);
    chargerTout();
  }

  if (loading) return <Spinner label="Chargement…" />;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Équipe</h1>
      <p style={{ color: 'var(--text-mid)' }}>
        Gère les membres qui ont accès aux données de ton entreprise.
      </p>

      {monRole === 'admin' && inviteCode && (
        <div className="card" style={{ marginTop: 20, maxWidth: 480 }}>
          <h3 style={{ marginTop: 0 }}>Inviter un collègue</h3>
          <p style={{ color: 'var(--text-mid)', fontSize: '0.9rem' }}>
            Partage ce code. À l'inscription, il devra choisir "Rejoindre avec un code" et le saisir pour accéder aux données de ton entreprise.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div
              style={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: '1.3rem',
                letterSpacing: '0.1em',
                background: 'var(--panel-2)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: '10px 14px',
                color: 'var(--gold)',
              }}
            >
              {inviteCode}
            </div>
            <button className="secondary" onClick={copierLeCode} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {copie ? <Check size={16} /> : <Copy size={16} />}
              {copie ? 'Copié' : 'Copier'}
            </button>
          </div>
        </div>
      )}

      <h3 style={{ marginTop: 32 }}>Membres ({membres.length})</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Rôle</th>
            <th>Statut</th>
            {monRole === 'admin' && <th></th>}
          </tr>
        </thead>
        <tbody>
          {membres.map((m) => {
            const cestMoi = m.id === monId;
            return (
              <tr key={m.id}>
                <td>
                  {m.full_name || '—'} {cestMoi && <span style={{ color: 'var(--text-mid)', fontSize: '0.8rem' }}>(vous)</span>}
                </td>
                <td>{ROLE_LABEL[m.role] ?? m.role}</td>
                <td>
                  <span style={{ color: m.actif ? 'var(--teal)' : 'var(--danger)' }}>
                    {m.actif ? 'Actif' : 'Désactivé'}
                  </span>
                </td>
                {monRole === 'admin' && (
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {!cestMoi && (
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {m.role === 'admin' ? (
                          <button className="secondary" onClick={() => changerRole(m, 'membre')} title="Rétrograder en membre">
                            <ShieldOff size={15} />
                          </button>
                        ) : (
                          <button className="secondary" onClick={() => changerRole(m, 'admin')} title="Promouvoir administrateur">
                            <ShieldCheck size={15} />
                          </button>
                        )}
                        {m.actif ? (
                          <button className="secondary" onClick={() => changerStatut(m, false)} title="Désactiver l'accès" style={{ color: 'var(--danger)' }}>
                            <UserX size={15} />
                          </button>
                        ) : (
                          <button className="secondary" onClick={() => changerStatut(m, true)} title="Réactiver l'accès">
                            <UserCheck size={15} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
