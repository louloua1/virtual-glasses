// ===== SYSTÈME DE CONVERSION ADAPTATIF MEDIAPIPE → THREE.JS =====
import * as THREE from 'three';
interface AdaptiveConversionParams {
    imageWidth: number;
    imageHeight: number;
    aspectRatio: number;
    eyeDistance: number;
    faceScale: number;
    isPortrait: boolean;
    isLandscape: boolean;
    cropType: 'full' | 'portrait' | 'closeup' | 'extreme_closeup';
  }
  
  interface ConversionResult {
    position: THREE.Vector3;
    scale: number;
    rotation: number;
    confidence: number;
  }
  
  class AdaptiveCoordinateConverter {
    private conversionParams: AdaptiveConversionParams;
    private debugMode = false;
  
    constructor(imageWidth: number, imageHeight: number, eyeDistance: number) {
      this.conversionParams = this.analyzeImageCharacteristics(imageWidth, imageHeight, eyeDistance);
    }
  
    // ===== ANALYSE ADAPTATIVE DE L'IMAGE =====
    private analyzeImageCharacteristics(width: number, height: number, eyeDistance: number): AdaptiveConversionParams {
      const aspectRatio = width / height;
      const isPortrait = aspectRatio < 0.9;
      const isLandscape = aspectRatio > 1.2;
      
      // Analyse du type de crop basé sur la distance des yeux
      const eyeToImageRatio = eyeDistance / Math.min(width, height);
      let cropType: 'full' | 'portrait' | 'closeup' | 'extreme_closeup';
      
      if (eyeToImageRatio > 0.4) {
        cropType = 'extreme_closeup';
      } else if (eyeToImageRatio > 0.25) {
        cropType = 'closeup';
      } else if (eyeToImageRatio > 0.15) {
        cropType = 'portrait';
      } else {
        cropType = 'full';
      }
  
      // Calcul de l'échelle du visage dans l'image
      const faceScale = this.calculateFaceScale(eyeDistance, width, height, cropType);
  
      console.log('🔍 Analyse image:', {
        dimensions: `${width}x${height}`,
        aspectRatio: aspectRatio.toFixed(2),
        eyeDistance: eyeDistance.toFixed(1),
        eyeToImageRatio: eyeToImageRatio.toFixed(3),
        cropType,
        faceScale: faceScale.toFixed(3)
      });
  
      return {
        imageWidth: width,
        imageHeight: height,
        aspectRatio,
        eyeDistance,
        faceScale,
        isPortrait,
        isLandscape,
        cropType
      };
    }
  
    // ===== CALCUL D'ÉCHELLE ADAPTATIF =====
    private calculateFaceScale(eyeDistance: number, width: number, height: number, cropType: string): number {
      const standardEyeDistance = 65; // Distance standard en pixels
      const baseScale = eyeDistance / standardEyeDistance;
      console.log('cropType', cropType);
      // Facteurs de correction selon le type d'image
      const corrections = {
        'full': 1.0,
        'portrait': 1.1,
        'closeup': 0.6,
        'extreme_closeup': 1.4
      };
      
      const correctionFactor = corrections[cropType as keyof typeof corrections] || 1.0;
      return baseScale * correctionFactor;
    }
  
    // ===== CONVERSION PRINCIPALE MEDIAPIPE → THREE.JS =====
    public convertLandmarkToThreeJS(landmark: any): THREE.Vector3 {
      if (!landmark || typeof landmark.x !== 'number') {
        return new THREE.Vector3(0, 0, 0);
      }
  
      const params = this.conversionParams;
      
      // ✅ CONVERSION X (Horizontale) - Adaptée aux différents ratios
      let x3D = this.convertXCoordinate(landmark.x, params);
      
      // ✅ CONVERSION Y (Verticale) - Adaptée aux crops
      let y3D = this.convertYCoordinate(landmark.y, params);
      
      // ✅ CONVERSION Z (Profondeur) - Adaptée à l'échelle du visage
      let z3D = this.convertZCoordinate(landmark.z, params);
  
      return new THREE.Vector3(x3D, y3D, z3D);
    }
  
    // ===== CONVERSION X ADAPTATIVE =====
    private convertXCoordinate(normalizedX: number, params: AdaptiveConversionParams): number {
      // Centrage sur 0 (MediaPipe: 0→1, Three.js: -width/2→+width/2)
      const centeredX = normalizedX - 0.5;
      
      // Mise à l'échelle selon la largeur de l'image
      let x3D = centeredX * params.imageWidth;
      
      // Ajustements selon le type d'image
      if (params.isLandscape && params.cropType === 'portrait') {
        // Image large mais visage centré
        x3D *= 0.8;
      } else if (params.isPortrait && params.cropType === 'closeup') {
        // Portrait serré
        x3D *= 1.1;
      }
      
      return x3D;
    }
  
    // ===== CONVERSION Y ADAPTATIVE =====
    private convertYCoordinate(normalizedY: number, params: AdaptiveConversionParams): number {
      // Inversion Y (MediaPipe: 0=haut, Three.js: 0=centre, +Y=haut)
      const centeredY = 0.5 - normalizedY;
      
      // Mise à l'échelle selon la hauteur de l'image
      let y3D = centeredY * params.imageHeight;
      
      // Ajustements selon le crop
      switch (params.cropType) {
        case 'extreme_closeup':
          // Réduction du mouvement vertical pour les gros plans
          y3D *= 0.9;
          break;
        case 'closeup':
          y3D *= 0.95;
          break;
        case 'full':
          // Expansion pour les images complètes
          y3D *= 1.05;
          break;
      }
      
      return y3D;
    }
  
    // ===== CONVERSION Z ADAPTATIVE =====
    private convertZCoordinate(normalizedZ: number, params: AdaptiveConversionParams): number {
      // MediaPipe Z: distance relative au plan du visage
      // Three.js Z: distance de la caméra (négatif = plus proche)
      
      // Échelle de base proportionnelle à la taille du visage
      const baseDepthScale = params.eyeDistance * 0.8;
      
      // Ajustement selon le type d'image
      let depthMultiplier = 1.0;
      
      switch (params.cropType) {
        case 'extreme_closeup':
          depthMultiplier = 0.3; // Profondeur réduite pour les gros plans
          break;
        case 'closeup':
          depthMultiplier = 0.5;
          break;
        case 'portrait':
          depthMultiplier = 0.7;
          break;
        case 'full':
          depthMultiplier = 1.0;
          break;
      }
      
      let z3D = normalizedZ * baseDepthScale * depthMultiplier;
      
      // Ajustement pour le ratio d'aspect
      if (params.aspectRatio > 1.5) {
        // Images très larges
        z3D *= 0.8;
      } else if (params.aspectRatio < 0.7) {
        // Images très hautes
        z3D *= 1.2;
      }
      
      return z3D;
    }
  
    // ===== CALCUL DE POSITION OPTIMALE POUR LES LUNETTES =====
    public calculateOptimalGlassesTransform(landmarks: any[]): ConversionResult | null {
      // Points essentiels des yeux
      const leftEyeOuter = landmarks[33];
      const rightEyeOuter = landmarks[263];
      const leftEyeInner = landmarks[133];
      const rightEyeInner = landmarks[362];
      
      if (!leftEyeOuter || !rightEyeOuter || !leftEyeInner || !rightEyeInner) {
        console.error('❌ Points des yeux manquants');
        return null;
      }
  
      // Conversion des points clés
      const leftOuter3D = this.convertLandmarkToThreeJS(leftEyeOuter);
      const rightOuter3D = this.convertLandmarkToThreeJS(rightEyeOuter);
      const leftInner3D = this.convertLandmarkToThreeJS(leftEyeInner);
      const rightInner3D = this.convertLandmarkToThreeJS(rightEyeInner);
  
      // Centre des yeux adaptatif
      const leftEyeCenter = new THREE.Vector3()
        .addVectors(leftOuter3D, leftInner3D)
        .multiplyScalar(0.5);
      
      const rightEyeCenter = new THREE.Vector3()
        .addVectors(rightOuter3D, rightInner3D)
        .multiplyScalar(0.5);
  
      // Position finale des lunettes
      const glassesPosition = new THREE.Vector3()
        .addVectors(leftEyeCenter, rightEyeCenter)
        .multiplyScalar(0.5);
  
      // Ajustement vertical adaptatif
      const verticalOffset = this.calculateAdaptiveVerticalOffset();
      glassesPosition.y += verticalOffset;
  
      // Calcul de l'échelle adaptative
      const eyeDistance3D = leftEyeCenter.distanceTo(rightEyeCenter);
      const adaptiveScale = this.calculateAdaptiveScale(eyeDistance3D);
  
      // Calcul de la rotation
      const deltaY = rightEyeCenter.y - leftEyeCenter.y;
      const deltaX = rightEyeCenter.x - leftEyeCenter.x;
      const rotation = Math.atan2(deltaY, deltaX) * 0.7; // Facteur de lissage
  
      // Évaluation de la confiance
      const confidence = this.evaluateConversionConfidence(landmarks);
  
      if (this.debugMode) {
        console.log('🎯 Transformation adaptative:', {
          position: `(${glassesPosition.x.toFixed(1)}, ${glassesPosition.y.toFixed(1)}, ${glassesPosition.z.toFixed(3)})`,
          scale: adaptiveScale.toFixed(3),
          rotation: `${(rotation * 180 / Math.PI).toFixed(1)}°`,
          confidence: `${confidence.toFixed(1)}%`,
          cropType: this.conversionParams.cropType
        });
      }
  
      return {
        position: glassesPosition,
        scale: adaptiveScale,
        rotation,
        confidence
      };
    }
  
    // ===== OFFSET VERTICAL ADAPTATIF =====
    private calculateAdaptiveVerticalOffset(): number {
      const params = this.conversionParams;
      let baseOffset = -params.eyeDistance * 0.08; // Offset de base
  
      // Ajustements selon le type d'image
      switch (params.cropType) {
        case 'extreme_closeup':
          baseOffset *= 0.3; // Très peu d'offset pour les gros plans
          break;
        case 'closeup':
          baseOffset *= 0.6;
          break;
        case 'portrait':
          baseOffset *= 0.8;
          break;
        case 'full':
          baseOffset *= 1.0;
          break;
      }
  
      // Ajustement selon le ratio
      if (params.isPortrait) {
        baseOffset *= 0.9;
      } else if (params.isLandscape) {
        baseOffset *= 1.1;
      }
  
      return baseOffset;
    }
  
    // ===== ÉCHELLE ADAPTATIVE =====
    private calculateAdaptiveScale(eyeDistance3D: number): number {
      const params = this.conversionParams;
      
      // Échelle de base proportionnelle à la distance des yeux
      const standardDistance = 100; // Distance standard en coordonnées 3D
      let baseScale = eyeDistance3D / standardDistance;
  
      // Ajustements selon le type d'image
      const scaleAdjustments = {
        'extreme_closeup': 0.7,
        'closeup': 0.8,
        'portrait': 0.9,
        'full': 1.0
      };
  
      const adjustment = scaleAdjustments[params.cropType as keyof typeof scaleAdjustments];
      baseScale *= adjustment;
  
      // Ajustement selon l'échelle globale du visage
      baseScale *= params.faceScale;
  
      // Limitations de sécurité
      return Math.max(0.4, Math.min(1.6, baseScale));
    }
  
    // ===== ÉVALUATION DE LA CONFIANCE =====
    private evaluateConversionConfidence(landmarks: any[]): number {
      let confidence = 100;
      const params = this.conversionParams;
  
      // Pénalité selon le type de crop
      const cropPenalties = {
        'full': 0,
        'portrait': -5,
        'closeup': -10,
        'extreme_closeup': -20
      };
  
      confidence += cropPenalties[params.cropType as keyof typeof cropPenalties];
  
      // Pénalité pour les ratios extrêmes
      if (params.aspectRatio > 2.0 || params.aspectRatio < 0.5) {
        confidence -= 15;
      }
  
      // Bonus pour les images bien proportionnées
      if (params.aspectRatio >= 0.8 && params.aspectRatio <= 1.2) {
        confidence += 10;
      }
  
      // Vérification de la qualité des landmarks essentiels
      const essentialIndices = [33, 263, 133, 362, 168];
      let validEssentialPoints = 0;
      
      essentialIndices.forEach(index => {
        const landmark = landmarks[index];
        if (landmark && typeof landmark.x === 'number' && 
            landmark.x >= 0 && landmark.x <= 1 &&
            landmark.y >= 0 && landmark.y <= 1) {
          validEssentialPoints++;
        }
      });
  
      const essentialQuality = (validEssentialPoints / essentialIndices.length) * 100;
      confidence = (confidence + essentialQuality) / 2;
  
      return Math.max(0, Math.min(100, confidence));
    }
  
    // ===== VALIDATION DE LA TRANSFORMATION =====
    public validateTransform(result: ConversionResult): boolean {
      const params = this.conversionParams;
      const pos = result.position;
  
      // Vérification des limites spatiales
      const maxX = params.imageWidth * 0.6;
      const maxY = params.imageHeight * 0.6;
      const maxZ = Math.min(params.imageWidth, params.imageHeight) * 0.3;
  
      const positionValid = 
        Math.abs(pos.x) < maxX &&
        Math.abs(pos.y) < maxY &&
        Math.abs(pos.z) < maxZ;
  
      const scaleValid = result.scale >= 0.3 && result.scale <= 2.0;
      const rotationValid = Math.abs(result.rotation) < Math.PI / 4; // ±45°
      const confidenceValid = result.confidence >= 40;
  
      const isValid = positionValid && scaleValid && rotationValid && confidenceValid;
  
      if (!isValid && this.debugMode) {
        console.warn('⚠️ Validation échouée:', {
          positionValid,
          scaleValid,
          rotationValid,
          confidenceValid,
          position: `(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(3)})`,
          scale: result.scale.toFixed(3),
          rotation: `${(result.rotation * 180 / Math.PI).toFixed(1)}°`,
          confidence: result.confidence.toFixed(1)
        });
      }
  
      return isValid;
    }
  
    // ===== MÉTHODES UTILITAIRES =====
    public enableDebugMode(enabled: boolean = true) {
      this.debugMode = enabled;
    }
  
    public getConversionParams(): AdaptiveConversionParams {
      return { ...this.conversionParams };
    }
  
    public updateImageDimensions(width: number, height: number, eyeDistance: number) {
      this.conversionParams = this.analyzeImageCharacteristics(width, height, eyeDistance);
    }
  }
  
  // ===== INTÉGRATION DANS VOTRE COMPOSANT =====
  /*
  // Dans votre méthode extractFaceGeometry, remplacez la conversion par :
  
  private extractFaceGeometry(landmarks: any[], imageWidth: number, imageHeight: number): FaceGeometry | null {
    // Calcul initial de la distance des yeux pour le converter
    const leftEyeRaw = landmarks[33];
    const rightEyeRaw = landmarks[263];
    if (!leftEyeRaw || !rightEyeRaw) return null;
  
    const eyeDistancePx = Math.sqrt(
      Math.pow((leftEyeRaw.x - rightEyeRaw.x) * imageWidth, 2) +
      Math.pow((leftEyeRaw.y - rightEyeRaw.y) * imageHeight, 2)
    );
  
    // Initialisation du converter adaptatif
    const converter = new AdaptiveCoordinateConverter(imageWidth, imageHeight, eyeDistancePx);
    converter.enableDebugMode(true); // Pour le développement
  
    // Conversion de tous les points avec le système adaptatif
    const getAdaptivePoint = (index: number) => converter.convertLandmarkToThreeJS(landmarks[index]);
  
    const points = {
      leftEyeOuter: getAdaptivePoint(33),
      rightEyeOuter: getAdaptivePoint(263),
      leftEyeInner: getAdaptivePoint(133),
      rightEyeInner: getAdaptivePoint(362),
      // ... autres points
    };
  
    // Calcul optimisé de la transformation des lunettes
    const transform = converter.calculateOptimalGlassesTransform(landmarks);
    
    if (!transform || !converter.validateTransform(transform)) {
      console.error('❌ Transformation invalide');
      return null;
    }
  
    // Retour de la géométrie avec les nouvelles données
    return {
      eyeCenter: transform.position,
      eyeDistance: eyeDistancePx,
      // ... autres propriétés
      adaptiveTransform: transform,
      conversionParams: converter.getConversionParams()
    };
  }
  */
  
  export { AdaptiveCoordinateConverter, type AdaptiveConversionParams, type ConversionResult };