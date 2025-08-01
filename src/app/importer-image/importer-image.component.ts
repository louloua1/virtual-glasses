import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, AfterViewInit, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { FaceMeshService } from '../services/face-mesh.service';
import { Subscription, BehaviorSubject, Observable, async } from 'rxjs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Input } from '@angular/core';
import { Glasses } from '../classes/glasses';
import { CommonModule } from '@angular/common';
interface FaceGeometry {
  eyeCenter: THREE.Vector3;
  eyeDistance: number;
  faceWidth: number;
  faceHeight: number;
  faceAngle: number;
  noseBridgePosition: THREE.Vector3;
  points: any;
  quality: number;
  adaptiveScale: number;
  isPartialImage?: boolean; // Nouveau champ
}

@Component({
  selector: 'app-importer-image',
  imports: [CommonModule],
  templateUrl: './importer-image.component.html',
  styleUrl: './importer-image.component.scss'
})
export class ImporterImageComponent {
    
  @ViewChild('threeContainer', { static: false }) threeContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('threeContainerImage', { static: false }) threeContainerImage!: ElementRef<HTMLDivElement>;
  @ViewChild('uploadedImage', { static: false }) uploadedImage!: ElementRef<HTMLImageElement>;
  @ViewChild('overlayCanvasImage', { static: false }) overlayCanvasImage!: ElementRef<HTMLCanvasElement>;
  private faceDetectionSubscription!: Subscription;
  isFaceDetected$!: Observable<boolean>;
  private renderer3DImage!: THREE.WebGLRenderer;
  private scene3DImage!: THREE.Scene;
  private camera3DImage!: THREE.PerspectiveCamera;
  private glasses3DImage?: THREE.Object3D;
  imageDisplayWidth: number = 0;
  imageDisplayHeight: number = 0;
  imageOriginalWidth: number = 0;   // Nouvelle propriété
  imageOriginalHeight: number = 0;  // Nouvelle propriété
  private readonly MAX_DISPLAY_WIDTH = 600;  // Largeur max d'affichage réduite
  private readonly MAX_DISPLAY_HEIGHT = 450; // Hauteur max d'affichage réduite
  private readonly MIN_DISPLAY_WIDTH = 300;  // Largeur min d'affichage
  private readonly MIN_DISPLAY_HEIGHT = 200; // Hauteur min d'affichage
  @Input() glass: any;
  @Output() close = new EventEmitter<void>(); 
  model3DPath: string = 'assets/models/model1.glb'; //chemin par 
  errorMessage !:string;
  @Output() imageUploaded = new EventEmitter<File>();
  @ViewChild('fileInput') fileInput!: ElementRef;
  getOriginalDimensions(): string {
    return this.imageOriginalWidth > 0 ? `${this.imageOriginalWidth}×${this.imageOriginalHeight}px` : '';
  }

  getReductionPercentage(): string {
    if (this.imageOriginalWidth === 0 || this.imageDisplayWidth === 0) return '';
    const reduction = (1 - (this.imageDisplayWidth / this.imageOriginalWidth)) * 100;
    return reduction > 1 ? `${reduction.toFixed(0)}%` : 'Aucune';
  }

  // Méthode pour afficher les informations sur la taille originale
  showOriginalSize(): void {
    if (this.imageOriginalWidth === 0 || this.imageOriginalHeight === 0) return;
    
    const originalSize = (this.imageOriginalWidth * this.imageOriginalHeight) / (1024 * 1024);
    const displaySize = (this.imageDisplayWidth * this.imageDisplayHeight) / (1024 * 1024);
    const reductionRatio = this.imageDisplayWidth / this.imageOriginalWidth;
    
    const message = `
📏 Informations sur l'image :

🖼️ Dimensions originales : ${this.imageOriginalWidth} × ${this.imageOriginalHeight} pixels
📺 Dimensions d'affichage : ${this.imageDisplayWidth} × ${this.imageDisplayHeight} pixels
📊 Ratio de réduction : ${(reductionRatio * 100).toFixed(1)}%
💾 Taille originale : ${originalSize.toFixed(2)} mégapixels
🔧 Taille optimisée : ${displaySize.toFixed(2)} mégapixels

✨ Cette optimisation améliore les performances de détection faciale tout en conservant la précision.
    `;
    alert(message);
  }
  //obtenir la glass en 3D
  getModel3DPathFromGlass(glass: any): string {
    if (glass.model3DPath) {
      console.log('Chemin du modèle 3D à charger :', `assets/models/${glass.model3DPath}`);
      return `assets/models/${glass.model3DPath}`;
    }
    return 'assets/models/model1.glb';
  }
  constructor(
    private faceMeshService: FaceMeshService,
    private cdr: ChangeDetectorRef,
  ) {
    
      }
  private isInitialized = false;

  ngOnInit(): void {
    //this.getGlasses();
    this.isFaceDetected$ = this.faceMeshService.getFaceDetectionStatus();
    // S'abonner à la détection du visage
    let isFaceDetected = false;
    this.faceDetectionSubscription = this.isFaceDetected$.subscribe((detected) => {
      isFaceDetected = detected;
    });
    // Un seul callback pour dessiner les lunettes uniquement si le visage est détecté
    this.faceMeshService.setOnFrameCallback(() => {
      if (isFaceDetected || this.faceMeshService.isInFallbackMode()) {
        this.drawGlasses();
      } else {
        // Effacer le canvas si le visage n'est pas détecté
        const canvasCtx = this.faceMeshService.getCanvasContext();
        const canvasElement = this.faceMeshService.getCanvasElement();
        if (canvasCtx && canvasElement) {
          canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        }
      }
    });
  }
  private animationFrameId: number | null = null;
  ngAfterViewInit(): void {
    this.isInitialized = true;
    this.isDomReady = true;
    this.cdr.detectChanges();
  } 
  
  previewUrl: string | ArrayBuffer | null = null;
  fileName: string = '';
  fileSize: string = '';
  isDragging = false;
  uploadProgress: number = 0;
  isUploading = false;
  
  private drawGlasses(): void {
    const canvasCtx = this.faceMeshService.getCanvasContext();
    const canvasElement = this.faceMeshService.getCanvasElement();
    if (!canvasCtx || !canvasElement) return;

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    // Utiliser directement l'image du modèle si besoin (pour fallback 2D)
    const imgSrc = this.glass?.image || '';
    if ((this.faceMeshService.isInFallbackMode() || !this.faceMeshService.getFaceLandmarks() || !this.faceMeshService.getFaceLandmarks()[33] || !this.faceMeshService.getFaceLandmarks()[263]) && imgSrc) {
      const img = new Image();
      img.src = imgSrc;
      img.onload = () => {
        const centerX = canvasElement.width / 2;
        const centerY = canvasElement.height / 2;
        const width = canvasElement.width * 0.2;
        const height = img.height * (width / img.width);
        canvasCtx.drawImage(img, centerX - width/2, centerY - height/2, width, height);
        this.cdr.detectChanges();
      };
      return;
    }
  }
  

  // Gestion du glisser-déposer
  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }
  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.processFile(event.dataTransfer.files[0]);
    }
  }

  // Gestion du clic sur la zone de dépôt
  onFileClick() {
    this.fileInput.nativeElement.click();
  }

  // Gestion de la sélection de fichier
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }
private processFile(file: File) {
  if (!file.type.match(/image\/(jpeg|png|gif|bmp|webp)/)) {
    alert('Veuillez sélectionner une image valide (JPEG, PNG, GIF, BMP, WEBP)');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('La taille maximale autorisée est de 5 Mo');
    return;
  }
  
  this.fileName = file.name;
  this.fileSize = this.formatFileSize(file.size);
  
  const reader = new FileReader();
  reader.onload = () => {
    this.previewUrl = reader.result;
    this.imageUploaded.emit(file);
    // Supprimer l'ancien setTimeout ici car onImageDisplayed() s'en charge maintenant
  };
  reader.readAsDataURL(file);
  
  this.isUploading = true;
  this.simulateUpload(file);
}
  // Simulation du processus de téléchargement
  private simulateUpload(file: File) {
    const interval = setInterval(() => {
      this.uploadProgress += Math.floor(Math.random() * 10) + 1;
      if (this.uploadProgress >= 100) {
        clearInterval(interval);
        this.uploadProgress = 100;
        setTimeout(() => {
          this.isUploading = false;
        }, 500);
      }
    }, 200);
  }
private async waitForDOMElements(): Promise<boolean> {
  const maxAttempts = 20; // Augmenté pour laisser plus de temps
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    if (this.uploadedImage?.nativeElement &&
        this.overlayCanvasImage?.nativeElement &&
        this.threeContainerImage?.nativeElement &&
        this.imageDisplayWidth > 0 && 
        this.imageDisplayHeight > 0) {
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  console.error('Timeout: Éléments DOM ou dimensions non disponibles après', maxAttempts * 100, 'ms');
  return false;
}
  // Formatage de la taille du fichier
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' octets';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
    else return (bytes / 1048576).toFixed(1) + ' Mo';
  }
  reset() {
    this.previewUrl = null;
    this.fileName = '';
    this.fileSize = '';
    this.uploadProgress = 0;
    this.imageDisplayWidth = 0;  // Reset des dimensions
    this.imageDisplayHeight = 0; // Reset des dimensions
    
    if (this.fileInput) this.fileInput.nativeElement.value = '';
    if (this.scene3DImage && this.glasses3DImage) {
      this.scene3DImage.remove(this.glasses3DImage);
      this.glasses3DImage = undefined;
    }
    if (this.overlayCanvasImage) {
      const canvas = this.overlayCanvasImage.nativeElement;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    this.cdr.detectChanges();
  }
    
////////////////////////////////
 private isDomReady = false;
  private isProcessingImage = false;
  private calculateDisplayDimensions(naturalWidth: number, naturalHeight: number): {width: number, height: number} {
    console.log('Dimensions originales:', `${naturalWidth}x${naturalHeight}`);
    
    // Calculer le ratio pour maintenir les proportions
    const widthRatio = this.MAX_DISPLAY_WIDTH / naturalWidth;
    const heightRatio = this.MAX_DISPLAY_HEIGHT / naturalHeight;
    
    // Utiliser le plus petit ratio pour que l'image rentre dans les limites
    const ratio = Math.min(widthRatio, heightRatio);
    
    let displayWidth = naturalWidth * ratio;
    let displayHeight = naturalHeight * ratio;
    
    // S'assurer que les dimensions ne sont pas trop petites
    if (displayWidth < this.MIN_DISPLAY_WIDTH) {
      const minRatio = this.MIN_DISPLAY_WIDTH / naturalWidth;
      displayWidth = this.MIN_DISPLAY_WIDTH;
      displayHeight = naturalHeight * minRatio;
    }
    
    if (displayHeight < this.MIN_DISPLAY_HEIGHT) {
      const minRatio = this.MIN_DISPLAY_HEIGHT / naturalHeight;
      displayHeight = this.MIN_DISPLAY_HEIGHT;
      displayWidth = naturalWidth * minRatio;
    }
    
    // Arrondir les valeurs
    displayWidth = Math.round(displayWidth);
    displayHeight = Math.round(displayHeight);
    
    const finalRatio = displayWidth / naturalWidth;
    
    console.log('Redimensionnement calculé:', {
      natural: `${naturalWidth}x${naturalHeight}`,
      display: `${displayWidth}x${displayHeight}`,
      ratio: finalRatio.toFixed(3),
      reduction: `${(100 - finalRatio * 100).toFixed(1)}%`
    });
    
    return {
      width: displayWidth,
      height: displayHeight
    };
  }
  onImageDisplayed(): void {
    const img = this.uploadedImage?.nativeElement;
    if (!img || !img.complete) return;
    
    // Stocker les dimensions originales
    this.imageOriginalWidth = img.naturalWidth;
    this.imageOriginalHeight = img.naturalHeight;
    
    // Calculer les dimensions d'affichage
    const dimensions = this.calculateDisplayDimensions(img.naturalWidth, img.naturalHeight);
    this.imageDisplayWidth = dimensions.width;
    this.imageDisplayHeight = dimensions.height;
    // Déclencher la détection des changements pour mettre à jour le template
    this.cdr.detectChanges();
    
    // Lancer le traitement après mise à jour des dimensions
    setTimeout(() => {
      this.onImageLoaded();
    }, 150); // Délai légèrement augmenté pour assurer la stabilité
  }

// ✅ Méthode optimisée pour créer une image redimensionnée pour MediaPipe
private async createResizedImageForMediaPipe(originalImg: HTMLImageElement): Promise<HTMLImageElement> {
  console.log('🖼️ Création image redimensionnée optimisée pour MediaPipe');
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = this.imageDisplayWidth;
  tempCanvas.height = this.imageDisplayHeight;
  
  const ctx = tempCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossible de créer le contexte canvas');
  }
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  ctx.drawImage(
    originalImg,
    0, 0, originalImg.naturalWidth, originalImg.naturalHeight,
    0, 0, this.imageDisplayWidth, this.imageDisplayHeight
  );
  
  // Convertir en Blob pour une meilleure performance
  return new Promise<HTMLImageElement>((resolve, reject) => {
    tempCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Échec de la conversion en Blob'));
        return;
      }
      
      const img = new Image();
      const url = URL.createObjectURL(blob);
      
      img.onload = () => {
        // Nettoyer l'URL après utilisation
        URL.revokeObjectURL(url);
        console.log('✅ Image redimensionnée créée (optimisée):', `${img.width}x${img.height}`);
        resolve(img);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Erreur lors du chargement de l\'image depuis le Blob'));
      };
      
      img.src = url;
    }, 'image/png', 0.95); // Qualité de compression
  });
}

// ✅ Méthode pour calculer les facteurs d'échelle
private calculateScaleFactors(originalImg: HTMLImageElement): { scaleX: number, scaleY: number } {
  const scaleX = this.imageDisplayWidth / originalImg.naturalWidth;
  const scaleY = this.imageDisplayHeight / originalImg.naturalHeight;
  
  console.log('📏 Facteurs d\'échelle calculés:', { scaleX, scaleY });
  
  return { scaleX, scaleY };
}

// ✅ Méthode pour valider les landmarks
private validateLandmarks(landmarks: any[]): boolean {
  if (!landmarks || landmarks.length < 468) {
    console.error(`❌ Landmarks insuffisants: ${landmarks?.length || 0}/468 requis`);
    return false;
  }
  
  // Vérifier que les landmarks sont dans les bonnes plages
  const invalidLandmarks = landmarks.filter(landmark => 
    landmark.x < 0 || landmark.x > 1 || 
    landmark.y < 0 || landmark.y > 1
  );
  
  if (invalidLandmarks.length > 0) {
    console.warn(`⚠️ ${invalidLandmarks.length} landmarks hors limites détectés`);
  }
  
  return true;
}

// ✅ Méthode principale améliorée
async onImageLoaded(): Promise<void> {
  console.log('=== DÉBUT TRAITEMENT IMAGE ===');
  
  if (this.isProcessingImage) {
    console.log('⚠️ Traitement déjà en cours, ignorer...');
    return;
  }
  
  this.isProcessingImage = true;
  
  try {
    // Attendre que le DOM soit prêt
    const domReady = await this.waitForDOMElements();
    if (!domReady) {
      throw new Error('Éléments DOM non disponibles');
    }

    const img: HTMLImageElement = this.uploadedImage.nativeElement;
    const canvas: HTMLCanvasElement = this.overlayCanvasImage.nativeElement;
    
    // Vérifier que l'image est chargée
    if (!img.complete || img.naturalWidth === 0) {
      throw new Error('Image non chargée correctement');
    }
    
    // Configuration du canvas
    canvas.width = this.imageDisplayWidth;
    canvas.height = this.imageDisplayHeight;
    
    // Calculer les facteurs d'échelle pour référence
    const scaleFactors = this.calculateScaleFactors(img);
    
    // Créer l'image redimensionnée pour MediaPipe
    const resizedImage = await this.createResizedImageForMediaPipe(img);
    
    console.log(`📊 Synchronisation des dimensions:`, {
      imageNatural: `${img.naturalWidth}x${img.naturalHeight}`,
      imageDisplay: `${this.imageDisplayWidth}x${this.imageDisplayHeight}`,
      mediaPipeInput: `${resizedImage.width}x${resizedImage.height}`,
      canvasOutput: `${canvas.width}x${canvas.height}`,
      scaleFactors
    });
    
    // Détection sur l'image redimensionnée
    console.log('🔍 Début détection MediaPipe...');
    const landmarks = await this.faceMeshService.detectOnImage(resizedImage);
    console.log("resizedImage.width", resizedImage.width);
    console.log("resizedImage.height", resizedImage.height);
    // Validation des landmarks
    if (!this.validateLandmarks(landmarks)) {
      throw new Error('Validation des landmarks échouée');
    }
    //this.drawCriticalLandmarks(canvas.getContext('2d')!, landmarks);
    console.log(`✅ ${landmarks.length} landmarks détectés avec succès`);
    await this.initThreeJSForImage(this.imageDisplayWidth, this.imageDisplayHeight);
    
    // Chargement du modèle 3D si nécessaire
    if (!this.glasses3DImage && this.glass) {
      console.log('📦 Chargement du modèle 3D...');
      await this.load3DModelForImage();
    }

    if (!this.glasses3DImage) {
      throw new Error('Modèle 3D des lunettes non disponible');
    }

    // Traitement du positionnement des lunettes
    console.log('🕶️ Positionnement des lunettes...');
    await this.processGlassesPositioningWithScaling(
      landmarks, 
      this.imageDisplayWidth, 
      this.imageDisplayHeight
    );
    
    console.log('🎉 === TRAITEMENT TERMINÉ AVEC SUCCÈS ===');

  } catch (error) {
    console.error('❌ Erreur lors du traitement de l\'image:', error);  
  } finally {
    this.isProcessingImage = false;
    console.log('🔓 Verrou de traitement libéré');
  }
}
////////////////////////////
private calculateFaceDimensionsFromEyes(points: any, eyeDistance: number): {
  estimatedFaceWidth: number,
  estimatedFaceHeight: number,
  confidence: number,
  isPartialImage: boolean
} {
  let faceWidth = 0;
  let faceHeight = 0;
  let confidence = 0;
  let isPartialImage = false;

  // TENTATIVE 1: Utiliser les bords du visage s'ils sont disponibles
  if (!this.isInvalidPoint(points.leftFaceEdge) && !this.isInvalidPoint(points.rightFaceEdge)) {
    faceWidth = points.leftFaceEdge.distanceTo(points.rightFaceEdge);
    confidence += 40;
    console.log('✅ Largeur du visage détectée via les bords');
  } else {
    // ESTIMATION basée sur la distance des yeux (proportion anatomique)
    faceWidth = eyeDistance * 2.2; // Ratio moyen face/yeux
    isPartialImage = true;
    confidence += 20;
    console.log('📏 Largeur du visage estimée via les yeux');
  }

  // TENTATIVE 2: Utiliser front/menton s'ils sont disponibles
  if (!this.isInvalidPoint(points.forehead) && !this.isInvalidPoint(points.chin)) {
    faceHeight = points.forehead.distanceTo(points.chin);
    confidence += 40;
    console.log('✅ Hauteur du visage détectée via front/menton');
  } else {
    // ESTIMATION basée sur la largeur calculée (proportion anatomique)
    faceHeight = faceWidth * 1.3; // Ratio moyen hauteur/largeur
    isPartialImage = true;
    confidence += 20;
    console.log('📏 Hauteur du visage estimée via proportions');
  }

  // VALIDATION ET AJUSTEMENT
  const minFaceSize = eyeDistance * 1.5;
  const maxFaceSize = eyeDistance * 4;
  
  faceWidth = Math.max(minFaceSize, Math.min(maxFaceSize, faceWidth));
  faceHeight = Math.max(minFaceSize, Math.min(maxFaceSize, faceHeight));

  return {
    estimatedFaceWidth: faceWidth,
    estimatedFaceHeight: faceHeight,
    confidence: Math.min(100, confidence),
    isPartialImage
  };
}
private getEyeBasedPoint(l: any, imageWidth: number, imageHeight: number, eyeDistance: number): THREE.Vector3 {
  if (!l || typeof l.x !== 'number' || typeof l.y !== 'number' || typeof l.z !== 'number') {
    return new THREE.Vector3(0, 0, 0);
  }
  const x3D = (l.x - 0.5) * imageWidth;
  const y3D = (0.5 - l.y) * imageHeight;
  const z3D = l.z * eyeDistance;
  return new THREE.Vector3(x3D, y3D, z3D);
}
private extractFaceGeometry(landmarks: any[], imageWidth: number, imageHeight: number): FaceGeometry | null {
  console.log('🔍 Extraction géométrique robuste basée sur les yeux');

  if (!landmarks || landmarks.length < 468) {
    throw new Error(`Landmarks insuffisants: ${landmarks?.length || 0}/468`);
  }
  const leftEyeRaw = landmarks[33];
  const rightEyeRaw = landmarks[263];
  if (!leftEyeRaw || !rightEyeRaw) {
    console.error('❌ Landmarks des yeux manquants');
    return null;
  }
  const eyeDistancePx = Math.sqrt(
    Math.pow((leftEyeRaw.x - rightEyeRaw.x) * imageWidth, 2) +
    Math.pow((leftEyeRaw.y - rightEyeRaw.y) * imageHeight, 2)
  );
  // 3. Utilitaire pour convertir tous les points
  const getPoint = (index: number) => this.getEyeBasedPoint(landmarks[index], imageWidth, imageHeight, eyeDistancePx);

  // 4. Points critiques
  const points: any = {
    leftEyeOuter: getPoint(33),
    rightEyeOuter: getPoint(263),
    leftEyeInner: getPoint(133),
    rightEyeInner: getPoint(362),
    leftEyeTop: getPoint(159),
    leftEyeBottom: getPoint(145),
    rightEyeTop: getPoint(386),
    rightEyeBottom: getPoint(374),
    noseBridge: getPoint(168),
    noseTip: getPoint(1),
    forehead: getPoint(10),
    chin: getPoint(152),
    leftFaceEdge: getPoint(234),
    rightFaceEdge: getPoint(454),
    leftTemple: getPoint(127),
    rightTemple: getPoint(356),
    leftEar: getPoint(234),
  rightEar: getPoint(454),
  // Points additionnels pour la rotation 3D
  leftCheek: getPoint(116),
  rightCheek: getPoint(345),
  // Points pour détecter l'orientation de la tête
  leftJaw: getPoint(172),
  rightJaw: getPoint(397),
  mouthLeft: getPoint(61),
  mouthRight: getPoint(291)
  };

  // 5. Centres des yeux
  points.leftEyeCenter = this.calculateAdaptiveEyeCenter('left', points);
  points.rightEyeCenter = this.calculateAdaptiveEyeCenter('right', points);

  // 6. Validation minimale
  if (this.isInvalidPoint(points.leftEyeCenter) || this.isInvalidPoint(points.rightEyeCenter)) {
    console.error('❌ Impossible de calculer les centres des yeux');
    return null;
  }

  // 7. Calculs principaux
  const eyeCenter = new THREE.Vector3()
    .addVectors(points.leftEyeCenter, points.rightEyeCenter)
    .multiplyScalar(0.5);
  const eyeDistance = points.leftEyeCenter.distanceTo(points.rightEyeCenter);

  // 8. Largeur/hauteur du visage (optionnel, pour debug ou stats)
  const faceGeometry = this.calculateFaceDimensionsFromEyes(points, eyeDistance);

  // 9. Angle du visage
  const faceAngle = this.calculatePreciseFaceAngle(points);

  // 10. Échelle adaptative basée sur la distance des yeux
  const adaptiveScale = this.calculateEyeBasedScale(eyeDistance, faceGeometry);

  // 11. Validation de la distance inter-oculaire
  if (eyeDistance < 10 || eyeDistance > Math.min(imageWidth, imageHeight) * 0.8) {
    console.error('❌ Distance entre les yeux invalide:', eyeDistance);
    return null;
  }

  // 12. Construction de la géométrie finale
  const geometry: FaceGeometry = {
    eyeCenter: eyeCenter,
    eyeDistance: eyeDistance,
    faceWidth: faceGeometry.estimatedFaceWidth,
    faceHeight: faceGeometry.estimatedFaceHeight,
    faceAngle: faceAngle,
    noseBridgePosition: points.noseBridge,
    points: points,
    quality: this.assessPartialImageQuality(points, faceGeometry.confidence),
    adaptiveScale: adaptiveScale,
    isPartialImage: faceGeometry.isPartialImage
  };

  return geometry;
}
private calculateEyeBasedScale(eyeDistance: number, faceGeometry: any): number {
  console.log('📏 Calcul d\'échelle intelligent amélioré');
  
  // ÉCHELLE PRINCIPALE basée sur la distance inter-pupillaire
  const averageIPD = 80; // Distance moyenne en pixels d'affichage
  const baseScale = eyeDistance / averageIPD;
  
  // ANALYSE DE LA TAILLE DU VISAGE DANS L'IMAGE
  const imageArea = this.imageDisplayWidth * this.imageDisplayHeight;
  const faceArea = faceGeometry.estimatedFaceWidth * faceGeometry.estimatedFaceHeight;
  const faceImageRatio = Math.sqrt(faceArea / imageArea);
  
  // RATIO DES YEUX par rapport à l'image
  const eyeImageRatio = eyeDistance / Math.min(this.imageDisplayWidth, this.imageDisplayHeight);
  
  console.log('📊 Analyse dimensionnelle:', {
    eyeDistance: eyeDistance.toFixed(1),
    eyeImageRatio: eyeImageRatio.toFixed(3),
    faceImageRatio: faceImageRatio.toFixed(3),
    isPartialImage: faceGeometry.isPartialImage
  });
  
  // FACTEUR DE CORRECTION INTELLIGENT
  let correctionFactor = 1.0;
  
  if (faceGeometry.isPartialImage) {
    console.log('🔍 Image partielle/crop détectée'+eyeImageRatio);
    
    // Pour les images partielles, ajuster selon la proportion des yeux
    if (eyeImageRatio > 0.5) {
      // Très gros plan - réduire l'échelle
      correctionFactor = 0.1 + (eyeImageRatio - 0.25) * 0.8;
    }
    else if (eyeImageRatio > 0.25) {
      // Très gros plan - réduire l'échelle
      correctionFactor = 1.1 + (eyeImageRatio - 0.25) * 0.8;
    } else if (eyeImageRatio > 0.15) {
      // Plan rapproché normal
      correctionFactor = 0.9 + (eyeImageRatio - 0.15) * 0.5;
    } else {
      // Yeux petits même dans une image partielle
      correctionFactor = 1.1;
    }
    
  } else {
    console.log('🖼️ Image complète détectée'+faceImageRatio);
    if (faceImageRatio < 0.2) {
      // Visage petit dans l'image - augmenter l'échelle
      correctionFactor = 0.5 + (0.3 - faceImageRatio) * 2.0;
    // Pour les images complètes, ajuster selon la taille du visage
    }
    else if (faceImageRatio < 0.3) {
      // Visage petit dans l'image - augmenter l'échelle
      correctionFactor = 1.2 + (0.3 - faceImageRatio) * 2.0;
    } else if (faceImageRatio > 0.6) {
      // Visage grand dans l'image - réduire l'échelle
      correctionFactor = 1.3 - (faceImageRatio - 0.6) * 0.5;
    } else {
      // Taille normale
      correctionFactor = 1.0;
    }
  }
  console.log('distance yeux'+eyeDistance+'correction'+correctionFactor);
  // AJUSTEMENT SUPPLÉMENTAIRE basé sur eyeDistance absolu
  if (eyeDistance < 30) {
    correctionFactor *= 1.6; // Très petits yeux
  } 
  else if (eyeDistance > 250) {
    correctionFactor *= 1.8; // Très gros yeux
  }
  else if (eyeDistance > 200) {
    correctionFactor *= 1.8; // Très gros yeux
  }
  else if (eyeDistance > 120) {
    correctionFactor *= 0.7; // Très gros yeux
  }
  
  
  const finalScale = baseScale * correctionFactor;
  console.log("final"+finalScale);
  //const clampedScale = Math.max(0.3, Math.min(1.1, finalScale)); 
  //console.log("clambed scale"+clampedScale);
  return finalScale;
}
// CALCUL PRÉCIS DE L'ANGLE DU VISAGE
private calculatePreciseFaceAngle(points: any): number {
  const leftEye = points.leftEyeCenter;
  const rightEye = points.rightEyeCenter;
  
  if (this.isInvalidPoint(leftEye) || this.isInvalidPoint(rightEye)) {
    return 0;
  }
  
  // Calcul de l'inclinaison du visage
  const deltaY = rightEye.y - leftEye.y;
  const deltaX = rightEye.x - leftEye.x;
  
  if (Math.abs(deltaX) < 0.001) return 0;
  
  const angle = Math.atan2(deltaY, deltaX);
  
  // Limitation et lissage de l'angle
  const maxAngle = Math.PI / 8; // ±22.5°
  return Math.max(-maxAngle, Math.min(maxAngle, angle)) * 0.8; // Facteur de lissage
}
private calculateIntelligentGlassesPosition(faceGeometry: FaceGeometry): THREE.Vector3 {
  console.log('🎯 Calcul position optimale pour image crop');

  if (!faceGeometry || !faceGeometry.points) {
    console.error('❌ Géométrie du visage manquante');
    return new THREE.Vector3(0, 0, 0);
  }

  const points = faceGeometry.points;
  const eyeDistance = faceGeometry.eyeDistance;
  const imageWidth = this.imageDisplayWidth;
  const imageHeight = this.imageDisplayHeight;

  // 1. Centre entre les yeux
  const eyeCenter = new THREE.Vector3()
    .addVectors(points.leftEyeCenter, points.rightEyeCenter)
    .multiplyScalar(0.5);

  // 2. Profondeur (z) dynamique
  let z = (points.leftEyeCenter.z + points.rightEyeCenter.z) / 2;
  const eyeImageRatio = eyeDistance / Math.min(imageWidth, imageHeight);
  if (eyeImageRatio > 0.3) {
    z -= eyeDistance * 0.08; // Rapproche un peu les lunettes si crop/zoom
  }

  // 3. Offset vertical dynamique si menton ou front manquant
  let verticalOffset = 0;
  // if (this.isInvalidPoint(points.chin) || this.isInvalidPoint(points.forehead)) {
  //   verticalOffset = -eyeDistance *0.08; // Décale un peu vers le bas
  // }

  // 4. Appliquer la position finale
  const finalPosition = new THREE.Vector3(
    eyeCenter.x,
    eyeCenter.y + verticalOffset,
    z
  );
  return finalPosition;
}
// NOUVELLE MÉTHODE: Validation des points
private isInvalidPoint(point: THREE.Vector3): boolean {
  return !point || 
         point.equals(new THREE.Vector3(0, 0, 0)) ||
         !isFinite(point.x) || !isFinite(point.y) || !isFinite(point.z) ||
         Math.abs(point.x) > this.imageDisplayWidth/2 ||
         Math.abs(point.y) > this.imageDisplayHeight/2;
}
////////////////////////////////////////////////
private calculateAutomaticGlassesTransform(landmarks: any[], imageWidth: number, imageHeight: number) {
  console.log('🤖 Transformation automatique intelligente');
  
  // 1. EXTRACTION GÉOMÉTRIQUE AVANCÉE
  const faceGeometry = this.extractFaceGeometry(landmarks, imageWidth, imageHeight);
  
  if (!faceGeometry) {
    console.error('❌ Impossible d\'extraire la géométrie du visage');
    return null;
  }
  
  // 2. CALCULS ADAPTATIFS
  const position = this.calculateIntelligentGlassesPosition(faceGeometry);
  const scale = faceGeometry.adaptiveScale;
  const rotation = faceGeometry.faceAngle;
  //this.showReferencePoints(faceGeometry.points, this.scene3DImage,landmarks);
  // 3. VALIDATION DE QUALITÉ 
  console.log("aaaaa"+faceGeometry.quality)
  console.log('✅ Transformation automatique de haute qualité:', {
    position: `${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(4)}`,
    scale: scale.toFixed(3),
    rotation: `${(rotation * 180 / Math.PI).toFixed(1)}°`,
    quality: faceGeometry.quality + '%'
  });
  
  return {
    position: position,
    rotation: new THREE.Euler(0, 0, rotation),
    scale: new THREE.Vector3(scale, scale, scale),
    quality: faceGeometry.quality
  };
}
// NOUVELLE MÉTHODE PRINCIPALE DE POSITIONNEMENT
private positionGlassesAutomatically(glasses3D: THREE.Object3D, landmarks: any[], imageWidth: number, imageHeight: number) {
  if (!glasses3D || !landmarks || landmarks.length < 468) {
    console.error('❌ Données insuffisantes pour le positionnement intelligent');
    return false;
  }
  
  console.log('🎯 Début du positionnement intelligent');

  // 1. CALCUL DE LA TRANSFORMATION AUTOMATIQUE
  const transform = this.calculateAutomaticGlassesTransform(landmarks, imageWidth, imageHeight);
  
  if (!transform) {
    console.error('❌ Échec du calcul de transformation');
    return false;
  }

  // 2. APPLICATION DE LA TRANSFORMATION
  glasses3D.position.copy(transform.position);
  glasses3D.rotation.copy(transform.rotation);
  glasses3D.scale.copy(transform.scale);

  // 3. VALIDATION ET RENDU
  if (this.validateIntelligentTransform(transform, imageWidth, imageHeight)) {
    console.log('✅ Positionnement intelligent réussi - Qualité:', transform.quality + '%');
    this.renderScene();
    return true;
  } else {
    console.warn('⚠️ Transformation invalide, fallback appliqué');
    this.applyDefaultGlassesTransform(glasses3D, imageWidth, imageHeight);
    return false;
  }
}
// VALIDATION INTELLIGENTE DE LA TRANSFORMATION
private validateIntelligentTransform(transform: any, imageWidth: number, imageHeight: number): boolean {
  const pos = transform.position;
  const scale = transform.scale.x;
  
  // Validation étendue basée sur les dimensions
  const positionValid = 
    Math.abs(pos.x) < imageWidth * 0.7 &&
    Math.abs(pos.y) < imageHeight * 0.7 &&
    Math.abs(pos.z) < Math.min(imageWidth, imageHeight) * 0.5;
  
  const scaleValid = scale >= 0.3 && scale <= 2.5;
  
  const numericValid = 
    isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z) && 
    isFinite(scale) && !isNaN(scale);
  
  const qualityValid = transform.quality >= 40; // Seuil de qualité minimal
  
  return positionValid && scaleValid && numericValid && qualityValid;
}

private applyDefaultGlassesTransform(glasses3D: THREE.Object3D, imageWidth: number, imageHeight: number) {
  // Valeurs par défaut sécurisées basées sur les dimensions de l'image
  glasses3D.position.set(0, 0, 0); // Centre de l'image
  glasses3D.rotation.set(0, 0, 0); // Pas de rotation
  glasses3D.scale.set(0.8, 0.8, 0.8); // Échelle standard
  this.renderScene();
}
// MISE À JOUR DE LA MÉTHODE PRINCIPALE
async processGlassesPositioningWithScaling(landmarks: any[], naturalWidth: number, naturalHeight: number) {
  console.log('🔄 Traitement automatique du positionnement');
  // Utilisation directe des dimensions d'affichage (pas de conversion d'échelle)
  const success = this.positionGlassesAutomatically(
    this.glasses3DImage!, 
    landmarks, 
    this.imageDisplayWidth, 
    this.imageDisplayHeight
  );

  if (success) {
    console.log('✅ Lunettes positionnées automatiquement avec succès');
  } else {
    console.log('⚠️ Positionnement de fallback appliqué');
  }
}
//////////////////////////////////////
// ÉVALUATION DE QUALITÉ ADAPTÉE AUX PHOTOS PARTIELLES
private assessPartialImageQuality(points: any, geometryConfidence: number): number {
  let qualityScore = 0;
  
  // POINTS ESSENTIELS (yeux) - Pondération élevée
  const essentialPoints = {
    leftEyeOuter: 20,
    rightEyeOuter: 20,
    leftEyeInner: 15,
    rightEyeInner: 15,
    leftEyeCenter: 15,
    rightEyeCenter: 15
  };
  
  // POINTS OPTIONNELS - Bonus si présents
  const optionalPoints = {
    noseBridge: 10,
    leftEyeTop: 5,
    rightEyeTop: 5,
    leftEyeBottom: 5,
    rightEyeBottom: 5,
    
    leftFaceEdge: 2,
    rightFaceEdge: 2,
     // Oreilles et tempes (approximation)
  leftEar: 234,
  rightEar: 454,
  leftTemple: 127,
  rightTemple: 356,
  
  // Points additionnels pour la rotation 3D
  leftCheek: 116,
  rightCheek: 345,
  forehead: 3,
  chin: 3,
  
  // Points pour détecter l'orientation de la tête
  leftJaw: 172,
  rightJaw: 397,
  mouthLeft: 61,
  mouthRight: 291
  };
  
  // Évaluation des points essentiels
  Object.entries(essentialPoints).forEach(([pointName, weight]) => {
    const point = points[pointName];
    if (point && !this.isInvalidPoint(point)) {
      qualityScore += weight;
    }
  });
  
  // Bonus pour les points optionnels
  Object.entries(optionalPoints).forEach(([pointName, weight]) => {
    const point = points[pointName];
    if (point && !this.isInvalidPoint(point)) {
      qualityScore += weight;
    }
  });
  
  // Intégration de la confiance géométrique
  const geometryBonus = (geometryConfidence / 100) * 20;
  qualityScore += geometryBonus;
  
  // Bonus de cohérence pour les yeux
  if (qualityScore > 70) {
    const leftEye = points.leftEyeCenter;
    const rightEye = points.rightEyeCenter;
    
    if (leftEye && rightEye) {
      const eyeDistance = leftEye.distanceTo(rightEye);
      if (eyeDistance > 20 && eyeDistance < 300) {
        qualityScore += 10;
      }
    }
  }
  
  const finalQuality = Math.min(100, qualityScore);
  
  console.log('🎯 Qualité image partielle:', {
    baseScore: (qualityScore - geometryBonus).toFixed(1),
    geometryBonus: geometryBonus.toFixed(1),
    finalQuality: finalQuality.toFixed(1)
  });
  
  return finalQuality;
}
// CALCUL ADAPTATIF DU CENTRE DES YEUX
private calculateAdaptiveEyeCenter(eye: 'left' | 'right', points: any): THREE.Vector3 {
  const prefix = eye === 'left' ? 'left' : 'right';
  
  const outerCorner = points[`${prefix}EyeOuter`];
  const innerCorner = points[`${prefix}EyeInner`];
  const topLid = points[`${prefix}EyeTop`];
  const bottomLid = points[`${prefix}EyeBottom`];
  // Vérification des points essentiels
  if (this.isInvalidPoint(outerCorner) || this.isInvalidPoint(innerCorner)) {
    console.error(`❌ Points essentiels manquants pour l'œil ${eye}`);
    return new THREE.Vector3(0, 0, 0);
  }
  
  // MÉTHODE ADAPTATIVE : Plusieurs approches selon la qualité des points
  let centerX = (outerCorner.x + innerCorner.x) / 2;
  let centerY = (outerCorner.y + innerCorner.y) / 2;
  let centerZ = (outerCorner.z + innerCorner.z) / 2;
  
  // Ajustement avec les paupières si disponibles
  if (!this.isInvalidPoint(topLid) && !this.isInvalidPoint(bottomLid)) {
    const lidCenterY = (topLid.y + bottomLid.y) / 2;
    const lidCenterX = (topLid.x + bottomLid.x) / 2;
    
    // Moyenne pondérée pour plus de précision
    centerY = (centerY * 0.6) + (lidCenterY * 0.4);
    centerX = (centerX * 0.8) + (lidCenterX * 0.2);
  }
  
  return new THREE.Vector3(centerX, centerY, centerZ);
}

///////////////////////////////////////position//////////////////////////////////
private showReferencePoints(points: any, scene: THREE.Scene | THREE.Group, landmarks: any[]) {
  console.log('🎯 === DEBUG VISUEL DES POINTS ===');
  
  // Nettoyer les anciens points
  this.clearDebugPoints(scene);
  
  // Debug des conversions pour les points principaux 
  // Points de référence avec debug étendu
  const referencePoints = [
    { key: 'leftEyeOuter', index: 33, color: 0x00ff00, label: 'L-Outer(33)', size: 6 },
    { key: 'rightEyeOuter', index: 263, color: 0x00ff00, label: 'R-Outer(263)', size: 6 },
    { key: 'leftEyeInner', index: 133, color: 0x00ffff, label: 'L-Inner(133)', size: 6 },
    { key: 'rightEyeInner', index: 362, color: 0x00ffff, label: 'R-Inner(362)', size: 6 },
    { key: 'leftEyeCenter', color: 0x0000ff, label: 'L-Center', size: 8 },
    { key: 'rightEyeCenter', color: 0xffff00, label: 'R-Center', size: 8 },
    { key: 'noseBridge', index: 168, color: 0xff00ff, label: 'Nose(168)', size: 6 },
    { key: 'forehead', index: 10, color: 0xff00ff, label: 'Forehead(10)', size: 6 },
    { key: 'chin', index: 152, color: 0xff00ff, label: 'Chin(152)', size: 6 },
    { key: 'leftFaceEdge', index: 234, color: 0xff00ff, label: 'Left-Face(234)', size: 6 },
    { key: 'rightFaceEdge', index: 454, color: 0xff00ff, label: 'Right-Face(454)', size: 6 },
    { key: 'leftTemple', index: 127, color: 0xff00ff, label: 'Left-Temple(127)', size: 6 },
    { key: 'rightTemple', index: 356, color: 0xff00ff, label: 'Right-Temple(356)', size: 6 },
  ];
  
  console.log('\n📊 Positions des points:');
  
  referencePoints.forEach(ref => {
    const pt = points[ref.key];
    
    if (pt && !pt.equals(new THREE.Vector3(0, 0, 0))) {
      // Créer la sphère de debug
      const geometry = new THREE.SphereGeometry(ref.size, 16, 16);
      const material = new THREE.MeshBasicMaterial({ 
        color: ref.color,
        transparent: true,
        opacity: 0.9
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(pt.x, pt.y, pt.z);
      sphere.name = 'debug_point';
      scene.add(sphere);
      
      console.log(`🎯 ${ref.label}:`, {
        position: `(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}, ${pt.z.toFixed(1)})`,
        inBoundsX: Math.abs(pt.x) <= this.imageDisplayWidth / 2,
        inBoundsY: Math.abs(pt.y) <= this.imageDisplayHeight / 2,
        distanceFromCenter: Math.sqrt(pt.x * pt.x + pt.y * pt.y).toFixed(1)
      });
      
      // Debug de la conversion si on a l'index
      if (ref.index && landmarks[ref.index]) {
        const raw = landmarks[ref.index];
        console.log(`    Raw: (${raw.x.toFixed(3)}, ${raw.y.toFixed(3)}, ${raw.z.toFixed(3)})`);
        
        // Test des différentes méthodes de conversion
      }
    } else {
      console.warn(`⚠️ Point ${ref.key} manquant ou invalide`);
    }
  });
  
  // Position finale des lunettes avec debug
  if (points.leftEyeCenter && points.rightEyeCenter) {
    const glassesCenter = new THREE.Vector3()
      .addVectors(points.leftEyeCenter, points.rightEyeCenter)
      .multiplyScalar(0.5);
      
    const glassesGeometry = new THREE.SphereGeometry(10, 16, 16);
    const glassesMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      transparent: true,
      opacity: 0.7
    });
    const glassesSphere = new THREE.Mesh(glassesGeometry, glassesMaterial);
    glassesSphere.position.copy(glassesCenter);
    glassesSphere.name = 'debug_point';
    scene.add(glassesSphere);
    
    console.log('\n🥽 Position lunettes:', {
      center: `(${glassesCenter.x.toFixed(1)}, ${glassesCenter.y.toFixed(1)}, ${glassesCenter.z.toFixed(1)})`,
      eyeDistance: points.leftEyeCenter.distanceTo(points.rightEyeCenter).toFixed(1),
      inImageBounds: this.isPositionInImageBounds(glassesCenter)
    });
  }
  
  // Ajouter des points de référence aux coins de l'image
  this.addImageBoundsDebug(scene);
}
// VÉRIFICATION SI UN POINT EST DANS LES LIMITES DE L'IMAGE
private isPositionInImageBounds(position: THREE.Vector3): boolean {
  return Math.abs(position.x) <= this.imageDisplayWidth / 2 && 
         Math.abs(position.y) <= this.imageDisplayHeight / 2;
}

// DEBUG DES LIMITES DE L'IMAGE
private addImageBoundsDebug(scene: THREE.Scene | THREE.Group) {
  const corners = [
    { pos: new THREE.Vector3(-this.imageDisplayWidth/2, -this.imageDisplayHeight/2, 0), color: 0xff0000, name: 'Top-Left' },
    { pos: new THREE.Vector3(this.imageDisplayWidth/2, -this.imageDisplayHeight/2, 0), color: 0x00ff00, name: 'Top-Right' },
    { pos: new THREE.Vector3(-this.imageDisplayWidth/2, this.imageDisplayHeight/2, 0), color: 0x0000ff, name: 'Bottom-Left' },
    { pos: new THREE.Vector3(this.imageDisplayWidth/2, this.imageDisplayHeight/2, 0), color: 0xffff00, name: 'Bottom-Right' },
    { pos: new THREE.Vector3(0, 0, 0), color: 0xff00ff, name: 'Center' }
  ];
  
  console.log('\n🔲 Coins de l\'image (système Three.js):');
  
  corners.forEach(corner => {
    const geometry = new THREE.SphereGeometry(8, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
      color: corner.color,
      transparent: true,
      opacity: 0.5
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(corner.pos);
    sphere.name = 'debug_bounds';
    scene.add(sphere);
    const axesHelper = new THREE.AxesHelper(100);
scene.add(axesHelper);
    console.log(`  ${corner.name}: (${corner.pos.x}, ${corner.pos.y})`);
  });
}
private clearDebugPoints(scene: THREE.Scene | THREE.Group) {
  const pointsToRemove: THREE.Object3D[] = [];
  scene.traverse((child) => {
    if (child.name === 'debug_point') {
      pointsToRemove.push(child);
    }
  });
  
  pointsToRemove.forEach(point => {
    scene.remove(point);
  });
}
////////
/////////////////////////////////////////////////////////////////////
// Initialisation de la scène Three.js pour l'image - Version améliorée
  private async initThreeJSForImage(width: number, height: number): Promise<void> {
    return new Promise((resolve) => {
      // Configuration de la scène
      this.scene3DImage = new THREE.Scene();
      this.scene3DImage.background = null;

      // Amélioration 1: Éclairage plus réaliste
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
      directionalLight.position.set(0, 0, 200);
      directionalLight.castShadow = false; // Pas d'ombres pour les lunettes

      // Lumière d'appoint pour éviter les zones trop sombres
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
      fillLight.position.set(0, 100, 100);

      this.scene3DImage.add(ambientLight);
      this.scene3DImage.add(directionalLight);
      this.scene3DImage.add(fillLight);

      // Amélioration 2: Configuration de caméra adaptative
      const aspectRatio = width / height;
      //const fov = this.calculateOptimalFOV(faceGeometry,width,height);
      const fov = 50;
      this.camera3DImage = new THREE.PerspectiveCamera(fov, aspectRatio, 0.1, 3000);

      // Distance de caméra adaptée à la taille de l'image
      const cameraDistance = (height / 2) / Math.tan((fov * Math.PI / 180) / 2);
      this.camera3DImage.position.set(0, 0, cameraDistance);
      this.camera3DImage.lookAt(0, 0, 0);

      // Amélioration 3: Configuration du renderer optimisée
      this.renderer3DImage = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true // Pour les captures d'écran
      });
      this.renderer3DImage.setSize(width, height);
      this.renderer3DImage.setClearColor(0x000000, 0);
      this.renderer3DImage.shadowMap.enabled = false; // Pas d'ombres nécessaires

      // Nettoyage et ajout du canvas
      this.threeContainerImage.nativeElement.innerHTML = '';
      this.threeContainerImage.nativeElement.appendChild(this.renderer3DImage.domElement);

      console.log('Three.js initialisé pour image:', {
        dimensions: `${width}x${height}`,
        aspectRatio: aspectRatio.toFixed(2),
        fov: fov.toFixed(1) + '°',
        cameraDistance: cameraDistance.toFixed(1)
      });

      if (this.glass) {
        resolve();
        //this.load3DModelForImage().then(() => resolve());
      } else {
        resolve();
      }
    });
  }
   // Calcul du FOV optimal basé sur les dimensions de l'image
   private calculateOptimalFOV(faceGeometry: FaceGeometry,width: number, height: number): number {
  
    const baseFOV =50; // Augmenté de 45 à 60
    const faceRatio = faceGeometry.eyeDistance / Math.max(faceGeometry.faceWidth, faceGeometry.faceHeight);
if (faceRatio > 0.25) return baseFOV + 20; // Visage proche
if (faceRatio < 0.15) return baseFOV - 10; // Visage lointain
    return baseFOV;
  }
  // SOLUTION 3: Méthode load3DModelForImage améliorée
private async load3DModelForImage(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('Chargement du modèle 3D pour image...');

    // Nettoyage du modèle précédent
    if (this.glasses3DImage && this.scene3DImage) {
      this.scene3DImage.remove(this.glasses3DImage);
      this.glasses3DImage = undefined;
    }

    // Vérification du chemin du modèle
    if (!this.model3DPath) {
      console.error('Aucun chemin de modèle 3D défini');
      reject(new Error('Aucun modèle 3D sélectionné'));
      return;
    }

    // Vérification que la scène existe
    if (!this.scene3DImage) {
      console.error('Scène 3D non initialisée');
      reject(new Error('Scène 3D non initialisée'));
      return;
    }

    const loader = new GLTFLoader();
    console.log('Chargement depuis:', this.model3DPath);

    loader.load(
      this.getModel3DPathFromGlass(this.glass),
      (gltf) => {
        console.log('✓ Modèle 3D chargé avec succès');
        this.glasses3DImage = gltf.scene;
        // Configuration initiale du modèle - ÉCHELLE PLUS GRANDE
        this.glasses3DImage.scale.set(1,1,1); // Échelle plus grande
        this.glasses3DImage.position.set(0, 0,0);
        this.glasses3DImage.rotation.set(0, 0, 0);

        this.glasses3DImage.visible = true;
        // Ajouter à la scène
        this.scene3DImage.add(this.glasses3DImage);
        // Rendu immédiat pour vérifier la visibilité
        this.renderScene();

        resolve();
      },
      (progress) => {
        console.log('Progression du chargement:', (progress.loaded / progress.total * 100).toFixed(1) + '%');
      },
      (error) => {
        console.error('Erreur de chargement du modèle 3D:', error);
        reject(error);
      }
    );
  });
}
private renderScene(points?: any) {
  if (!this.renderer3DImage || !this.scene3DImage || !this.camera3DImage) {
    console.error('Éléments manquants pour le rendu');
    return;
  }

  // Mise à jour de la caméra
  this.camera3DImage.updateMatrixWorld();
  
  // Vérifier les objets visibles
  let visibleMeshes = 0;
  this.scene3DImage.traverse((object) => {
    if (object.visible && object instanceof THREE.Mesh) {
      visibleMeshes++;
    }
  });
  
  console.log(`Rendu - Meshes visibles: ${visibleMeshes}`);

  // Rendu avec clear explicite
  this.renderer3DImage.clear();
  this.renderer3DImage.render(this.scene3DImage, this.camera3DImage);
  
  // Forcer la mise à jour du DOM
  if (this.cdr) {
    this.cdr.detectChanges();
  }
}
////////////////////////////////
////////////////////////////////
// SYSTÈME DE DEBUG VISUEL COMPLET POUR LES LANDMARKS
// 1. MÉTHODE PRINCIPALE DE DEBUG VISUEL
private debugVisualizeLandmarks(landmarks: any[], canvas: HTMLCanvasElement, showAll: boolean = false) {
  console.log('🎨 Début du debug visuel des landmarks');
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('❌ Impossible d\'obtenir le contexte 2D du canvas');
    return;
  }

  // Effacer le canvas précédent
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Configuration du style
  ctx.lineWidth = 2;
  ctx.font = '12px Arial';
  
  if (showAll) {
    // Afficher TOUS les landmarks (468 points)
    this.drawAllLandmarks(ctx, landmarks);
  } else {
    // Afficher seulement les points critiques pour les lunettes
    this.drawCriticalLandmarks(ctx, landmarks);
  }
  
  // Dessiner les connexions entre les points importants
  this.drawFaceStructure(ctx, landmarks);
  
  // Afficher les statistiques
  this.drawLandmarkStats(ctx, landmarks);
  
  console.log('✅ Debug visuel terminé');
}

// 2. DESSINER TOUS LES LANDMARKS (MODE DEBUG COMPLET)
private drawAllLandmarks(ctx: CanvasRenderingContext2D, landmarks: any[]) {
  console.log('🔍 Affichage de tous les landmarks');
  
  landmarks.forEach((landmark, index) => {
    if (!landmark || typeof landmark.x !== 'number') return;
    
    // Conversion vers les coordonnées du canvas
    const x = landmark.x * this.imageDisplayWidth;
    const y = landmark.y * this.imageDisplayHeight;
    
    // Couleur selon la région du visage
    let color = this.getLandmarkColor(index);
    
    // Dessiner le point
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, 2 * Math.PI);
    ctx.fill();
    
    // Numéroter les points importants
    if (this.isCriticalLandmark(index)) {
      ctx.fillStyle = 'white';
      ctx.fillText(index.toString(), x + 3, y - 3);
    }
  });
}

// 3. DESSINER SEULEMENT LES POINTS CRITIQUES POUR LES LUNETTES
private drawCriticalLandmarks(ctx: CanvasRenderingContext2D, landmarks: any[]) {
  console.log('👁️ Affichage des points critiques pour lunettes');
  
  // Points critiques avec leurs rôles
  const criticalPoints = {
    // Yeux
    leftEyeOuter: { index: 33, color: '#00FF00', size: 8, label: 'L-Outer' },
    rightEyeOuter: { index: 263, color: '#00FF00', size: 8, label: 'R-Outer' },
    leftEyeInner: { index: 133, color: '#0080FF', size: 6, label: 'L-Inner' },
    rightEyeInner: { index: 362, color: '#0080FF', size: 6, label: 'R-Inner' },
    leftEyeTop: { index: 159, color: '#FF8000', size: 4, label: 'L-Top' },
    leftEyeBottom: { index: 145, color: '#FF8000', size: 4, label: 'L-Bot' },
    rightEyeTop: { index: 386, color: '#FF8000', size: 4, label: 'R-Top' },
    rightEyeBottom: { index: 374, color: '#FF8000', size: 4, label: 'R-Bot' },
    
    // Nez et structure
    noseBridge: { index: 168, color: '#FF00FF', size: 8, label: 'Nose' },
    noseTop: { index: 6, color: '#FF00FF', size: 4, label: 'N-Top' },
    noseBottom: { index: 2, color: '#FF00FF', size: 4, label: 'N-Bot' },
    
    // Points de référence
    forehead: { index: 10, color: '#FFFF00', size: 6, label: 'Forehead' },
    chin: { index: 152, color: '#FFFF00', size: 6, label: 'Chin' },
    
    // Tempes (pour la largeur des lunettes)
    leftTemple: { index: 234, color: '#FF0080', size: 6, label: 'L-Temple' },
    rightTemple: { index: 454, color: '#FF0080', size: 6, label: 'R-Temple' }
  };

  Object.entries(criticalPoints).forEach(([name, config]) => {
    const landmark = landmarks[config.index];
    if (!landmark || typeof landmark.x !== 'number') {
      console.warn(`⚠️ Point ${name} (${config.index}) manquant`);
      return;
    }
    
    const x = landmark.x * this.imageDisplayWidth;
    const y = landmark.y * this.imageDisplayHeight;
    
    // Dessiner le point
    ctx.fillStyle = config.color;
    ctx.beginPath();
    ctx.arc(x, y, config.size, 0, 2 * Math.PI);
    ctx.fill();
    
    // Contour noir pour meilleure visibilité
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Label avec fond
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x + 8, y - 15, ctx.measureText(config.label).width + 4, 12);
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.fillText(config.label, x + 10, y - 6);
    
    // Coordonnées détaillées pour debug
    const coordText = `(${landmark.x.toFixed(3)}, ${landmark.y.toFixed(3)})`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(x + 8, y + 2, ctx.measureText(coordText).width + 4, 12);
    ctx.fillStyle = 'black';
    ctx.font = '9px monospace';
    ctx.fillText(coordText, x + 10, y + 12);
  });
}

// 4. DESSINER LA STRUCTURE DU VISAGE (CONNEXIONS)
private drawFaceStructure(ctx: CanvasRenderingContext2D, landmarks: any[]) {
  console.log('🔗 Dessin des connexions faciales');
  
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  
  // Connexions importantes pour les lunettes
  const connections = [
    // Ligne des yeux
    [33, 133],   // Œil gauche (outer -> inner)
    [362, 263],  // Œil droit (inner -> outer)
    [133, 362],  // Bridge entre les yeux
    
    // Structure nasale
    [168, 6],    // Bridge vers haut du nez
    [6, 2],      // Haut vers bas du nez
    
    // Ligne de référence horizontale
    [234, 454],  // Temple à temple
    
    // Axe vertical du visage
    [10, 152],   // Front vers menton
  ];
  
  connections.forEach(([start, end]) => {
    const startPoint = landmarks[start];
    const endPoint = landmarks[end];
    
    if (startPoint && endPoint && 
        typeof startPoint.x === 'number' && typeof endPoint.x === 'number') {
      
      const x1 = startPoint.x * this.imageDisplayWidth;
      const y1 = startPoint.y * this.imageDisplayHeight;
      const x2 = endPoint.x * this.imageDisplayWidth;
      const y2 = endPoint.y * this.imageDisplayHeight;
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  });
  
  // Dessiner les centres calculés des yeux
  this.drawCalculatedEyeCenters(ctx, landmarks);
}

// 5. DESSINER LES CENTRES CALCULÉS DES YEUX
private drawCalculatedEyeCenters(ctx: CanvasRenderingContext2D, landmarks: any[]) {
  // Recalculer les centres comme dans votre code principal
  const leftEyeCenter = this.calculateEyeCenterForDebug('left', landmarks);
  const rightEyeCenter = this.calculateEyeCenterForDebug('right', landmarks);
  
  if (leftEyeCenter && rightEyeCenter) {
    // Centre œil gauche
    ctx.fillStyle = '#0000FF';
    ctx.beginPath();
    ctx.arc(leftEyeCenter.x, leftEyeCenter.y, 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Centre œil droit
    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.arc(rightEyeCenter.x, rightEyeCenter.y, 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    
    // Ligne entre les centres
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftEyeCenter.x, leftEyeCenter.y);
    ctx.lineTo(rightEyeCenter.x, rightEyeCenter.y);
    ctx.stroke();
    
    // Distance entre les yeux
    const distance = Math.sqrt(
      Math.pow(rightEyeCenter.x - leftEyeCenter.x, 2) + 
      Math.pow(rightEyeCenter.y - leftEyeCenter.y, 2)
    );
    
    const midX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
    const midY = (leftEyeCenter.y + rightEyeCenter.y) / 2;
    
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.fillRect(midX - 30, midY - 25, 60, 20);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${distance.toFixed(1)}px`, midX, midY - 10);
    ctx.textAlign = 'left';
  }
}

// 6. MÉTHODE AUXILIAIRE POUR CALCULER LES CENTRES (VERSION DEBUG)
private calculateEyeCenterForDebug(eye: 'left' | 'right', landmarks: any[]): {x: number, y: number} | null {
  const indices = eye === 'left' ? 
    { outer: 33, inner: 133, top: 159, bottom: 145 } :
    { outer: 263, inner: 362, top: 386, bottom: 374 };
  
  const points = {
    outer: landmarks[indices.outer],
    inner: landmarks[indices.inner],
    top: landmarks[indices.top],
    bottom: landmarks[indices.bottom]
  };
  
  if (!points.outer || !points.inner) return null;
  
  const centerX = ((points.outer.x + points.inner.x) / 2) * this.imageDisplayWidth;
  const centerY = ((points.outer.y + points.inner.y) / 2) * this.imageDisplayHeight;
  
  return { x: centerX, y: centerY };
}

// 7. AFFICHER LES STATISTIQUES
private drawLandmarkStats(ctx: CanvasRenderingContext2D, landmarks: any[]) {
  const stats = this.calculateLandmarkStatistics(landmarks);
  
  // Fond pour les stats
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(10, 10, 250, 120);
  
  // Texte des statistiques
  ctx.fillStyle = 'white';
  ctx.font = '12px monospace';
  
  const statsText = [
    `Landmarks détectés: ${stats.totalCount}/468`,
    `Points valides: ${stats.validCount} (${stats.validPercentage.toFixed(1)}%)`,
    `Distance yeux: ${stats.eyeDistance.toFixed(1)}px`,
    `Qualité détection: ${stats.quality}`,
    `Symétrie faciale: ${stats.symmetry.toFixed(3)}`,
    `Bounds check: ${stats.inBounds ? '✓' : '✗'}`,
    `Z-depth range: ${stats.depthRange.min.toFixed(3)} → ${stats.depthRange.max.toFixed(3)}`
  ];
  
  statsText.forEach((text, index) => {
    ctx.fillText(text, 15, 30 + index * 15);
  });
}

// 8. CALCULER LES STATISTIQUES DES LANDMARKS
private calculateLandmarkStatistics(landmarks: any[]) {
  let validCount = 0;
  let inBoundsCount = 0;
  let zValues: number[] = [];
  
  landmarks.forEach(landmark => {
    if (landmark && typeof landmark.x === 'number' && 
        typeof landmark.y === 'number' && typeof landmark.z === 'number') {
      validCount++;
      zValues.push(landmark.z);
      
      if (landmark.x >= 0 && landmark.x <= 1 && 
          landmark.y >= 0 && landmark.y <= 1) {
        inBoundsCount++;
      }
    }
  });
  
  // Calculer la distance des yeux et la symétrie
  const leftEye = landmarks[133]; // Inner corner left
  const rightEye = landmarks[362]; // Inner corner right
  let eyeDistance = 0;
  let symmetry = 0;
  
  if (leftEye && rightEye) {
    eyeDistance = Math.sqrt(
      Math.pow((rightEye.x - leftEye.x) * this.imageDisplayWidth, 2) +
      Math.pow((rightEye.y - leftEye.y) * this.imageDisplayHeight, 2)
    );
    
    symmetry = Math.abs(Math.abs(leftEye.x - 0.5) - Math.abs(rightEye.x - 0.5));
  }
  
  const validPercentage = (validCount / landmarks.length) * 100;
  const quality = validPercentage > 95 ? 'Excellente' :
                 validPercentage > 85 ? 'Bonne' :
                 validPercentage > 70 ? 'Moyenne' : 'Faible';
  
  return {
    totalCount: landmarks.length,
    validCount,
    validPercentage,
    inBounds: inBoundsCount === validCount,
    eyeDistance,
    symmetry,
    quality,
    depthRange: {
      min: Math.min(...zValues),
      max: Math.max(...zValues)
    }
  };
}

// 9. MÉTHODES UTILITAIRES
private getLandmarkColor(index: number): string {
  // Couleurs par région faciale
  if (index >= 0 && index <= 16) return '#FF6B6B';      // Contour visage
  if (index >= 17 && index <= 21) return '#4ECDC4';     // Sourcil droit
  if (index >= 22 && index <= 26) return '#45B7D1';     // Sourcil gauche
  if (index >= 27 && index <= 35) return '#96CEB4';     // Nez
  if (index >= 36 && index <= 47) return '#FFEAA7';     // Œil droit
  if (index >= 48 && index <= 67) return '#DDA0DD';     // Lèvres
  if (index >= 68 && index <= 83) return '#98D8C8';     // Lèvres intérieures
  return '#F7DC6F'; // Autres points
}
debugMode: boolean = false;
showAllLandmarks: boolean = false;
private isCriticalLandmark(index: number): boolean {
  const criticalIndices = [33, 263, 133, 362, 159, 145, 386, 374, 168, 10, 152, 234, 454];
  return criticalIndices.includes(index);
}

// 10. MÉTHODES D'ACTIVATION DU DEBUG
public enableLandmarkDebug(showAll: boolean = false) {
  console.log('🎨 Activation du debug visuel des landmarks');
  this.debugMode = true;
  this.showAllLandmarks = showAll;
}

public disableLandmarkDebug() {
  console.log('🎨 Désactivation du debug visuel');
  this.debugMode = false;
  // Nettoyer le canvas
  if (this.overlayCanvasImage?.nativeElement) {
    const ctx = this.overlayCanvasImage.nativeElement.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, this.overlayCanvasImage.nativeElement.width, this.overlayCanvasImage.nativeElement.height);
    }
  }
}
}
