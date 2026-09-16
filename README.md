# SOURA DIGITAL — CRM BTP multi-clients

Point de départ du CRM que tu vas vendre à plusieurs entreprises BTP.
Chaque entreprise qui s'inscrit a ses propres données, invisibles pour
les autres — c'est géré au niveau de la base de données (Row Level
Security), pas seulement dans le code de l'application.

## Ce qui est déjà fonctionnel
- Inscription : une entreprise s'inscrit → son organisation est créée
  automatiquement, avec elle comme administrateur.
- Connexion / déconnexion.
- Tableau de bord avec les chiffres clés (chantiers, budget cumulé…).
- Module **Chantiers & planning** : créer et lister les chantiers.
- Les 8 autres modules (DQE/Devis, Budget, Achats, Stock, RH,
  Prestataires, Engins, Rapports) sont dans le menu, en `Bientôt
  disponible` — on les construit un par un ensuite.

## Étape 1 — Créer le projet Supabase
1. Va sur supabase.com et crée un nouveau projet (choisis un nom
   différent de `soura-btp` et `soura-suite`, par ex. `soura-digital`).
2. Dans l'onglet **SQL Editor**, colle le contenu du fichier
   `supabase/schema.sql` et exécute-le. Ça crée les tables et met en
   place l'isolation des données entre entreprises.
3. Dans **Project Settings → API**, récupère :
   - `Project URL`
   - `anon public key`

## Étape 2 — Configurer le projet
1. Copie `.env.example` en `.env.local`.
2. Remplace les deux valeurs par celles de ton projet Supabase.

## Étape 3 — Tester en local
```
npm install
npm run dev
```
Ouvre http://localhost:3000 — tu arrives sur la page de connexion.
Crée un premier compte via "Créer une entreprise" pour tester.

## Étape 4 — Mettre en ligne
1. Pousse ce dossier sur un nouveau dépôt GitHub (distinct de
   `soura-btp-crm` et `SOURA-SUITE`).
2. Sur vercel.com, importe ce dépôt.
3. Dans les réglages du projet Vercel, ajoute les deux variables
   d'environnement (`NEXT_PUBLIC_SUPABASE_URL` et
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Déploie.

## Vérifier que l'isolation des données fonctionne
Le test le plus important avant de vendre l'outil : crée deux comptes
avec deux noms d'entreprise différents, connecte-toi avec chacun, et
vérifie qu'un compte ne voit jamais les chantiers créés par l'autre.

## Prochaine étape
Une fois ce socle validé en ligne, on construit le module suivant —
je conseille **DQE / Devis / Factures**, car c'est ce qui te permet
de commencer à démontrer la valeur de l'outil à un premier client
BTP payant.
