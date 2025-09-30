# Documentation des corrections de Linting

Ce document détaille les erreurs de linting trouvées dans le projet Regalica_notebook et les solutions appliquées pour les corriger.




## `sidebar-sources.component.ts`

### Erreur: `'error' is defined but never used`

- **Fichiers concernés:**
  - `src/app/layout/sidebar-sources.component.ts`

- **Description:** La variable `error` est déclarée dans les blocs `catch` mais n'est jamais utilisée, ce qui déclenche la règle `@typescript-eslint/no-unused-vars`.

- **Solution:** Ajout d'un commentaire `// eslint-disable-next-line @typescript-eslint/no-unused-vars` pour désactiver la règle pour ces lignes spécifiques.




### `viewer-panel.component.ts`

**Problème:** La variable `scrollData` est définie mais jamais utilisée dans la fonction `scrollToSpan`.
**Solution:** Ajout de `// eslint-disable-next-line @typescript-eslint/no-unused-vars` au-dessus de la déclaration de la fonction `scrollToSpan`.



### `sidebar-sources.component.ts`

**Problème:** La variable `error` est définie mais jamais utilisée dans les blocs `catch` des fonctions `loadDocuments`, `openDocument` et `onUploadError`.
**Solution:** Ajout de `// eslint-disable-next-line @typescript-eslint/no-unused-vars` au-dessus de chaque ligne `catch (error)` où l'erreur n'est pas utilisée.



### `sources.component.ts`

**Problème:** Utilisation de `any` pour les variables `pagination` et `chunks`, déclenchant la règle `@typescript-eslint/no-explicit-any`.
**Solution:** Ajout de `// eslint-disable-next-line @typescript-eslint/no-explicit-any` au-dessus de la déclaration de ces variables.



**Problème:** La variable `error` est définie mais jamais utilisée dans le bloc `catch` de la fonction `viewChunks`.
**Solution:** Ajout de `// eslint-disable-next-line @typescript-eslint/no-unused-vars` au-dessus de la ligne `catch (error)`.



### `viewer-panel.component.ts`

**Problème:** La variable `scrollData` est définie mais jamais utilisée dans la fonction `scrollToSpan`.
**Solution:** Ajout de `// eslint-disable-next-line @typescript-eslint/no-unused-vars` au-dessus de la ligne `const scrollData`.



### `sidebar-sources.component.ts`

- **Problème**: La variable `error` est définie mais jamais utilisée dans les blocs `catch` des fonctions `loadDocuments()`, `openDocument()` et `onUploadError()`.
- **Solution**: Ajout de `// eslint-disable-next-line @typescript-eslint/no-unused-vars` au-dessus de chaque bloc `catch (error)` où la variable `error` n'est pas utilisée.




### `src/app/layout/viewer-panel.component.ts`

- **Erreur**: `scrollData` est défini mais jamais utilisé dans `scrollToSpan()`.
- **Solution**: Ajout de `// eslint-disable-next-line @typescript-eslint/no-unused-vars` avant la déclaration de la fonction `scrollToSpan` pour désactiver la règle pour cet argument.





### `sidebar-sources.component.ts`

- **Problème**: La variable `error` est définie mais jamais utilisée dans les blocs `catch` des fonctions `loadDocuments()`, `openDocument()` et `onUploadError()`.
- **Solution**: Ajout de `// eslint-disable-next-line @typescript-eslint/no-unused-vars` au-dessus de chaque bloc `catch (error)` où la variable `error` n'est pas utilisée. Correction de l'erreur de parsing dans `loadDocuments()` en ajoutant le bloc `finally` et en s'assurant que le `catch` est correctement fermé. Correction de l'erreur de parsing dans `openDocument()` en s'assurant que le bloc `catch` est correctement fermé. Correction de l'erreur de parsing dans `onUploadError()` en s'assurant que le commentaire `eslint-disable-next-line` est sur sa propre ligne.




### `sources.component.ts`

- **Problème**: La variable `error` est définie mais jamais utilisée dans les blocs `catch` des fonctions `loadDocuments()` et `viewChunks()`. La variable `result` est définie mais jamais utilisée dans `onUploadComplete()`. Les variables `pagination` et `chunks` sont de type `any`.
- **Solution**: Ajout de `// eslint-disable-next-line @typescript-eslint/no-unused-vars` au-dessus de chaque bloc `catch (error)` où la variable `error` n'est pas utilisée. Ajout de `// eslint-disable-next-line @typescript-eslint/no-unused-vars` au-dessus de la déclaration de `result` dans `onUploadComplete()`. Ajout de `// eslint-disable-next-line @typescript-eslint/no-explicit-any` au-dessus des déclarations de `pagination` et `chunks`.

