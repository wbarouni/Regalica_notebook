# Politique de Contribution

Nous sommes ravis que vous souhaitiez contribuer à Regalica Notebook JS ! Ce document décrit les règles et les bonnes pratiques à suivre pour garantir un processus de développement fluide et cohérent.

## Conventions de Commit

Nous suivons la spécification [**Conventional Commits**](https://www.conventionalcommits.org/en/v1.0.0/). Chaque message de commit doit être structuré comme suit :

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types de Commits

Les types suivants sont autorisés :

-   **feat**: Une nouvelle fonctionnalité (mise à jour mineure de la version semver).
-   **fix**: Une correction de bug (mise à jour de patch de la version semver).
-   **docs**: Des changements dans la documentation uniquement.
-   **style**: Des changements qui n'affectent pas la signification du code (espaces, formatage, points-virgules manquants, etc.).
-   **refactor**: Une modification du code qui ne corrige ni un bug ni n'ajoute de fonctionnalité.
-   **perf**: Une modification du code qui améliore les performances.
-   **test**: Ajout de tests manquants ou correction de tests existants.
-   **build**: Des changements qui affectent le système de build ou les dépendances externes (exemples : Gulp, Broccoli, npm).
-   **ci**: Des changements dans nos fichiers et scripts de configuration CI (exemples : GitHub Actions, CircleCI, Travis).
-   **chore**: D'autres changements qui ne modifient pas les fichiers `src` ou de test.

### Exemples

```
feat(api): ajouter un endpoint pour la recherche sémantique

fix(frontend): corriger un bug d'affichage sur Safari

docs(readme): mettre à jour les instructions d'installation
```

## Processus de Pull Request (PR)

1.  **Forkez le repository** et créez une nouvelle branche à partir de `main`.
2.  **Effectuez vos modifications** en respectant les conventions de codage et de commit.
3.  **Assurez-vous que les tests passent** localement avant de soumettre votre PR.
4.  **Soumettez une Pull Request** vers la branche `main`.
5.  **Assurez-vous que toutes les vérifications de la CI passent** (denylist, build, e2e).
6.  **Attendez une revue** de la part des `CODEOWNERS`.

## Style de Code

-   **JavaScript/Node.js** : Suivez les guides de style standard. Utilisez un linter si possible.
-   **Angular/TypeScript** : Respectez les conventions de style officielles d'Angular.
-   **SCSS** : Gardez le code SCSS propre et organisé.

## DenyList

N'oubliez pas que notre CI inclut une vérification de qualité du code. Tout code contenant des termes interdits échouera à la construction. Veuillez nettoyer votre code de ces termes avant de commettre.

Merci pour votre contribution !

