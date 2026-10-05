// Secteurs d'activité proposés à l'inscription. La clé est stockée en
// base (organizations.secteur). "domaine" détermine quel ensemble de
// modules métier l'entreprise voit dans son tableau de bord : les
// modules BTP pour un domaine 'btp', le module Pharmacie pour un
// domaine 'pharmacie', etc. Les modules communs (tableau de bord,
// équipe) restent toujours visibles quel que soit le domaine.
export type Domaine = 'btp' | 'pharmacie';

export const SECTEURS: { value: string; label: string; domaine: Domaine }[] = [
  { value: 'general', label: 'BTP général / Multi-activités', domaine: 'btp' },
  { value: 'gros_oeuvre', label: 'BTP général — Gros œuvre', domaine: 'btp' },
  { value: 'electricite', label: 'BTP général — Électricité', domaine: 'btp' },
  { value: 'plomberie', label: 'BTP général — Plomberie', domaine: 'btp' },
  { value: 'vrd', label: 'BTP général — VRD / Terrassement', domaine: 'btp' },
  { value: 'peinture', label: 'BTP général — Peinture / Finition', domaine: 'btp' },
  { value: 'pharmacie', label: 'Pharmacie', domaine: 'pharmacie' },
  { value: 'autre', label: 'Autre', domaine: 'btp' },
];

export function labelSecteur(value: string) {
  return SECTEURS.find((s) => s.value === value)?.label ?? value;
}

export function domainePourSecteur(value: string): Domaine {
  return SECTEURS.find((s) => s.value === value)?.domaine ?? 'btp';
}
