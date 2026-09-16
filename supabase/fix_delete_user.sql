-- Correctif : les colonnes "created_by" bloquaient la suppression d'un
-- utilisateur (et donc de son profil) car elles référençaient son profil
-- sans autoriser Postgres à détacher ce lien. On les remplace par des
-- contraintes "on delete set null" : le lien disparaît, l'enregistrement reste.

alter table chantiers drop constraint if exists chantiers_created_by_fkey;
alter table chantiers add constraint chantiers_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table devis drop constraint if exists devis_created_by_fkey;
alter table devis add constraint devis_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table depenses drop constraint if exists depenses_created_by_fkey;
alter table depenses add constraint depenses_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table achats drop constraint if exists achats_created_by_fkey;
alter table achats add constraint achats_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;
