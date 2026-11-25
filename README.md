# 🏛️ Logidex

Ton aide-mémoire de **palais mentaux** (méthode des loci), en app Android.

- **Palais → Pièces → Loci** : ton trajet, dans l'ordre, numéroté en continu. Glisser-déposer pour réorganiser (même d'une pièce à l'autre).
- **Contenus** : ce que tu déposes dans un palais (une liste, un discours, des dates…). Un même palais peut porter plusieurs contenus ; chaque élément reste accroché à son locus.
- **Promenade** : parcours ton palais en plein écran, un locus à la fois, en glissant.
- **Révision espacée** : après chaque test, Logidex calcule la prochaine révision (1 j, 3 j, 1 sem., 2 sem., 1 mois…). L'accueil affiche ce qui est « À revoir aujourd'hui ».
- **Tester en récitant** : dis ta réponse à voix haute (ou écris-la) avant de la voir ; Logidex la compare à la bonne réponse (accents, pluriels et petites erreurs de dictée tolérés) et suggère la note : Su, À moitié ou Raté. Glisse la carte : → su, ← raté.
- **Anti-mélange** : chaque palais affiche s'il est *Libre*, *Occupé* ou en *Mélange* (deux contenus actifs sur les mêmes loci). Les loci partagés sont marqués en orange, Logidex propose un palais libre à la création d'un contenu, et tu peux **archiver** un contenu ou le **déplacer** vers un autre palais.
- **Atelier d'images** : les nombres d'un élément (« 1789 ») sont découpés et reliés à tes images 00–99 ; en option, Claude propose 3 images mentales qui font interagir l'élément avec le locus (avec ta propre clé API, gardée sur le téléphone).
- **Rappel quotidien** : une notification à l'heure choisie, seulement les jours où quelque chose est à revoir, avec la liste réelle.
- **Nombres** : ton système d'images de 00 à 99 (système majeur, avec aide).
- **Filet de sécurité** : sauvegarde automatique quotidienne dans `Documents/Logidex` (survit à une désinstallation), « Annuler » après chaque suppression, export/import.
- Design Material 3 clair/sombre, vibrations, transitions, accueil guidé à la première ouverture.

Tout est stocké **sur ton téléphone**, hors-ligne. Aucun serveur.

---

## Comment ça marche (version courte)

| Pièce | Rôle |
| --- | --- |
| **Svelte 5 + TypeScript 5** | L'interface de l'app (le code dans `src/`). |
| **Capacitor** | Emballe l'interface dans une vraie app Android (dossier `android/`). Pense à une coquille native qui affiche ton interface et lui donne accès au stockage et au partage du téléphone. |
| **GitHub Actions** | À chaque push sur `main`, un serveur de GitHub compile l'APK. Si la version de `package.json` est nouvelle, il crée une **Release** avec l'APK. |
| **Obtainium** | App Android gratuite et open source qui surveille les Releases d'un repo GitHub et installe les mises à jour. C'est ton « Play Store » perso. |

## Installation sur ton cell (une seule fois)

1. Installe **Obtainium** : télécharge l'APK depuis <https://github.com/ImranR98/Obtainium/releases> (fichier `app-arm64-v8a-release.apk`) ou via F-Droid.
2. Dans Obtainium : **Ajouter une app** → colle `https://github.com/ChapsJust/logitrainer` → **Ajouter**.
3. Touche **Installer**. Android va demander d'autoriser Obtainium à installer des apps : accepte.
4. Logidex apparaît dans tes apps. 🎉

Sans Obtainium : ouvre <https://github.com/ChapsJust/logitrainer/releases> sur ton cell, télécharge le `.apk` le plus récent et ouvre-le.
L'app vérifie aussi elle-même s'il y a une nouvelle version (une fois par jour, et via **Réglages → Vérifier les mises à jour**).

## Publier une mise à jour

```bash
pnpm release        # 0.1.0 → 0.1.1 (ou: pnpm release minor / major)
git push
```

Quand le commit arrive sur `main`, GitHub Actions publie `v0.1.1`. Obtainium te notifie et tu touches **Mettre à jour**. Tes données restent en place.

> Un push sur `main` sans changer la version compile l'APK (visible dans l'onglet *Actions*) mais ne publie rien.

### Clé de signature (configuration unique)

Android n'accepte une mise à jour que si elle est signée avec **la même clé** que la version installée. La clé est fournie à GitHub Actions par 4 secrets
(*Settings → Secrets and variables → Actions*) :

| Secret | Contenu |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Le fichier `.jks` encodé en base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | Alias de la clé (`logidex`) |
| `ANDROID_KEY_PASSWORD` | Mot de passe de la clé |

Sans ces secrets, le workflow compile un APK de debug sans publier de release.

Créer une nouvelle clé toi-même (Java requis) :

```bash
keytool -genkeypair -keystore logidex-release.jks -storetype PKCS12 -alias logidex -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=Logidex"
```

```bash
base64 -w0 logidex-release.jks
```

⚠️ Garde le `.jks` et son mot de passe en lieu sûr, **jamais dans le repo**.

## Développer

Prérequis : Node 22+, pnpm 10.

```bash
pnpm install
```

```bash
pnpm dev            # ouvre l'app dans le navigateur (aussi accessible depuis ton cell sur le même Wi-Fi)
```

```bash
pnpm check          # vérification TypeScript/Svelte
```

Compiler l'APK localement (Android SDK + JDK 21 requis) :

```bash
pnpm android:sync && cd android && ./gradlew assembleDebug
```

### Structure

```
src/
  lib/
    types.ts            modèle de données (Palais, Pièce, Locus, Contenu)
    store.svelte.ts     état + sauvegarde automatique + actions
    storage.ts          lecture/écriture (fichier sur Android, localStorage en navigateur)
    nav.svelte.ts       navigation + bouton retour Android
    screens/            les écrans (Accueil, Palais, Contenu, Quiz, Nombres, Recherche, Réglages)
    components/         feuilles, barres, etc.
android/                projet Android généré par Capacitor
.github/workflows/      compilation + publication automatique de l'APK
```

## Suggestions d'images (facultatif)

Réglages → Assistant d'images → colle une clé API Anthropic (`sk-ant-…`, à créer sur console.anthropic.com).
La clé reste dans les préférences de l'app (jamais dans les exports). Chaque demande envoie seulement l'élément, le nom et la description du locus, et tes images de nombres concernées. Modèle : Claude Opus 5.5 (effort bas, environ 1 ¢ par demande), avec repli automatique côté serveur si une demande est refusée.

## Sauvegarde

Les données vivent dans le stockage privé de l'app. En plus, Logidex écrit chaque jour une copie dans `Documents/Logidex` sur le téléphone (les 7 dernières sont gardées) : ces fichiers restent même si tu désinstalles l'app, et se réimportent via **Réglages → Importer**.
Pour changer de téléphone, utilise **Réglages → Exporter une copie** (Drive, courriel…).
