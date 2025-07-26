
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
/////////////////////////////////
private extractFaceGeometry(landmarks: any[], imageWidth: number, imageHeight: number) {
  console.log('🔍 Extraction CORRIGÉE de la géométrie du visage');
  
  if (!landmarks || landmarks.length < 468) {
    throw new Error(`Landmarks insuffisants: ${landmarks?.length || 0}/468`);
  }

  const getSafePoint = (index: number, fallbackPoint?: THREE.Vector3): THREE.Vector3 => {
    const l = landmarks[index];
    if (!l || typeof l.x !== 'number' || typeof l.y !== 'number' || typeof l.z !== 'number') {
      console.warn(`⚠️ Landmark ${index} invalide:`, l);
      return fallbackPoint || new THREE.Vector3(0, 0, 0);
    }
    
    return new THREE.Vector3(
      (l.x - 0.5) * imageWidth,
      -(l.y - 0.5) * imageHeight,
      l.z * imageWidth * 0.1
    );
  };

  // 🎯 INDICES CORRECTS SELON MEDIAPIPE FACE MESH (VOTRE CONFIG ORIGINALE)
  let points: any = {}; 
  
  // Points des yeux - INDICES MEDIAPIPE CORRECTS
  points.leftEyeInner = getSafePoint(133);  // Coin interne œil gauche ✅
  points.leftEyeOuter = getSafePoint(33);   // Coin externe œil gauche ✅
  points.rightEyeInner = getSafePoint(362); // Coin interne œil droit ✅
  points.rightEyeOuter = getSafePoint(263); // Coin externe œil droit ✅
  
  // Points centraux des yeux (paupières)
  points.leftEyeTop = getSafePoint(159);    // Haut paupière gauche
  points.leftEyeBottom = getSafePoint(145); // Bas paupière gauche
  points.rightEyeTop = getSafePoint(386);   // Haut paupière droite
  points.rightEyeBottom = getSafePoint(374);// Bas paupière droite
  
  // 🆕 POINTS ADDITIONNELS POUR CAS DIFFICILES UNIQUEMENT
  // Points de sourcils pour visages souriants/yeux fermés
  points.leftBrowInner = getSafePoint(70);  // Sourcil gauche interne
  points.leftBrowOuter = getSafePoint(46);  // Sourcil gauche externe
  points.rightBrowInner = getSafePoint(107);// Sourcil droit interne
  points.rightBrowOuter = getSafePoint(276);// Sourcil droit externe
  
  // Points pour visages décentrés/petits
  points.leftTemple = getSafePoint(21);     // Tempe gauche
  points.rightTemple = getSafePoint(251);   // Tempe droite
  
  // Calcul des centres des yeux (VOTRE MÉTHODE ORIGINALE QUI MARCHAIT)
  points.leftEyeCenter = new THREE.Vector3()
    .addVectors(points.leftEyeInner, points.leftEyeOuter)
    .add(points.leftEyeTop)
    .add(points.leftEyeBottom)
    .multiplyScalar(0.25); // Moyenne des 4 points
  
  points.rightEyeCenter = new THREE.Vector3()
    .addVectors(points.rightEyeInner, points.rightEyeOuter)
    .add(points.rightEyeTop)
    .add(points.rightEyeBottom)
    .multiplyScalar(0.25); // Moyenne des 4 points
  
  // 🆕 DÉTECTION DES CAS DIFFICILES ET CORRECTION CIBLÉE
  const isProblematicCase = this.detectProblematicCase(points, imageWidth, imageHeight);
  
  if (isProblematicCase.needsCorrection) {
    console.log('🔧 Cas difficile détecté:', isProblematicCase.issues.join(', '));
    points = this.correctProblematicPoints(points, isProblematicCase, imageWidth, imageHeight);
  }
  
  // Centre entre les deux yeux (VOTRE CALCUL ORIGINAL)
  const eyeCenter = new THREE.Vector3()
    .addVectors(points.leftEyeCenter, points.rightEyeCenter)
    .multiplyScalar(0.5);

  // Structure du nez - INDICES CORRECTS (VOTRE CONFIG ORIGINALE)
  points.noseTip = getSafePoint(1);         // Bout du nez ✅
  points.noseBridge = getSafePoint(168);    // Arête du nez ✅
  points.noseTop = getSafePoint(6);         // Haut du nez ✅
  points.noseLeft = getSafePoint(131);      // Narine gauche
  points.noseRight = getSafePoint(360);     // Narine droite
  
  // Contour du visage - INDICES VÉRIFIÉS (VOTRE CONFIG ORIGINALE)
  points.forehead = getSafePoint(10);       // Front ✅
  points.chin = getSafePoint(175);          // Menton ✅
  points.leftCheek = getSafePoint(116);     // Joue gauche ✅
  points.rightCheek = getSafePoint(345);    // Joue droite ✅
  
  // Validation des points critiques (VOTRE LOGIQUE ORIGINALE)
  const criticalPoints = [
    'leftEyeCenter', 'rightEyeCenter', 'noseTip', 'noseBridge', 
    'forehead', 'chin', 'leftCheek', 'rightCheek'
  ];
  
  for (const pointName of criticalPoints) {
    if (points[pointName] && points[pointName].equals(new THREE.Vector3(0, 0, 0))) {
      console.warn(`⚠️ Point critique ${pointName} invalide, utilisation de fallback`);
      // VOS FALLBACKS ORIGINAUX QUI MARCHAIENT
      switch (pointName) {
        case 'leftEyeCenter':
          points[pointName] = eyeCenter.clone().add(new THREE.Vector3(-25, 0, 0));
          break;
        case 'rightEyeCenter':
          points[pointName] = eyeCenter.clone().add(new THREE.Vector3(25, 0, 0));
          break;
        case 'noseTip':
          points[pointName] = eyeCenter.clone().add(new THREE.Vector3(0, 30, 10));
          break;
        case 'noseBridge':
          points[pointName] = eyeCenter.clone().add(new THREE.Vector3(0, 10, 5));
          break;
      }
    }
  }

  // Calcul des métriques géométriques (VOTRE CONFIG ORIGINALE)
  const geometry = {
    eyeCenter: eyeCenter,
    eyeDistance: Math.max(30, points.leftEyeCenter.distanceTo(points.rightEyeCenter)),
    faceWidth: Math.max(80, Math.abs(points.rightCheek.x - points.leftCheek.x)),
    faceHeight: Math.max(120, Math.abs(points.forehead.y - points.chin.y)),
    templeWidth: Math.max(100, Math.abs(points.rightTemple.x - points.leftTemple.x)),
    eyeLevel: eyeCenter.y,
    noseBridgePosition: points.noseBridge,
    noseDepth: Math.max(5, Math.abs(points.noseTip.z - points.noseBridge.z)),
    browHeight: Math.abs(points.leftBrowInner.y - points.leftEyeCenter.y),
    eyeDirection: new THREE.Vector3()
      .subVectors(points.rightEyeCenter, points.leftEyeCenter)
      .normalize(),
    points: points,
    
    // 🆕 INFOS POUR CAS DIFFICILES
    problematicCase: isProblematicCase
  };
  
  // VOS LOGS ORIGINAUX
  console.log('🔍 Points critiques détectés:', {
    leftEyeCenter: `(${points.leftEyeCenter.x.toFixed(1)}, ${points.leftEyeCenter.y.toFixed(1)})`,
    rightEyeCenter: `(${points.rightEyeCenter.x.toFixed(1)}, ${points.rightEyeCenter.y.toFixed(1)})`,
    eyeDistance: geometry.eyeDistance.toFixed(1),
    faceWidth: geometry.faceWidth.toFixed(1),
    problematic: isProblematicCase.needsCorrection
  });

  return geometry;
}
private detectProblematicCase(points: any, imageWidth: number, imageHeight: number) {
  const issues = [];
  let needsCorrection = false;
  
  // 1. Visage petit (< 20% de l'image)
  const faceWidth = Math.abs(points.rightEyeOuter.x - points.leftEyeOuter.x);
  const faceRatio = faceWidth / imageWidth;
  if (faceRatio < 0.2) {
    issues.push('visage petit');
    needsCorrection = true;
  }
  
  // 2. Visage décentré (centre du visage loin du centre image)
  const faceCenterX = (points.leftEyeOuter.x + points.rightEyeOuter.x) / 2;
  const imageCenterX = 0; // Car coordonnées centrées
  const offsetRatio = Math.abs(faceCenterX - imageCenterX) / (imageWidth / 2);
  if (offsetRatio > 0.4) {
    issues.push('visage décentré');
    needsCorrection = true;
  }
  
  // 3. Yeux fermés/souriants (faible distance verticale paupières)
  const leftEyeHeight = Math.abs(points.leftEyeTop.y - points.leftEyeBottom.y);
  const rightEyeHeight = Math.abs(points.rightEyeTop.y - points.rightEyeBottom.y);
  const avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2;
  if (avgEyeHeight < 8) {
    issues.push('yeux fermés/souriants');
    needsCorrection = true;
  }
  
  // 4. Front non visible (sourcils trop bas par rapport aux yeux)
  const browEyeDistance = Math.abs(points.leftBrowInner.y - points.leftEyeCenter.y);
  if (browEyeDistance < 15) {
    issues.push('front peu visible');
    needsCorrection = true;
  }
  
  return { needsCorrection, issues, faceRatio, offsetRatio, avgEyeHeight, browEyeDistance };
}

private correctProblematicPoints(points: any, problemCase: any, imageWidth: number, imageHeight: number) {
  const correctedPoints = { ...points };
  
  // Correction pour visage petit : agrandir légèrement les distances
  if (problemCase.faceRatio < 0.2) {
    const scaleFactor = 1.2;
    const eyeCenter = new THREE.Vector3()
      .addVectors(points.leftEyeCenter, points.rightEyeCenter)
      .multiplyScalar(0.5);
    
    correctedPoints.leftEyeCenter = eyeCenter.clone().add(
      points.leftEyeCenter.clone().sub(eyeCenter).multiplyScalar(scaleFactor)
    );
    correctedPoints.rightEyeCenter = eyeCenter.clone().add(
      points.rightEyeCenter.clone().sub(eyeCenter).multiplyScalar(scaleFactor)
    );
  }
  
  // Correction pour yeux fermés : utiliser les sourcils comme référence
  if (problemCase.avgEyeHeight < 8) {
    console.log('👁️ Correction pour yeux fermés/souriants');
    const leftBrowCenter = new THREE.Vector3()
      .addVectors(points.leftBrowInner, points.leftBrowOuter)
      .multiplyScalar(0.5);
    const rightBrowCenter = new THREE.Vector3()
      .addVectors(points.rightBrowInner, points.rightBrowOuter)
      .multiplyScalar(0.5);
    
    // Ajuster la position Y vers les sourcils
    if (!leftBrowCenter.equals(new THREE.Vector3(0, 0, 0))) {
      correctedPoints.leftEyeCenter.y = (correctedPoints.leftEyeCenter.y + leftBrowCenter.y) / 2;
    }
    if (!rightBrowCenter.equals(new THREE.Vector3(0, 0, 0))) {
      correctedPoints.rightEyeCenter.y = (correctedPoints.rightEyeCenter.y + rightBrowCenter.y) / 2;
    }
  }
  
  // Correction pour front non visible : ajuster position verticale
  if (problemCase.browEyeDistance < 15) {
    console.log('👤 Correction pour front peu visible');
    correctedPoints.leftEyeCenter.y -= 5;
    correctedPoints.rightEyeCenter.y -= 5;
  }
  
  return correctedPoints;
}

///////////////////////////////////////principale//////////////////////////////////
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
  //this.visualizeLandmarksBoth2DAnd3D(landmarks, this.overlayCanvasImage.nativeElement, facePoints, this.scene3DImage);
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
///////////////////////////////////////position//////////////////////////////////
private calculateGlassesPosition(faceGeometry: any): THREE.Vector3 {   
  console.log('📍 Calcul de position avec points corrigés');
  
  // VOTRE LOGIQUE ORIGINALE QUI MARCHAIT BIEN
  const leftEyeCorner = faceGeometry.points?.leftEyeOuter;   // Point 33 ✅
  const rightEyeCorner = faceGeometry.points?.rightEyeOuter; // Point 263 ✅
  const leftEyeCenter = faceGeometry.points?.leftEyeCenter;  // Calculé ✅
  const rightEyeCenter = faceGeometry.points?.rightEyeCenter; // Calculé ✅
  const noseBridge = faceGeometry.points?.noseBridge;        // Point 168 ✅
  
  if (!leftEyeCorner || !rightEyeCorner) {
    console.error('❌ Points des coins des yeux manquants après correction');
    return new THREE.Vector3(0, 0, 0);
  }
  
  // 1. Position horizontale (VOTRE MÉTHODE ORIGINALE)
  let horizontalCenter;
  if (leftEyeCenter && rightEyeCenter &&
       !leftEyeCenter.equals(new THREE.Vector3(0, 0, 0)) &&
       !rightEyeCenter.equals(new THREE.Vector3(0, 0, 0))) {
    horizontalCenter = (leftEyeCenter.x + rightEyeCenter.x) / 2;
    console.log('✅ Position horizontale basée sur les centres des yeux');
  } else {
    horizontalCenter = (leftEyeCorner.x + rightEyeCorner.x) / 2;
    console.log('⚠️ Position horizontale basée sur les coins externes (fallback)');
  }
  
  // 2. Position verticale (VOTRE MÉTHODE ORIGINALE + AJUSTEMENTS CAS DIFFICILES)
  let verticalPosition;
  if (leftEyeCenter && rightEyeCenter &&
       !leftEyeCenter.equals(new THREE.Vector3(0, 0, 0)) &&
       !rightEyeCenter.equals(new THREE.Vector3(0, 0, 0))) {
    verticalPosition = (leftEyeCenter.y + rightEyeCenter.y) / 2;
  } else {
    verticalPosition = (leftEyeCorner.y + rightEyeCorner.y) / 2;
  }
  
  // 🆕 AJUSTEMENT SPÉCIAL POUR CAS DIFFICILES
  let eyebrowOffset = -0.008; // Votre offset original
  
  if (faceGeometry.problematicCase?.issues.includes('yeux fermés/souriants')) {
    eyebrowOffset = -0.015; // Plus vers les sourcils
    console.log('👁️ Ajustement pour yeux fermés');
  }
  
  if (faceGeometry.problematicCase?.issues.includes('visage petit')) {
    eyebrowOffset = -0.012; // Ajustement intermédiaire
    console.log('👤 Ajustement pour visage petit');
  }
  
  verticalPosition += eyebrowOffset;
  
  // 3. Position en profondeur (VOTRE MÉTHODE ORIGINALE)
  let depthPosition = 0;
  if (noseBridge && !noseBridge.equals(new THREE.Vector3(0, 0, 0))) {
    depthPosition = noseBridge.z - 0.012;
  } else if (leftEyeCenter && rightEyeCenter) {
    depthPosition = (leftEyeCenter.z + rightEyeCenter.z) / 2 - 0.012;
  } else {
    depthPosition = (leftEyeCorner.z + rightEyeCorner.z) / 2 - 0.012;
  }
  
  const finalPosition = new THREE.Vector3(horizontalCenter, verticalPosition, depthPosition);
  
  console.log('📍 Position finale calculée:', {
    x: finalPosition.x.toFixed(3),
    y: finalPosition.y.toFixed(3),
    z: finalPosition.z.toFixed(3),
    corrections: faceGeometry.problematicCase?.issues || []
  });
  
  // VOS AUTRES MÉTHODES ORIGINALES (showReferencePoints, etc.)
  this.showReferencePoints(faceGeometry.points, this.scene3DImage);
  return finalPosition;
}
// 🔍 MÉTHODE DE DEBUG AMÉLIORÉE
private showReferencePoints(points: any, scene: THREE.Scene | THREE.Group) {
  // Nettoyer les anciens points de debug
  this.clearDebugPoints(scene);
  
  const referencePoints = [
    { key: 'leftEyeOuter', color: 0xff0000, label: 'L-Outer(33)' },    // Rouge
    { key: 'rightEyeOuter', color: 0x00ff00, label: 'R-Outer(263)' },  // Vert
    { key: 'leftEyeCenter', color: 0x0000ff, label: 'L-Center' },      // Bleu
    { key: 'rightEyeCenter', color: 0xffff00, label: 'R-Center' },     // Jaune
    { key: 'noseBridge', color: 0xff00ff, label: 'Nose(168)' }         // Magenta
  ];
 
  referencePoints.forEach(ref => {
    const pt = points[ref.key];
    if (pt && !pt.equals(new THREE.Vector3(0, 0, 0))) {
      const geometry = new THREE.SphereGeometry(8, 16, 16);
      const material = new THREE.MeshBasicMaterial({ 
        color: ref.color,
        transparent: true,
        opacity: 0.8
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(pt.x, pt.y, pt.z);
      sphere.name = 'debug_point';
      scene.add(sphere);
      
      console.log(`🎯 ${ref.label}: ${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}, ${pt.z.toFixed(1)}`);
    } else {
      console.warn(`⚠️ Point ${ref.key} manquant ou invalide`);
    }
  });
}

private clearDebugPoints(scene: THREE.Scene | THREE.Group) {
  const toRemove: THREE.Object3D[] = [];
  scene.traverse((object) => {
    if (object.name === 'debug_point') {
      toRemove.push(object);
    }
  });
  toRemove.forEach(obj => scene.remove(obj));
}
/////////////////////////////////scale
// 
private calculateGlassesScale(faceGeometry: any): number {
  console.log('📏 Calcul d\'échelle amélioré');
  
  // Mesures multiples pour plus de précision
  const eyeDistance = faceGeometry.eyeDistance || 65;
  const faceWidth = faceGeometry.faceWidth || 130;
  const templeDistance = faceGeometry.templeWidth || 150;
  
  // Calcul basé sur la distance inter-pupillaire (IPD)
  const averageIPD = 63; // Distance moyenne en mm
  const baseScale = Math.max(0.4, Math.min(1.2, eyeDistance / averageIPD));
  
  // Facteurs d'ajustement selon le type de visage
  let adjustmentFactor = 1.0;
  const faceRatio = faceWidth / (faceGeometry.faceHeight || 180);
  
  if (faceRatio > 0.8) {
    // Visage large - lunettes légèrement plus grandes
    adjustmentFactor = 1.05;
  } else if (faceRatio < 0.7) {
    // Visage étroit - lunettes légèrement plus petites
    adjustmentFactor = 0.95;
  }
  
  // Facteur de correction pour le rendu virtuel
  const virtualFactor = 0.82; // À ajuster selon votre modèle 3D
  
  const finalScale = baseScale * adjustmentFactor * virtualFactor;
  
  // Limitation sécurisée
  return Math.max(0.3, Math.min(1.5, finalScale));
}
////////////rotation
private calculateGlassesRotation(faceGeometry: any): number {
  console.log('🔄 Calcul de rotation optimisé');
  
  if (!faceGeometry.points?.leftEyeCenter || !faceGeometry.points?.rightEyeCenter) {
    console.warn('Points des yeux manquants pour la rotation');
    return 0;
  }
  
  const leftEye = faceGeometry.points.leftEyeCenter;
  const rightEye = faceGeometry.points.rightEyeCenter;
  
  // Calcul de l'angle avec compensation de perspective
  const deltaY = rightEye.y - leftEye.y;
  const deltaX = rightEye.x - leftEye.x;
  
  // Éviter division par zéro
  if (Math.abs(deltaX) < 0.001) {
    return 0;
  }
  
  const rotationAngle = Math.atan2(deltaY, deltaX);
  
  // Limitation plus stricte pour un rendu naturel
  const maxRotation = Math.PI / 12; // ±15° maximum
  const safeRotation = isFinite(rotationAngle) ? 
    Math.max(-maxRotation, Math.min(maxRotation, rotationAngle)) : 0;
  
  // Facteur de réduction pour éviter la sur-rotation
  const dampingFactor = 0.7;
  const finalRotation = safeRotation * dampingFactor;
  
  console.log('🔄 Rotation optimisée:', {
    deltaX: deltaX.toFixed(3),
    deltaY: deltaY.toFixed(3),
    rawAngle: `${(rotationAngle * 180 / Math.PI).toFixed(1)}°`,
    safeAngle: `${(safeRotation * 180 / Math.PI).toFixed(1)}°`,
    finalAngle: `${(finalRotation * 180 / Math.PI).toFixed(1)}°`
  });
  
  return finalRotation;
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
// Dessin des repères faciaux sur l'image (pour débogage
  // 🎨 Votre méthode existante améliorée
  private visualizeLandmarksBoth2DAnd3D(landmarks: any[], canvas: HTMLCanvasElement, points3D: any, scene: THREE.Scene) {
  // 🖼️ Visualisation 2D sur canvas
  this.drawLandmarksOnImage(landmarks, canvas);
  
  // 🌍 Visualisation 3D dans la scène
  this.visualizeFaceLandmarks3D(points3D, scene);
  
  console.log(`📊 Visualisation: ${landmarks.length} landmarks 2D + landmarks 3D`);
}
private drawLandmarksOnImage(landmarks: any[], canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !landmarks || !Array.isArray(landmarks)) return;
  
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 🔴 Tous les landmarks en rouge (petits points)
  ctx.fillStyle = 'red';
  for (const pt of landmarks) {
    if (!pt) continue;
    ctx.beginPath();
    ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 2, 0, 2 * Math.PI);
    ctx.fill();
  }

  // 🟢 Landmarks importants avec indices
  const keyIndices = [33, 263, 1, 10, 152, 6, 168, 197]; // Vos indices existants
  const keyColors = {
    33: 'lime',    // Œil gauche
    263: 'lime',   // Œil droit
    1: 'cyan',     // Nez central
    10: 'orange',  // Lèvre supérieure
    152: 'pink',   // Menton
    6: 'yellow',   // Entre les yeux
    168: 'purple', // Joue gauche
    197: 'purple'  // Joue droite
  };

  ctx.font = '12px Arial';
  for (const idx of keyIndices) {
    const pt = landmarks[idx];
    if (!pt) continue;
    
    const x = pt.x * canvas.width;
    const y = pt.y * canvas.height;
    
    // Point coloré selon son importance
    ctx.fillStyle = keyColors[idx as keyof typeof keyColors] || 'lime';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fill();
    
    // Texte avec l'indice
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.strokeText(idx.toString(), x + 6, y - 6);
    ctx.fillText(idx.toString(), x + 6, y - 6);
  }

  ctx.restore();
}

// 🌍 Méthode 3D adaptée à vos besoins
private visualizeFaceLandmarks3D(points: any, scene: THREE.Scene) {
  // Nettoyer les anciens landmarks 3D
  this.clearLandmarks3D(scene);
  
  if (!points) return;

  const COORDINATE_SCALE = 0.05;
  
  // 🎨 Couleurs pour correspondre à votre canvas 2D
  const colors = {
    eyes: 0x00ff00,      // Lime (comme vos indices 33, 263)
    nose: 0x00ffff,      // Cyan (comme votre indice 1)
    mouth: 0xffa500,     // Orange (comme votre indice 10)
    chin: 0xffc0cb,      // Pink (comme votre indice 152)
    center: 0xffff00,    // Yellow (comme votre indice 6)
    cheeks: 0x800080,    // Purple (comme vos indices 168, 197)
    general: 0xff0000    // Rouge (comme tous les autres points)
  };

  // 🔵 Création de points 3D avec les mêmes couleurs qu'en 2D
  const createPoint3D = (position: THREE.Vector3, color: number, size: number = 5) => {
    const geometry = new THREE.SphereGeometry(size, 4, 4);
    const material = new THREE.MeshBasicMaterial({ 
      color: color,
      transparent: true,
      opacity: 1
    });
    const point = new THREE.Mesh(geometry, material);
    
    point.position.copy(position.clone().multiplyScalar(COORDINATE_SCALE));
    point.name = 'landmark_3d_point';
    scene.add(point);
    
    return point;
  };

  // 👁️ Yeux (correspondant aux indices 33, 263)
  if (points.leftEye && points.rightEye) {
    createPoint3D(points.leftEye, colors.eyes, 1.0);
    createPoint3D(points.rightEye, colors.eyes, 1.0);
    
    // Ligne entre les yeux
    const eyePoints = [
      points.leftEye.clone().multiplyScalar(COORDINATE_SCALE),
      points.rightEye.clone().multiplyScalar(COORDINATE_SCALE)
    ];
    const eyeGeometry = new THREE.BufferGeometry().setFromPoints(eyePoints);
    const eyeLine = new THREE.Line(eyeGeometry, new THREE.LineBasicMaterial({ 
      color: colors.eyes, 
      opacity: 0.6, 
      transparent: true 
    }));
    eyeLine.name = 'landmark_3d_line';
    scene.add(eyeLine);
  }

  // 👃 Nez (correspondant à l'indice 1)
  if (points.noseTip) {
    createPoint3D(points.noseTip, colors.nose, 0.8);
  }

  // 👄 Bouche (correspondant à l'indice 10)
  if (points.mouth) {
    createPoint3D(points.mouth, colors.mouth, 0.8);
  }

  // 📐 Centre entre les yeux (correspondant à l'indice 6)
  if (points.leftEye && points.rightEye) {
    const eyeCenter = new THREE.Vector3()
      .addVectors(points.leftEye, points.rightEye)
      .multiplyScalar(0.5);
    createPoint3D(eyeCenter, colors.center, 0.7);
  }

  console.log('✅ Landmarks 3D visualisés avec couleurs correspondantes au 2D');
}

// 🧹 Nettoyage spécifique aux landmarks 3D
private clearLandmarks3D(scene: THREE.Scene) {
  const toRemove: THREE.Object3D[] = [];
  
  scene.traverse((object) => {
    if (object.name === 'landmark_3d_point' || object.name === 'landmark_3d_line') {
      toRemove.push(object);
    }
  });
  
  toRemove.forEach(obj => {
    scene.remove(obj);
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach(mat => mat.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
}
}
