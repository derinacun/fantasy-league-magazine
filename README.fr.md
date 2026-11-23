# League Newspaper (journal de ligue)

**Un journal hebdomadaire et un site de stats pour ta ligue de basket fantasy.**
Chaque semaine, ta ligue a sa une : article principal, tableau des scores, classement, classement de puissance, récompenses, ceintures de séries, jeu de pronostics, notes de joueurs, idées d'échange et archives de tous les numéros. Les chiffres sont calculés par le site ; les textes sont écrits par l'IA de ton choix.

Langues : **Français · English · Español · Türkçe** (une langue par site, choisie dans les réglages).
Autres langues : [English](README.md) · [Español](README.es.md) · [Türkçe](README.tr.md)

> **Version 0.1 :** ligues Yahoo Fantasy NBA, face-à-face, 9 catégories (FG%, FT%, 3PT%, PTS, REB, AST, ST, BLK, TO). D'autres sports et types de score sont prévus.

## Ce que tu obtiens

- **Une :** gros titre, tableau des scores, classement, managers endormis, récompenses et ceintures, pronostics, notes de joueurs, tables d'échange.
- **Stats :** classement de puissance indépendant du calendrier, bilan contre tous, évolution hebdomadaire, carte de chaleur, graphiques personnalisés, CSV brut.
- **Podium :** ceintures, séries en cours, ligue du sommeil (« Oreiller d'or »), tableau des médailles.
- **Pronostics :** favoris de la semaine prochaine, carnet de pronostics, chances de playoffs, indice de chance, classement équitable, jeu de pronostics pour les lecteurs.
- **Comparer, Équipes, Joueurs, Tables d'échange, Vitrine des trophées.**
- Archives, image de partage pour chaque page et équipe, mode application sur l'écran d'accueil, notification optionnelle, mise en avant de « mon équipe » (stockée uniquement dans le navigateur du lecteur).

## Comment ça marche

```
Données de la ligue (Excel) ──► scripts → fichiers de données ──► l'IA écrit le numéro ──► GitHub ──► Cloudflare construit et publie
```

Le travail est réparti en trois **rôles**. Chaque fichier se suffit à lui-même et fonctionne avec n'importe quelle IA :

| Rôle | Fichier | Besoin |
|---|---|---|
| Données | [roles/1-DATA.md](roles/1-DATA.md) | Accès à la ligue (un connecteur comme Flaim, ou copie manuelle) |
| Rédaction | [roles/2-WRITER.md](roles/2-WRITER.md) | Fichiers de données, guide de style, export du groupe en option |
| Vérification | [roles/3-CHECKER.md](roles/3-CHECKER.md) | Le numéro terminé |

- **Plusieurs IA :** pour répartir le coût et l'attente (une pour les données, une autre pour l'écriture).
- **Une seule IA :** donne-lui les trois fichiers dans l'ordre.

Le site n'appelle jamais d'IA lui-même et ne coûte rien sur l'offre gratuite de Cloudflare. Les fichiers de rôle sont en anglais ; l'IA écrit le numéro dans la langue du site.

## Démarrage rapide

Il te faut : un compte GitHub, un compte Cloudflare (gratuit), Node.js 22 et Python 3 avec `openpyxl` (ou une IA qui peut exécuter du code).

1. Sur GitHub, « Use this template » (ou fork) pour créer ton dépôt. Garde-le privé si le contenu de ta ligue l'est.
2. Remplis `veri/ayarlar.json` avec `"dil": "fr"`. Tous les réglages sont décrits dans le [README anglais](README.md#settings).
3. Supprime la ligue de démo : mets `"ornekLig": false` dans les réglages (ou supprime la ligne), supprime le dossier `ornek/` et fichiers de `veri/haftalar/`, `veri/kadrolar/`, `veri/gelecek/`, `veri/nba/`, `veri/yahoo-sira/` ; vide `veri/gecmis.json`, `veri/draft.json`, `veri/fikstur.json`.
4. Décris le ton de ta ligue dans `style/STYLE.md`.
5. Prépare ton premier numéro avec [docs/WEEKLY.md](docs/WEEKLY.md).
6. Teste en local : `npm install`, `npm run build`, `npm run preview`.
7. Cloudflare : Workers & Pages → Create → Import a repository → ton dépôt. Commande de build `npm run build`, commande de déploiement `npx wrangler deploy`.
8. Notifications (optionnel) : lance `npm run anahtar` ; la clé publique va dans `veri/ayarlar.json` → `"bildirimAnahtari"`, la clé privée en secret Cloudflare `VAPID_PRIVATE_JWK`.

## Données, droits et vie privée

- Le modèle n'a aucun serveur qui collecte les données des ligues ; chaque ligue récupère ses propres données avec son propre compte. L'API Fantasy Sports de Yahoo est proposée pour un usage non commercial ; pour tout projet commercial, lis d'abord les conditions de Yahoo. Ceci n'est pas un conseil juridique.
- Les feuilles de match NBA viennent du tableau des scores public d'ESPN ; il n'est pas officiel et peut changer.
- La discussion de groupe ne doit être utilisée qu'avec l'accord de la ligue. Le dépôt ne garde que le nombre de messages par équipe.
- Les choix des lecteurs restent dans leur navigateur.

Sans lien avec Yahoo, la NBA, ESPN ou une entreprise d'IA.

## Langues

Les textes de l'interface sont en turc dans le code et traduits via les dictionnaires de `src/i18n/` (`en.json`, `fr.json`, `es.json`). Nombres, pourcentages et dates suivent la langue (48,2 %), tout comme les adresses des pages (`/pronostics/`, `/equipes/` …), les noms des images de partage et des CSV, les ancres des rubriques et les messages des scripts. Le numéro d'exemple de la ligue de démo existe dans les quatre langues. Pour ajouter une langue, copie `en.json`, traduis-le et ajoute le code dans `scripts/dil.mjs`. Détails dans le [README anglais](README.md#languages).

## Licence

[MIT](LICENSE).
