#!/bin/bash
set -e

echo "🚀 Déploiement Vercel Sûr - Regalica Notebook"
echo "=============================================="

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "index.html" ]; then
    echo "❌ Erreur: fichier index.html non trouvé"
    exit 1
fi

# Copier la configuration Vercel sûre
cp vercel-safe.json vercel.json

echo "✅ Configuration Vercel sûre appliquée"
echo "📁 Fichiers à déployer:"
echo "   - index.html (page d'accueil)"
echo "   - vercel.json (configuration)"

echo ""
echo "🔧 Pour déployer:"
echo "   1. Connectez-vous à vercel.com"
echo "   2. Importez ce repository GitHub"
echo "   3. Vercel détectera automatiquement la configuration"
echo ""
echo "🌐 Résultat: Page d'accueil statique présentant le projet"
echo "💡 Aucune modification du code principal"

# Nettoyer
rm -f vercel.json

echo "✅ Script terminé - Prêt pour déploiement manuel"
