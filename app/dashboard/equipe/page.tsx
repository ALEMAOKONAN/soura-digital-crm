'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Copy, Check, ShieldCheck, ShieldOff, UserX, UserCheck } from 'lucide-react';
import { useToast } from '@/lib/toast';
import Spinner from '../../components/spinner';
import { domainePourSecteur } from '@/lib/secteurs';

type Membre = { id: string; full_name: string | null; role: string; actif: boolean; pharmacie_role: string | null };

const ROLE_LABEL: Record<string, string> = { admin: 'Administrateur', membre: 'Membre' };
const PHARMACIE_ROLE_LABEL: Record<string, string> = {
  caisse: 'Caisse',
  stock: 'Stock',
  commande: 'Chargé(e) de commande',
};

export default function EquipePage() {
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [monId, setMonId] = useState<string | null>(null);
  const [monRole, setMonRole] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [domaine, setDomaine] = useState<'btp' | 'pharmacie'>('btp');
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

    // La page Équipe est réservée aux administrateurs ; un employé qui
    // tape directement l'URL est renvoyé vers son tableau de bord.
    if (monProfil?.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }

    setMonId(user!.id);
    setMonRole(monProfil?.role ?? null);
    setOrganizationId(monProfil?.organization_id ?? null);

    const [{ data: org }, { data: profils }] = await Promise.all([
      supabase.from('organizations').select('invite_code, secteur').eq('id', monProfil!.organization_id).single(),
      supabase
        .from('profiles')
        .select('id, full_name, role, actif, pharmacie_role')
        .eq('organization_id', monProfil!.organization_id),
    ]);

    setInviteCode(org?.invite_code ?? null);
    setDomaine(domainePourSecteur(org?.secteur ?? 'general'));
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

  async function changerPharmacieRole(membre: Membre, nouveauPharmacieRole: string | null) {
    const { error } = await supabase.from('profiles').update({ pharmacie_role: nouveauPharmacieRole }).eq('id', membre.id);
    if (error) {
      showToast('error', "Impossible de modifier l'accès pharmacie de ce membre.");
      return;
    }
    showToast(
      'success',
      nouveauPharmacieRole
        ? `${membre.full_name || 'Membre'} est maintenant habilité "${PHARMACIE_ROLE_LABEL[nouveauPharmacieRole]}".`
        : `Accès pharmacie retiré pour ${membre.full_name || 'ce membre'}.`
    );
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
            {domaine === 'pharmacie' && <th>Accès pharmacie</th>}
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
                {domaine === 'pharmacie' && (
                  <td>
                    {m.role === 'admin' ? (
                      <span style={{ color: 'var(--text-mid)', fontSize: '0.85rem' }}>Accès complet</span>
                    ) : monRole === 'admin' && !cestMoi ? (
                      <select
                        value={m.pharmacie_role ?? ''}
                        onChange={(e) => changerPharmacieRole(m, e.target.value || null)}
                      >
                        <option value="">Aucun accès</option>
                        <option value="caisse">Caisse</option>
                        <option value="stock">Stock</option>
                        <option value="commande">Chargé(e) de commande</option>
                      </select>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: m.pharmacie_role ? 'var(--text-hi)' : 'var(--text-mid)' }}>
                        {m.pharmacie_role ? PHARMACIE_ROLE_LABEL[m.pharmacie_role] ?? m.pharmacie_role : 'Aucun accès'}
                      </span>
                    )}
                  </td>
                )}
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
