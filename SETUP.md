# Activer la connexion et la sauvegarde en ligne (gratuit)

1. Va sur https://supabase.com → **Start your project** → crée un compte → **New project** (nom libre, choisis un mot de passe, région proche). Attends 1-2 minutes.
2. Menu **SQL Editor** → **New query** → colle tout le contenu de `supabase.sql` → **Run**.
3. Menu **Project Settings → API** : copie **Project URL** et la clé **anon public**.
4. Dans ce dépôt GitHub, ouvre `config.js`, clique sur le crayon ✎, colle les 2 valeurs entre les guillemets, puis **Commit changes**.
5. Menu **Authentication → URL Configuration** de Supabase : dans **Site URL**, mets le lien de ton site (ex : `https://fortnite3882-bot.github.io/compta-association/`).
6. (Optionnel) **Authentication → Providers → Email** : désactive « Confirm email » si tu ne veux pas valider par e-mail à l'inscription.
7. Ouvre le site, clique **Créer mon compte**. Ensuite tu te connectes avec le même e-mail depuis n'importe quel appareil et tu retrouves tout.

Sécurité : la clé « anon » est publique par conception. Ce sont les règles de `supabase.sql` (RLS) qui empêchent un utilisateur de lire les données d'un autre. Ne mets **jamais** la clé « service_role » dans le dépôt.

## Pièces jointes des factures
Dans Supabase > **SQL Editor** > **New query**, colle le contenu de `supabase-fichiers.sql` puis **Run** (une seule fois). Les fichiers sont privés : seul ton compte peut les ouvrir.
