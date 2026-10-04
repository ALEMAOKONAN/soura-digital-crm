// Secteurs d'activité proposés à l'inscription. La clé est stockée en
// base (organizations.secteur) ; "modulesMasques" liste les modules
// (par leur href) qui n'ont pas lieu d'être affichés pour ce secteur.
export const SECTEURS = [
  { value: 'general', label: 'BTP général / Multi-activités', modulesMasques: [] as string[] },
  { value: 'gros_oeuvre', label: 'Gros œuvre', modulesMasques: [] as string[] },
  { value: 'electricite', label: 'Électricité', modulesMasques: ['/dashboard/engins'] },
  { value: 'plomberie', label: 'Plomberie', modulesMasques: ['/dashboard/engins'] },
  { value: 'vrd', label: 'VRD / Terrassement', modulesMasques: [] as string[] },
  { value: 'peinture', label: 'Peinture / Finition', modulesMasques: ['/dashboard/engins'] },
  { value: 'autre', label: 'Autre', modulesMasques: [] as string[] },
];

export function labelSecteur(value: string) {
  return SECTEURS.find((s) => s.value === value)?.label ?? value;
}

export function modulesMasquesPourSecteur(value: string): string[] {
  return SECTEURS.find((s) => s.value === value)?.modulesMasques ?? [];
}
