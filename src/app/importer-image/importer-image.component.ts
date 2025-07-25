
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, AfterViewInit, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { FaceMeshService } from '../services/face-mesh.service';
import { Subscription, BehaviorSubject, Observable, async } from 'rxjs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Input } from '@angular/core';
import { Glasses } from '../classes/glasses';
import { CommonModule } from '@angular/common';
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
  private readonly FACE_LANDMARKS = {
    // Yeux
    leftEyeCenter: 159,
    rightEyeCenter: 386,
    leftEyeOuter: 33,
    rightEyeOuter: 263,
    leftEyeInner: 133,
    rightEyeInner: 362,
    
    // Nez
    noseBridge: 168,
    noseTop: 6,
    noseTip: 1,
    
    // Oreilles et tempes (approximation)
    leftEar: 234,
    rightEar: 454,
    leftTemple: 127,
    rightTemple: 356,
    
    // Points additionnels pour la rotation 3D
    leftCheek: 116,
    rightCheek: 345,
    forehead: 10,
    chin: 175,
    
    // Points pour détecter l'orientation de la tête
    leftJaw: 172,
    rightJaw: 397,
    mouthLeft: 61,
    mouthRight: 291
  };
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
    
    // Calculer les statistiques de redimensionnement
    const originalSize = (img.naturalWidth * img.naturalHeight) / (1024 * 1024); // en MP
    const displaySize = (dimensions.width * dimensions.height) / (1024 * 1024); // en MP
    const reductionRatio = (dimensions.width / img.naturalWidth);
    
    console.log('📏 Redimensionnement appliqué:', {
      original: {
        dimensions: `${img.naturalWidth}x${img.naturalHeight}`,
        size: `${originalSize.toFixed(2)} MP`
      },
      display: {
        dimensions: `${this.imageDisplayWidth}x${this.imageDisplayHeight}`,
        size: `${displaySize.toFixed(2)} MP`
      },
      reduction: `${(100 - reductionRatio * 100).toFixed(1)}%`,
      ratio: reductionRatio.toFixed(3)
    });
    
    // Déclencher la détection des changements pour mettre à jour le template
    this.cdr.detectChanges();
    
    // Lancer le traitement après mise à jour des dimensions
    setTimeout(() => {
      this.onImageLoaded();
    }, 150); // Délai légèrement augmenté pour assurer la stabilité
  }
@Output() imageUploaded = new EventEmitter<File>();
  @ViewChild('fileInput') fileInput!: ElementRef;
  
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
    private isDomReady = false;
private isProcessingImage = false;
async onImageLoaded() {
  console.log('=== DÉBUT TRAITEMENT IMAGE ===');
  if (this.isProcessingImage) {
    console.log('⚠️ Traitement déjà en cours, ignorer...');
    return;
  }
  this.isProcessingImage = true;
  
  try {
    // Attendre que les éléments DOM soient disponibles
    const domReady = await this.waitForDOMElements();
    if (!domReady) {
      console.error('Éléments DOM non disponibles');
      return;
    }

    const img: HTMLImageElement = this.uploadedImage.nativeElement;
    const canvas: HTMLCanvasElement = this.overlayCanvasImage.nativeElement;

    // IMPORTANT: Utiliser les dimensions d'affichage pour le canvas
    // mais les dimensions naturelles pour la détection
    canvas.width = this.imageDisplayWidth;
    canvas.height = this.imageDisplayHeight;
    
    console.log(`Synchronisation réussie:`, {
      imageNatural: `${img.naturalWidth}x${img.naturalHeight}`,
      imageDisplay: `${this.imageDisplayWidth}x${this.imageDisplayHeight}`,
      canvasSize: `${canvas.width}x${canvas.height}`
    });

    // Détection sur l'image naturelle
    const landmarks = await this.faceMeshService.detectOnImage(img);

    if (!landmarks || landmarks.length < 468) {
      console.error('Aucun visage détecté ou landmarks insuffisants:', landmarks?.length || 0);
      return;
    }

    console.log(`✓ Landmarks détectés: ${landmarks.length}`);

    // Initialiser Three.js avec les dimensions d'affichage
    await this.initThreeJSForImage(this.imageDisplayWidth, this.imageDisplayHeight);
    console.log('✓ Three.js initialisé');

    // Charger le modèle 3D
    if (!this.glasses3DImage && this.glass) {
      await this.load3DModelForImage();
      console.log('✓ Modèle 3D chargé');
    }

    if (!this.glasses3DImage) {
      console.error('Aucun modèle 3D de lunettes disponible');
      return;
    }

    // Traitement avec conversion des coordonnées
    await new Promise(resolve => setTimeout(resolve, 100));
    await this.processGlassesPositioningWithScaling(landmarks, img.naturalWidth, img.naturalHeight);

    console.log('=== TRAITEMENT TERMINÉ ===');

  } catch (error) {
    console.error('Erreur lors du traitement de l\'image:', error);
  } finally {
    this.isProcessingImage = false;
  }
}
// private async processGlassesPositioningWithScaling(landmarks: any[], naturalWidth: number, naturalHeight: number) {
//   console.log('--- Début positionnement avec conversion d\'échelle ---');

//   // Calculer le ratio de conversion entre dimensions naturelles et d'affichage
//   const scaleX = this.imageDisplayWidth / naturalWidth;
//   const scaleY = this.imageDisplayHeight / naturalHeight;

//   console.log('Ratios de conversion:', {
//     scaleX: scaleX.toFixed(3),
//     scaleY: scaleY.toFixed(3),
//     natural: `${naturalWidth}x${naturalHeight}`,
//     display: `${this.imageDisplayWidth}x${this.imageDisplayHeight}`
//   });

//   // Extraire les points avec les dimensions d'affichage
//   const points = this.extractGlassesPointsForDisplay(landmarks, scaleX, scaleY);
  
//   // Calcul de la transformation
//   const transform = this.calculateGlassesTransformForImage(points, this.imageDisplayWidth, this.imageDisplayHeight);

//   // Validation et correction
//   const validationMetrics = {
//     ...points.faceMetrics,
//     imageSize: { width: this.imageDisplayWidth, height: this.imageDisplayHeight }
//   };

//   if (!this.validateGlassesPosition(transform, validationMetrics)) {
//     console.warn('⚠️ Position invalide, correction automatique...');
//     const correctedTransform = this.correctGlassesTransform(transform, points, validationMetrics);
//     transform.position.copy(correctedTransform.position);
//     transform.rotation.copy(correctedTransform.rotation);
//   }

//   // Positionnement final
//   this.positionGlassesForImage(this.glasses3DImage!, transform, points);
//   this.renderScene(points);
//   console.log('✓ Lunettes positionnées avec succès');
// }
// private extractGlassesPointsForDisplay(landmarks: any[], scaleX: number, scaleY: number) {
//   const getPoint = (index: number) => {
//     const l = landmarks[index];
//     return new THREE.Vector3(
//       (l.x - 0.5) * this.imageDisplayWidth,   // Utiliser dimensions d'affichage
//       -(l.y - 0.5) * this.imageDisplayHeight, // Utiliser dimensions d'affichage
//       l.z * this.imageDisplayWidth * 0.1      // Utiliser dimensions d'affichage
//     );
//   };

//   const getSafe = (index: number) => {
//     const l = landmarks[index];
//     if (!l) {
//       console.warn(`⚠️ Landmark ${index} manquant → retourne (0,0,0)`);
//       return new THREE.Vector3(0, 0, 0);
//     }
//     return getPoint(index);
//   };

//   const points: any = {
//     leftEye: getSafe(this.FACE_LANDMARKS.leftEyeCenter),
//     rightEye: getSafe(this.FACE_LANDMARKS.rightEyeCenter),
//     leftEyeOuter: getSafe(this.FACE_LANDMARKS.leftEyeOuter),
//     rightEyeOuter: getSafe(this.FACE_LANDMARKS.rightEyeOuter),
//     leftEyeInner: getSafe(this.FACE_LANDMARKS.leftEyeInner),
//     rightEyeInner: getSafe(this.FACE_LANDMARKS.rightEyeInner),
//     noseBridge: getSafe(this.FACE_LANDMARKS.noseBridge),
//     noseTip: getSafe(this.FACE_LANDMARKS.noseTip),
//     forehead: getSafe(this.FACE_LANDMARKS.forehead),
//     chin: getSafe(this.FACE_LANDMARKS.chin),
//     leftTemple: getSafe(this.FACE_LANDMARKS.leftTemple),
//     rightTemple: getSafe(this.FACE_LANDMARKS.rightTemple),
//   };

//   // Centre des yeux
//   points.eyeCenter = new THREE.Vector3()
//     .addVectors(points.leftEye, points.rightEye)
//     .multiplyScalar(0.5);

//   // Métriques adaptées aux dimensions d'affichage
//   points.faceMetrics = {
//     eyeDistance: points.leftEye.distanceTo(points.rightEye),
//     faceWidth: Math.abs(points.rightEyeOuter.x - points.leftEyeOuter.x),
//     faceHeight: Math.abs(points.forehead.y - points.chin.y),
//     noseLength: Math.abs(points.noseTip.z - points.noseBridge.z),
//     templeWidth: Math.abs(points.rightTemple.x - points.leftTemple.x),
//   };

//   console.log('Points extraits pour affichage:', {
//     eyeCenter: points.eyeCenter,
//     eyeDistance: points.faceMetrics.eyeDistance.toFixed(1),
//     displayDimensions: `${this.imageDisplayWidth}x${this.imageDisplayHeight}`
//   });

//   return points;
// }
// SOLUTION AUTOMATIQUE SANS OFFSETS MANUELS
// Basée uniquement sur les dimensions et positions réelles du visage

private calculateAutomaticGlassesTransform(landmarks: any[], imageWidth: number, imageHeight: number) {
  console.log('🤖 Calcul automatique basé sur les dimensions du visage');
  
  // 1. EXTRACTION DES POINTS CLÉS DU VISAGE
  const facePoints = this.extractFaceGeometry(landmarks, imageWidth, imageHeight);
  
  // 2. CALCUL AUTOMATIQUE DE LA POSITION
  const position = this.calculateGlassesPosition(facePoints);
  
  // 3. CALCUL AUTOMATIQUE DE L'ÉCHELLE
  const scale = this.calculateGlassesScale(facePoints);
  
  // 4. CALCUL AUTOMATIQUE DE LA ROTATION
  const rotation = this.calculateGlassesRotation(facePoints);
  
  console.log('📐 Transform automatique calculé:', {
    position: `${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`,
    scale: scale.toFixed(3),
    rotation: `${(rotation * 180 / Math.PI).toFixed(1)}°`
  });
  
  return {
    position: position,
    rotation: new THREE.Euler(0, 0, rotation),
    scale: new THREE.Vector3(scale, scale, scale)
  };
}

private extractFaceGeometry(landmarks: any[], imageWidth: number, imageHeight: number) {
  // Conversion des landmarks en coordonnées 3D centrées
  const getPoint = (index: number) => {
    const l = landmarks[index];
    return new THREE.Vector3(
      (l.x - 0.5) * imageWidth,   // Centrage automatique X
      -(l.y - 0.5) * imageHeight, // Centrage automatique Y (inversé)
      l.z * imageWidth * 0.1      // Profondeur proportionnelle
    );
  };

  // Points essentiels du visage
  const points: any = {
    // Yeux (centres et coins)
    leftEyeCenter: getPoint(159),
    rightEyeCenter: getPoint(386),
    leftEyeOuter: getPoint(33),
    rightEyeOuter: getPoint(263),
    leftEyeInner: getPoint(133),
    rightEyeInner: getPoint(362),
    
    // Structure du nez
    noseBridge: getPoint(168),
    noseTip: getPoint(1),
    noseTop: getPoint(6),
    
    // Contour du visage
    leftCheek: getPoint(116),
    rightCheek: getPoint(345),
    forehead: getPoint(10),
    chin: getPoint(175),
    
    // Tempes et oreilles
    leftTemple: getPoint(127),
    rightTemple: getPoint(356),
  };

  // CALCULS GÉOMÉTRIQUES AUTOMATIQUES
  const geometry = {
    // Centre des yeux (point d'ancrage principal)
    eyeCenter: new THREE.Vector3()
      .addVectors(points.leftEyeCenter, points.rightEyeCenter)
      .multiplyScalar(0.5),
    
    // Distance inter-pupillaire (IPD)
    eyeDistance: points.leftEyeCenter.distanceTo(points.rightEyeCenter),
    
    // Largeur du visage (mesurée aux coins externes des yeux)
    faceWidth: Math.abs(points.rightEyeOuter.x - points.leftEyeOuter.x),
    
    // Hauteur du visage
    faceHeight: Math.abs(points.forehead.y - points.chin.y),
    
    // Largeur des tempes (pour positionnement des branches)
    templeWidth: Math.abs(points.rightTemple.x - points.leftTemple.x),
    
    // Hauteur des yeux (verticale)
    eyeLevel: points.eyeCenter.y,
    
    // Position du pont du nez
    noseBridgePosition: points.noseBridge,
    
    // Profondeur du nez
    noseDepth: Math.abs(points.noseTip.z - points.noseBridge.z),
    
    // Vecteur direction des yeux (pour rotation)
    eyeDirection: new THREE.Vector3()
      .subVectors(points.rightEyeCenter, points.leftEyeCenter)
      .normalize(),
    
    // Points de référence
    points: points
  };

  console.log('📏 Géométrie du visage extraite:', {
    eyeDistance: geometry.eyeDistance.toFixed(1),
    faceWidth: geometry.faceWidth.toFixed(1),
    faceHeight: geometry.faceHeight.toFixed(1),
    templeWidth: geometry.templeWidth.toFixed(1)
  });

  return geometry;
}

private calculateGlassesPosition(faceGeometry: any): THREE.Vector3 {
  // La position des lunettes est basée sur la géométrie réelle du visage
  
  // 1. Point de base : centre des yeux
  const basePosition = faceGeometry.eyeCenter.clone();
  
  // 2. Ajustement vertical automatique basé sur la position du pont du nez
  const noseBridgeOffset = faceGeometry.noseBridgePosition.y - faceGeometry.eyeCenter.y;
  const verticalAdjustment = noseBridgeOffset * 0.3; // 30% de l'écart nez-yeux
  
  // 3. Ajustement en profondeur basé sur la profondeur du nez
  const depthAdjustment = faceGeometry.noseDepth * 0.5; // 50% de la profondeur du nez
  
  // 4. Position finale calculée automatiquement
  const finalPosition = new THREE.Vector3(
    basePosition.x, // Pas d'ajustement horizontal (centré sur les yeux)
    basePosition.y + verticalAdjustment, // Ajustement vertical basé sur le nez
    basePosition.z - depthAdjustment     // Ajustement de profondeur basé sur le nez
  );
  
  console.log('📍 Position calculée automatiquement:', {
    base: `${basePosition.x.toFixed(1)}, ${basePosition.y.toFixed(1)}, ${basePosition.z.toFixed(1)}`,
    adjustments: `vertical: ${verticalAdjustment.toFixed(1)}, depth: ${depthAdjustment.toFixed(1)}`,
    final: `${finalPosition.x.toFixed(1)}, ${finalPosition.y.toFixed(1)}, ${finalPosition.z.toFixed(1)}`
  });
  
  return finalPosition;
}

private calculateGlassesScale(faceGeometry: any): number {
  // L'échelle est basée sur plusieurs mesures du visage
  
  // 1. Échelle basée sur la distance inter-pupillaire (IPD)
  const referenceIPD = 60; // IPD moyenne en pixels pour référence
  const ipdScale = faceGeometry.eyeDistance / referenceIPD;
  
  // 2. Échelle basée sur la largeur du visage
  const referenceFaceWidth = 120; // Largeur de visage moyenne en pixels
  const faceWidthScale = faceGeometry.faceWidth / referenceFaceWidth;
  
  // 3. Échelle basée sur la largeur des tempes
  const referenceTempleWidth = 140; // Largeur des tempes moyenne
  const templeScale = faceGeometry.templeWidth / referenceTempleWidth;
  
  // 4. Calcul de l'échelle finale (moyenne pondérée)
  const finalScale = (
    ipdScale * 0.5 +        // 50% basé sur IPD (le plus important)
    faceWidthScale * 0.3 +  // 30% basé sur largeur du visage
    templeScale * 0.2       // 20% basé sur largeur des tempes
  );
  
  // 5. Contraintes de sécurité
  const minScale = 0.3;
  const maxScale = 2.0;
  const safeScale = Math.max(minScale, Math.min(maxScale, finalScale));
  
  console.log('📏 Échelle calculée automatiquement:', {
    ipd: `${faceGeometry.eyeDistance.toFixed(1)}px → ${ipdScale.toFixed(3)}`,
    faceWidth: `${faceGeometry.faceWidth.toFixed(1)}px → ${faceWidthScale.toFixed(3)}`,
    templeWidth: `${faceGeometry.templeWidth.toFixed(1)}px → ${templeScale.toFixed(3)}`,
    finalScale: safeScale.toFixed(3)
  });
  
  return safeScale;
}

private calculateGlassesRotation(faceGeometry: any): number {
  // La rotation est basée sur l'inclinaison naturelle des yeux
  
  // 1. Calcul de l'angle d'inclinaison des yeux
  const eyeLine = new THREE.Vector3()
    .subVectors(faceGeometry.points.rightEyeCenter, faceGeometry.points.leftEyeCenter);
  
  const rotationAngle = Math.atan2(eyeLine.y, eyeLine.x);
  
  // 2. Limitation de la rotation pour éviter les rotations extrêmes
  const maxRotation = Math.PI / 8; // ±22.5 degrés maximum
  const safeRotation = Math.max(-maxRotation, Math.min(maxRotation, rotationAngle));
  
  console.log('🔄 Rotation calculée automatiquement:', {
    rawAngle: `${(rotationAngle * 180 / Math.PI).toFixed(1)}°`,
    safeAngle: `${(safeRotation * 180 / Math.PI).toFixed(1)}°`
  });
  
  return safeRotation;
}

// NOUVELLE MÉTHODE PRINCIPALE DE POSITIONNEMENT
private positionGlassesAutomatically(glasses3D: THREE.Object3D, landmarks: any[], imageWidth: number, imageHeight: number) {
  if (!glasses3D || !landmarks || landmarks.length < 468) {
    console.error('Données insuffisantes pour le positionnement automatique');
    return;
  }

  console.log('🎯 Début du positionnement automatique');

  // 1. Calcul automatique de toutes les transformations
  const transform = this.calculateAutomaticGlassesTransform(landmarks, imageWidth, imageHeight);

  // 2. Application directe des transformations calculées
  glasses3D.position.copy(transform.position);
  glasses3D.rotation.copy(transform.rotation);
  glasses3D.scale.copy(transform.scale);

  // 3. Validation finale
  if (this.validateAutomaticTransform(transform, imageWidth, imageHeight)) {
    console.log('✅ Positionnement automatique réussi');
    this.renderScene();
    return true;
  } else {
    console.warn('⚠️ Transformation invalide, application des valeurs par défaut');
    this.applyDefaultGlassesTransform(glasses3D, imageWidth, imageHeight);
    return false;
  }
}

private validateAutomaticTransform(transform: any, imageWidth: number, imageHeight: number): boolean {
  const pos = transform.position;
  const scale = transform.scale.x;
  
  // Validation basée sur les dimensions de l'image
  const positionValid = 
    Math.abs(pos.x) < imageWidth * 0.6 &&
    Math.abs(pos.y) < imageHeight * 0.6 &&
    Math.abs(pos.z) < Math.min(imageWidth, imageHeight);
  
  const scaleValid = scale >= 0.2 && scale <= 3.0;
  
  return positionValid && scaleValid && 
         isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z) && isFinite(scale);
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
      const fov = this.calculateOptimalFOV(width, height);

      this.camera3DImage = new THREE.PerspectiveCamera(fov, aspectRatio, 0.1, 3000);

      // Distance de caméra adaptée à la taille de l'image
      const cameraDistance = this.calculateOptimalCameraDistance(width, height);
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
  private calculateOptimalFOV(width: number, height: number): number {
  
    const baseFOV = 60; // Augmenté de 45 à 60

    const diagonal = Math.sqrt(width * width + height * height);

    // Ajustement du FOV selon la taille de l'image
    if (diagonal < 800) return baseFOV + 15; // Images petites: FOV encore plus large
    if (diagonal > 2000) return baseFOV - 5; // Images grandes: FOV légèrement réduit
    return baseFOV;
  }
  private calculateOptimalCameraDistance(width: number, height: number): number {
  const maxDimension = Math.max(width, height);
  return maxDimension * 0.6; // Ajuster pour cadrer correctement
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
      this.model3DPath,
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
  private extractGlassesPointsForImage(landmarks: any[], imageWidth: number, imageHeight: number) {
  const getPoint = (index: number) => {
    const l = landmarks[index];
    return new THREE.Vector3(
      (l.x - 0.5) * imageWidth,   // ✅ centrage X
      -(l.y - 0.5) * imageHeight, // ✅ centrage Y + inversion
      l.z * imageWidth * 0.1      // ✅ Z réduit
    );
  };

  const getSafe = (index: number) => {
    const l = landmarks[index];
    if (!l) {
      console.warn(`⚠️ Landmark ${index} manquant → retourne (0,0,0)`);
      return new THREE.Vector3(0, 0, 0);
    }
    return getPoint(index);
  };

  const points: any = {
    leftEye: getSafe(this.FACE_LANDMARKS.leftEyeCenter),
    rightEye: getSafe(this.FACE_LANDMARKS.rightEyeCenter),
    leftEyeOuter: getSafe(this.FACE_LANDMARKS.leftEyeOuter),
    rightEyeOuter: getSafe(this.FACE_LANDMARKS.rightEyeOuter),
    leftEyeInner: getSafe(this.FACE_LANDMARKS.leftEyeInner),
    rightEyeInner: getSafe(this.FACE_LANDMARKS.rightEyeInner),
    noseBridge: getSafe(this.FACE_LANDMARKS.noseBridge),
    noseTip: getSafe(this.FACE_LANDMARKS.noseTip),
    forehead: getSafe(this.FACE_LANDMARKS.forehead),
    chin: getSafe(this.FACE_LANDMARKS.chin),
    leftTemple: getSafe(this.FACE_LANDMARKS.leftTemple),
    rightTemple: getSafe(this.FACE_LANDMARKS.rightTemple),
  };

  // Centre des yeux
  points.eyeCenter = new THREE.Vector3()
    .addVectors(points.leftEye, points.rightEye)
    .multiplyScalar(0.5);

  // Métriques
  points.faceMetrics = {
    eyeDistance: points.leftEye.distanceTo(points.rightEye),
    faceWidth: Math.abs(points.rightEyeOuter.x - points.leftEyeOuter.x),
    faceHeight: Math.abs(points.forehead.y - points.chin.y),
    noseLength: Math.abs(points.noseTip.z - points.noseBridge.z),
    templeWidth: Math.abs(points.rightTemple.x - points.leftTemple.x),
  };
  return points;
}
private calculateGlassesTransformForImage(points: any, imageWidth: number, imageHeight: number) {
  console.log('🔧 Calcul transform - Données d\'entrée:', {
    eyeDistance: points.faceMetrics.eyeDistance,
    eyeCenter: points.eyeCenter
  });
  
  const ipd = points.faceMetrics.eyeDistance;
  
  // 📐 Calcul de l'échelle (nombre)
  const scaleValue = Math.max(0.3, Math.min(1.5, ipd / 200));
  
  // ✅ Création d'un Vector3 pour l'échelle
  const scale = new THREE.Vector3(scaleValue, scaleValue, scaleValue);
  
  const position = points.eyeCenter.clone();
  const rotation = new THREE.Euler(0, 0, 0);
  
  console.log('✅ Transform calculé:', {
    scaleValue: scaleValue.toFixed(3),
    scaleVector: { x: scale.x, y: scale.y, z: scale.z },
    position: { x: position.x.toFixed(1), y: position.y.toFixed(1), z: position.z.toFixed(1) }
  });
  
  return { position, rotation, scale };
}
private positionGlassesForImage(glasses3D: THREE.Object3D, transform: any, points: any, showDebugFrame: boolean = true) {
  if (!glasses3D || !points.leftEye || !points.rightEye) return;

  // 🎥 Calculer la distance de la caméra (utilisez vos dimensions d'image)
  const imageWidth = 640; // Remplacez par la largeur réelle de votre image
  const imageHeight = 480; // Remplacez par la hauteur réelle de votre image
  const cameraDistance = this.calculateOptimalCameraDistance(imageWidth, imageHeight);

  const COORDINATE_SCALE = 0.1;
  const leftEye = points.leftEye.clone().multiplyScalar(COORDINATE_SCALE);
  const rightEye = points.rightEye.clone().multiplyScalar(COORDINATE_SCALE);

  // 🎯 Calcul du centre des yeux et de la distance inter-pupillaire
  const eyeCenter = new THREE.Vector3().addVectors(leftEye, rightEye).multiplyScalar(0.5);
  const eyeDistance = leftEye.distanceTo(rightEye);

  // 📐 Calcul de l'angle de rotation du visage
  const eyeLine = new THREE.Vector3().subVectors(rightEye, leftEye);
  const faceRotation = Math.atan2(eyeLine.y, eyeLine.x);

  // 📏 Calibrage dynamique amélioré
  const referenceFaceSize = 18;
  const adaptiveScale = eyeDistance / referenceFaceSize;
  const faceWidth = eyeDistance * 2.5;

  const offsetX_px = -faceWidth * 42;
  const offsetY_px = -faceWidth * -60;

  const offsetX = offsetX_px * COORDINATE_SCALE;
  const offsetY = offsetY_px * COORDINATE_SCALE;
  const offsetZ = -eyeDistance * 0.1;

  const finalPosition = eyeCenter.clone()
    .add(
      new THREE.Vector3(offsetX, offsetY, offsetZ)
        .applyAxisAngle(new THREE.Vector3(0, 0, 1), faceRotation)
    );

  // 📐 Échelle adaptative avec contraintes plus strictes
  const minScale = 0.15;
  const maxScale = 0.7;
  const scaleMultiplier = 0.75;
  const finalScale = Math.max(minScale, Math.min(maxScale, adaptiveScale * scaleMultiplier));

  // 🔧 Application des transformations avec validation
  if (isFinite(finalPosition.x) && isFinite(finalPosition.y) && isFinite(finalPosition.z)) {
    glasses3D.position.copy(finalPosition);
    glasses3D.rotation.set(0, 0, faceRotation * 0.9);
    glasses3D.scale.set(finalScale, finalScale, finalScale);
    this.renderScene();
  }
}
/////////////////
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
///////////////
private validateGlassesPosition(transform: any, metrics: any): boolean {
  const { position, scale } = transform;
  
  // 🚨 DEBUG: Vérifier la structure de l'objet scale
  console.log('🔍 Structure de transform:', {
    hasScale: !!scale,
    scaleType: typeof scale,
    scaleKeys: scale ? Object.keys(scale) : 'N/A',
    scaleValues: scale ? { x: scale.x, y: scale.y, z: scale.z } : 'N/A',
    fullTransform: transform
  });
  
  // ✅ Protection et correction de l'échelle
  let safeScale = scale;
  if (!scale || typeof scale !== 'object') {
    console.warn('⚠️ Objet scale manquant ou invalide, création automatique');
    safeScale = new THREE.Vector3(1, 1, 1);
  } else if (scale.x === 0 || scale.y === 0 || scale.z === 0 || 
             isNaN(scale.x) || isNaN(scale.y) || isNaN(scale.z)) {
    console.warn('⚠️ Valeurs d\'échelle invalides:', scale);
    safeScale = new THREE.Vector3(1, 1, 1);
  }
  
  // Mise à jour du transform avec l'échelle corrigée
  transform.scale = safeScale;
  
  // ✅ Protection contre undefined ou NaN pour les métriques
  const faceWidth = metrics.faceWidth ?? metrics.imageSize?.width * 0.3 ?? 0;
  const faceHeight = metrics.faceHeight ?? metrics.imageSize?.height * 0.4 ?? 0;
  const eyeDistance = metrics.eyeDistance ?? 0;
  
  // 📏 Calcul des limites plus permissives
  const maxX = Math.max(faceWidth * 2.0, (metrics.imageSize?.width ?? 0) * 0.4);
  const maxY = Math.max(faceHeight * 1.5, (metrics.imageSize?.height ?? 0) * 0.4);
  const maxZ = Math.max(eyeDistance * 5, 300);
  
  const positionValid = Math.abs(position.x ?? 0) <= maxX &&
                       Math.abs(position.y ?? 0) <= maxY &&
                       Math.abs(position.z ?? 0) <= maxZ;
  
  // 🔧 Calcul d'échelle plus robuste
  const baseEyeDistance = Math.max(eyeDistance, 30); // Valeur minimale sécurisée
  const minScale = Math.max(0.15, baseEyeDistance / 400); // Moins strict
  const maxScale = Math.min(2.0, baseEyeDistance / 30);   // Plus permissif
  
  const currentScale = safeScale.x ?? 1;
  const scaleValid = currentScale >= minScale && currentScale <= maxScale;
  
  const metricsValid = eyeDistance > 15 && // Plus permissif (15 au lieu de 20)
                       eyeDistance < (metrics.imageSize?.width ?? 0) * 0.9; // Plus permissif
  
  // 🚨 Debug détaillé
  console.log('🔍 Validation complète:', {
    position: { 
      x: `${(position.x ?? 0).toFixed(1)}/${maxX.toFixed(1)}`,
      y: `${(position.y ?? 0).toFixed(1)}/${maxY.toFixed(1)}`,
      z: `${(position.z ?? 0).toFixed(1)}/${maxZ.toFixed(1)}`,
      valid: positionValid
    },
    scale: {
      current: currentScale.toFixed(3),
      range: `${minScale.toFixed(3)} - ${maxScale.toFixed(3)}`,
      valid: scaleValid,
      eyeDistance: baseEyeDistance.toFixed(1)
    },
    metrics: {
      eyeDistance: eyeDistance.toFixed(1),
      valid: metricsValid
    },
    overall: positionValid && scaleValid && metricsValid
  });
  
  return positionValid && scaleValid && metricsValid;
}
  // Méthode de correction automatique des transformations invalides
  // 
  private correctGlassesTransform(originalTransform: any, points: any, metrics: any): any {
  console.log('🔧 Correction automatique avec échelle garantie...');
  
  const eyeDistance = Math.max(metrics.eyeDistance, 30);
  const imageWidth = metrics.imageSize?.width ?? 800;
  const imageHeight = metrics.imageSize?.height ?? 600;
  
  // 📐 Échelle sécurisée basée sur eyeDistance
  const safeScale = Math.max(0.25, Math.min(1.5, eyeDistance / 70));
  
  // 📍 Position sécurisée
  const safePosition = {
    x: Math.max(-imageWidth * 0.3, Math.min(imageWidth * 0.3, originalTransform.position.x)),
    y: Math.max(-imageHeight * 0.3, Math.min(imageHeight * 0.3, originalTransform.position.y)),
    z: Math.max(-100, Math.min(50, originalTransform.position.z))
  };
  
  const correctedTransform = {
    position: new THREE.Vector3(safePosition.x, safePosition.y, safePosition.z),
    rotation: originalTransform.rotation?.clone() ?? new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(safeScale, safeScale, safeScale)
  };
  
  console.log('✅ Transform corrigé:', {
    scale: safeScale.toFixed(3),
    position: `${safePosition.x.toFixed(1)}, ${safePosition.y.toFixed(1)}, ${safePosition.z.toFixed(1)}`,
    eyeDistance: eyeDistance.toFixed(1)
  });
  
  return correctedTransform;
}
}
