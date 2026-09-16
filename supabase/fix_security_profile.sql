-- CORRECTIF DE SÉCURITÉ CRITIQUE
-- À exécuter avant toute mise en ligne réelle.
--
-- Problème : la policy RLS "modifier son propre profil" ne vérifiait
-- que l'identité (id = auth.uid()), pas les colonnes modifiées.
-- Un utilisateur pouvait donc changer son organization_id pour
-- rejoindre les données d'une autre entreprise cliente, et/ou se
-- donner le rôle "admin". Ce correctif bloque ces deux colonnes au
-- niveau de la base de données, quel que soit le chemin emprunté
-- (RLS contournée, bug applicatif, appel API direct...).

create or replace function empecher_escalade_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Modification de organization_id non autorisée';
  end if;
  if new.role is distinct from old.role then
    raise exception 'Modification de role non autorisée';
  end if;
  return new;
end;
$$;

drop trigger if exists verrouiller_organization_et_role on profiles;
create trigger verrouiller_organization_et_role
  before update on profiles
  for each row execute function empecher_escalade_privileges();
