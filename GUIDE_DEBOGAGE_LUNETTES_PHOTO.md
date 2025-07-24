# Guide de Débogage - Positionnement des Lunettes sur Photos

## Problèmes identifiés et solutions

### 🔍 **Problème 1: Lunettes hors champ**
**Symptômes:** Les lunettes apparaissent en dehors de l'image ou ne sont pas visibles

**Causes possibles:**
- Position Z trop éloignée ou trop proche
- Échelle trop petite
- Configuration de caméra incorrecte

**Solutions appliquées:**
```typescript
// Position Z fixée entre 50-200 pixels devant le visage
glasses3D.position.z = baseDepth + adaptiveDepth;

// Échelle minimale garantie
finalScale = Math.max(0.1, finalScale);

// FOV élargi pour meilleure visibilité
const baseFOV = 60; // Augmenté de 45 à 60
```

### 🎯 **Problème 2: Pas de détection de landmarks**
**Symptômes:** Points colorés absents, message "Aucun visage détecté"

**Causes possibles:**
- Image de mauvaise qualité
- Visage trop petit ou trop grand
- Angle de visage trop extrême

**Solutions appliquées:**
```typescript
// Vérification améliorée des landmarks
if (!landmarks || landmarks.length < 468) {
  console.error('Landmarks insuffisants:', landmarks?.length || 0);
  this.showErrorMessage('Aucun visage détecté...');
  return;
}

// Attente du chargement complet de l'image
if (!img.complete || img.naturalWidth === 0) {
  img.onload = () => this.onImageLoaded();
  return;
}
```

### 📐 **Problème 3: Positionnement incorrect sur les yeux**
**Symptômes:** Lunettes proches du visage mais mal positionnées

**Causes possibles:**
- Système de coordonnées incorrect
- Calculs d'échelle inadaptés
- Rotations excessives

**Solutions appliquées:**
```typescript
// Système de coordonnées corrigé
const x = landmark.x * imageWidth;
const y = landmark.y * imageHeight;
const z = landmark.z * Math.max(imageWidth, imageHeight) * 0.5;

// Conversion vers Three.js
basePosition.x -= imageWidth / 2;
basePosition.y = imageHeight / 2 - basePosition.y;

// Limitation des rotations
glasses3D.rotation.x = Math.max(-0.3, Math.min(0.3, glasses3D.rotation.x));
```

## 🛠️ **Méthodes de débogage ajoutées**

### 1. Test des composants
```typescript
// Dans la console du navigateur
component.testGlassesPositioning();
```

### 2. Repositionnement forcé
```typescript
// Forcer le repositionnement
component.forceRepositionGlasses();
```

### 3. Logs détaillés
- Vérification des éléments DOM
- État des landmarks détectés
- Métriques du visage calculées
- Position finale des lunettes
- État de visibilité des objets 3D

## 🔧 **Améliorations techniques**

### Configuration Three.js optimisée
- **FOV élargi:** 60° au lieu de 45° pour meilleure visibilité
- **Distance caméra réduite:** 0.6x au lieu de 0.8x pour cadrage plus proche
- **Éclairage amélioré:** 3 sources de lumière pour éviter les zones sombres

### Positionnement adaptatif
- **Échelle basée sur la taille du visage:** Calcul dynamique selon la distance entre les yeux
- **Position Z intelligente:** 50px + distance adaptative devant le visage
- **Validation automatique:** Correction des valeurs aberrantes

### Gestion d'erreurs robuste
- **Vérification des prérequis:** DOM, services, modèles 3D
- **Messages d'erreur informatifs:** Guidance pour l'utilisateur
- **Fallback automatique:** Valeurs de sécurité en cas d'échec

## 📋 **Checklist de vérification**

Avant de signaler un problème, vérifiez:

1. **✅ Image chargée correctement**
   - Dimensions > 0
   - Format supporté (JPG, PNG, etc.)
   - Visage clairement visible

2. **✅ Modèle 3D sélectionné**
   - Propriété `glass` définie
   - Chemin `model3DPath` valide
   - Modèle chargé sans erreur

3. **✅ Éléments DOM présents**
   - `uploadedImage` référencé
   - `overlayCanvasImage` disponible
   - `threeContainerImage` accessible

4. **✅ Services initialisés**
   - `faceMeshService` opérationnel
   - MediaPipe chargé correctement

## 🚀 **Tests recommandés**

1. **Test avec différentes images:**
   - Visages de face
   - Visages légèrement inclinés
   - Différentes résolutions
   - Différentes tailles de visage

2. **Test des logs console:**
   - Vérifier les messages de débogage
   - Contrôler les métriques calculées
   - Valider les positions finales

3. **Test de repositionnement:**
   - Changer de modèle de lunettes
   - Recharger la même image
   - Tester le repositionnement forcé

## 📞 **En cas de problème persistant**

Si les problèmes persistent après ces corrections:

1. Ouvrir la console du navigateur (F12)
2. Exécuter `component.testGlassesPositioning()`
3. Copier tous les logs de débogage
4. Noter les dimensions de l'image et le modèle de lunettes utilisé
5. Fournir ces informations pour un diagnostic plus poussé
