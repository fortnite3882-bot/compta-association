# Compta Asso

Outil simple pour suivre les comptes d'une association : **par année, par action, par financeur**, avec le **budget prévisionnel vs réel**, les **conventions signées** (qui changent chaque année) et **chaque facture réglée** (montant + à qui).

Modèle de départ : le plan budgétaire (charges 60–68 / 86, produits 70–78 / 87) du fichier `Suivi trésorerie`.

## Utiliser
Ouvre `index.html` dans un navigateur (aucune installation). Ou active **GitHub Pages** (Settings → Pages → branche `main`, dossier `/`) pour l'utiliser en ligne.

## Pages
- **Tableau de bord** : dépensé / prévu, recettes, reste à encaisser, conventions par financeur, alertes.
- **Budget prév. / réel** : saisie du prévisionnel par action et par poste ; le réel se calcule tout seul depuis les factures et recettes.
- **Factures payées** : une ligne par facture (date, payé à, n°, montant, catégorie, action, convention imputée), recherche, filtres, export CSV.
- **Recettes** : versements / acomptes des financeurs, cotisations, ventes.
- **Conventions** : financeur × action × année, montant accordé, versé, dépensé imputé, reste. Bouton « Reconduire » vers l'année suivante.
- **Financeurs / Actions / Paramètres** (années, sauvegarde JSON, import).

## Données
Stockées dans le navigateur (localStorage). Exporte régulièrement un JSON (Paramètres). Ne jamais publier de données réelles dans un dépôt public.
