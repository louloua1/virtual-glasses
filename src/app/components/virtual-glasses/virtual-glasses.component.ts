import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, AfterViewInit, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { CameraService } from '../../services/camera.service';
import { FaceMeshService } from '../../services/face-mesh.service';
import { Subscription, BehaviorSubject, Observable, async } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Input } from '@angular/core';
import { Glasses } from '../../classes/glasses';
@Component({
  selector: 'app-virtual-glasses',
  templateUrl: './virtual-glasses.component.html',
  styleUrls: ['./virtual-glasses.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})

export class VirtualGlassesComponent implements OnInit, AfterViewInit, OnDestroy {
  
  @ViewChild('threeContainer', { static: false }) threeContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('threeContainerImage', { static: false }) threeContainerImage!: ElementRef<HTMLDivElement>;
  @ViewChild('uploadedImage', { static: false }) uploadedImage!: ElementRef<HTMLImageElement>;
  @ViewChild('overlayCanvasImage', { static: false }) overlayCanvasImage!: ElementRef<HTMLCanvasElement>;
  private cameraSubscription!: Subscription;
  private faceDetectionSubscription!: Subscription;
  private isCameraStarting = false;
  private cameraState$ = new BehaviorSubject<boolean>(false);
  isCameraActive$ = this.cameraState$.asObservable();
  isFaceDetected$!: Observable<boolean>;
  cameraStream: MediaStream | null = null;
  selectedGlasses: Glasses | null = null;
  capturedPhoto: string | null = null;
  private renderer3D !: THREE.WebGLRenderer;
  private scene3D!: THREE.Scene;
  private camera3D!: THREE.PerspectiveCamera;
  private glasses3D?: THREE.Object3D;
  private threeInitialized = false;
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('overlayCanvas') canvasElement!: ElementRef<HTMLCanvasElement>;
  @Input() glass: any;
  @Input() showGlassList: boolean = false;
  @Input() glassesList: any[] = []; 
  @Output() close = new EventEmitter<void>(); 
  model3DPath: string = 'assets/models/model4.glb';
  errorMessage !:string;
  private resizeObserver?: ResizeObserver;
private currentVideoWidth = 640;
private currentVideoHeight = 480;
private rotationHistory: THREE.Euler[] = [];
private readonly ROTATION_HISTORY_SIZE = 3; 
  //obtenir la glass en 3D
  getModel3DPathFromGlass(glass: any): string {
    if (glass.model3DPath) {
      console.log('Chemin du modèle 3D à charger :', `assets/models/${glass.model3DPath}`);
      return `assets/models/${glass.model3DPath}`;
    }
    return 'assets/models/model1.glb';
  }
  ////////////////
  private targetFrameTime: number;
  constructor(
    private cameraService: CameraService,
    private faceMeshService: FaceMeshService,
    private cdr: ChangeDetectorRef,
  ) {
    // Initialiser la valeur initiale de isCameraActive
    this.cameraState$.next(this.cameraService.getCameraActive());

    // Initialiser la subscription
    this.cameraSubscription = this.cameraService.isCameraActive$.subscribe(
      isActive => {
        this.cameraState$.next(isActive);
      }
    );
    const settings = this.getPerformanceSettings();
  this.targetFrameTime = 1000 / settings.maxFPS;
  }

  private isInitialized = false;

  ngOnInit(): void {
    //this.getGlasses();
    this.isFaceDetected$ = this.faceMeshService.getFaceDetectionStatus();
    // Initialiser les subscriptions
    this.cameraSubscription = this.cameraService.isCameraActive$.subscribe(
      isActive => {
        this.cameraState$.next(isActive);
      }
    );
    // Initialiser le stream de la caméra
    this.cameraService.stream$.subscribe(stream => {
      this.cameraStream = stream;
    });
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
    //this.loadModels();
    window.addEventListener('resize', this.handleWindowResize.bind(this));
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          this.handleVideoContainerResize();
        }
      });
    }
    
  }
  // 2. DÉTECTION DE PLATEFORME MOBILE
  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      || window.innerWidth <= 768
      || 'ontouchstart' in window; // Détection tactile
  }

private getPerformanceSettings() {
  const isMobile = this.isMobile();
  return {
    rotationHistorySize: isMobile ? 1 : 3, // RÉDUIT pour moins de latence
    smoothingFactor: isMobile ? 0.7 : 0.3, // AUGMENTÉ pour plus de réactivité
    skipFrames: 0, // DÉSACTIVÉ pour éviter les sauts
    reducedPrecision: isMobile,
    maxFPS: isMobile ? 30 : 60, // AUGMENTÉ de 24 à 30 FPS
    useInterpolation: isMobile, // Nouvelle option
    priorityMode: true // Mode priorité pour mobile
  };
}
  private animationFrameId: number | null = null;
private startAnimationLoop() {
  const render = (currentTime: number) => {
    this.animationFrameId = requestAnimationFrame(render);
    
    // Monitoring de performance moins fréquent
    this.monitorPerformance();
    
    // Limitation FPS moins stricte sur mobile pour éviter la latence
    const isMobile = this.isMobile();
    const frameTimeThreshold = isMobile ? 
      Math.max(16.67, this.targetFrameTime * 0.8) : // 80% du temps cible sur mobile
      this.targetFrameTime;
    
    if (currentTime - this.lastFrameTime < frameTimeThreshold) {
      return;
    }
    this.lastFrameTime = currentTime;
    
    // Ne pas sauter de frames sur mobile pour éviter les saccades
    // if (this.shouldSkipFrame()) { return; }
    
    // Nettoyage moins fréquent
    if (this.performanceMonitor.frameCount % 120 === 0) { // Toutes les 4 secondes au lieu de 1
      this.cleanupOptimization();
    }
    
    if (this.cameraState$.value) {
      this.animate3D();
      this.renderer3D.render(this.scene3D, this.camera3D);
    }
  };
  this.animationFrameId = requestAnimationFrame(render);
}
  ngAfterViewInit(): void {
    this.isInitialized = true;
    this.initThreeJS();
    this.startAnimationLoop();
    //this.isDomReady = true;
    this.cdr.detectChanges();
    if (this.resizeObserver && this.videoElement) {
      this.resizeObserver.observe(this.videoElement.nativeElement);
    }
  setTimeout(() => {
    this.toggleCamera();
  }, 0);
  }
  // 4. Nouvelle méthode pour gérer le redimensionnement de la fenêtre
private handleWindowResize = (): void => {
  if (this.cameraState$.value) {
    setTimeout(() => {
      this.handleVideoContainerResize();
    }, 100); // Délai pour laisser le DOM se stabiliser
  }
};
// 5. Méthode principale pour gérer le redimensionnement du container vidéo
private handleVideoContainerResize(): void {
  const video = this.videoElement?.nativeElement;
  const canvas = this.canvasElement?.nativeElement;
  
  if (!video || !canvas) return;
  
  // Obtenir les nouvelles dimensions
  const newWidth = video.clientWidth;
  const newHeight = video.clientHeight;
  const videoWidth = video.videoWidth || 640;
  const videoHeight = video.videoHeight || 480;
  
  // Vérifier si les dimensions ont changé
  if (newWidth !== this.currentVideoWidth || newHeight !== this.currentVideoHeight) {
    console.log(`Redimensionnement détecté: ${this.currentVideoWidth}x${this.currentVideoHeight} -> ${newWidth}x${newHeight}`);
    
    this.currentVideoWidth = newWidth;
    this.currentVideoHeight = newHeight;
    
    // Mettre à jour le canvas
    this.updateCanvasSize(canvas, newWidth, newHeight);
    
    // Mettre à jour Three.js
    this.updateThreeJSSize(newWidth, newHeight, videoWidth, videoHeight);
    
    // Mettre à jour FaceMesh si nécessaire
    this.updateFaceMeshCanvas(canvas);
  }
}
// 6. Méthode pour mettre à jour la taille du canvas
private updateCanvasSize(canvas: HTMLCanvasElement, width: number, height: number): void {
  // Mettre à jour les dimensions CSS
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  
  // Mettre à jour les dimensions internes pour le bon rendu
  const video = this.videoElement?.nativeElement;
  if (video) {
    canvas.width = video.videoWidth || width;
    canvas.height = video.videoHeight || height;
  }
}
// 7. Méthode pour mettre à jour Three.js
private updateThreeJSSize(displayWidth: number, displayHeight: number, videoWidth: number, videoHeight: number): void {
  if (!this.renderer3D || !this.camera3D) return;
  
  // Calculer le nouveau ratio d'aspect
  const aspectRatio = videoWidth / videoHeight;
  
  // Mettre à jour la caméra
  this.camera3D.aspect = aspectRatio;
  this.camera3D.updateProjectionMatrix();
  
  // Recalculer la distance de la caméra pour maintenir le FOV
  const fov = 50;
  const cameraDistance = (videoHeight / 2) / Math.tan((fov * Math.PI / 180) / 2);
  this.camera3D.position.setZ(cameraDistance);
  
  // Mettre à jour le renderer
  this.renderer3D.setSize(videoWidth, videoHeight);
  
  // Mettre à jour les styles CSS pour l'affichage
  this.renderer3D.domElement.style.width = displayWidth + 'px';
  this.renderer3D.domElement.style.height = displayHeight + 'px';
  
  console.log(`Three.js redimensionné: rendu ${videoWidth}x${videoHeight}, affichage ${displayWidth}x${displayHeight}`);
}

// 8. Méthode pour mettre à jour le canvas FaceMesh
private updateFaceMeshCanvas(canvas: HTMLCanvasElement): void {
  const faceMeshCanvas = this.faceMeshService.getCanvasElement();
  if (faceMeshCanvas && faceMeshCanvas !== canvas) {
    faceMeshCanvas.width = canvas.width;
    faceMeshCanvas.height = canvas.height;
    faceMeshCanvas.style.width = canvas.style.width;
    faceMeshCanvas.style.height = canvas.style.height;
  }
}

// 3. Nouvelle méthode pour calculer les rotations 3D de la tête
private calculateFaceRotations(points: any): THREE.Euler {
// Rotation Z (roulis) - basée sur l'inclinaison des yeux
const eyeDirection = new THREE.Vector3()
.subVectors(points.rightEye, points.leftEye)
.normalize();
const rotationZ = Math.atan2(eyeDirection.y, eyeDirection.x);

// Rotation Y (lacet) - basée sur l'asymétrie du visage
const faceWidth = points.rightEye.x - points.leftEye.x;
const noseOffset = points.noseTip.x - points.eyeCenter.x;
const rotationY = Math.atan2(noseOffset, faceWidth * 0.5) * 0.5;

// Rotation X (tangage) - basée sur la position relative du nez et du front
const faceHeight = points.forehead.y - points.chin.y;
const noseRelativeY = (points.noseTip.y - points.eyeCenter.y) / faceHeight;
const rotationX = Math.atan2(noseRelativeY, 1) * 0.3;

return new THREE.Euler(rotationX, rotationY, rotationZ);
}
private smoothRotation(newRotation: THREE.Euler): THREE.Euler {
  const settings = this.getPerformanceSettings();
  
  // Sur mobile, privilégier la réactivité sur la fluidité
  if (settings.priorityMode) {
    this.rotationHistory.push(newRotation.clone());

    if (this.rotationHistory.length > settings.rotationHistorySize) {
      this.rotationHistory.shift();
    }

    // Lissage minimal pour réactivité maximale
    if (this.rotationHistory.length === 1) {
      return newRotation.clone();
    }
    
    const prev = this.rotationHistory[this.rotationHistory.length - 2];
    
    // Détection de mouvement rapide - si le mouvement est important, suivre immédiatement
    const rotationDelta = Math.abs(newRotation.x - prev.x) + 
                         Math.abs(newRotation.y - prev.y) + 
                         Math.abs(newRotation.z - prev.z);
    
    const isRapidMovement = rotationDelta > 0.1; // Seuil de mouvement rapide
    const adaptiveSmoothingFactor = isRapidMovement ? 0.9 : settings.smoothingFactor;
    
    const smoothed = new THREE.Euler(
      prev.x * (1 - adaptiveSmoothingFactor) + newRotation.x * adaptiveSmoothingFactor,
      prev.y * (1 - adaptiveSmoothingFactor) + newRotation.y * adaptiveSmoothingFactor,
      prev.z * (1 - adaptiveSmoothingFactor) + newRotation.z * adaptiveSmoothingFactor
    );
    return smoothed;
  }

  // Version complète pour desktop (code existant)
  const smoothed = new THREE.Euler(0, 0, 0);
  let totalWeight = 0;

  this.rotationHistory.forEach((rotation, index) => {
    const weight = (index + 1) / this.rotationHistory.length;
    smoothed.x += rotation.x * weight;
    smoothed.y += rotation.y * weight;
    smoothed.z += rotation.z * weight;
    totalWeight += weight;
  });

  smoothed.x /= totalWeight;
  smoothed.y /= totalWeight;
  smoothed.z /= totalWeight;

  return smoothed;
}
private glassesOffset = {
  horizontal:0,
  vertical:0,
  depth: 0,
  noseOffset: 0,
  earOffset: 0,
  scale: 1.0,
  branchAngleOffset: 0
};
// 1. Ajout de nouveaux points de référence pour une meilleure détection 3D
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
// 2. Nouvelle méthode pour calculer la position des oreilles de manière plus précise
private calculateEarPositions(points: any, rotations: THREE.Euler): {leftEar: THREE.Vector3, rightEar: THREE.Vector3} {
  // A. Position de base basée sur les yeux et les tempes
  const eyeDistance = points.leftEye.distanceTo(points.rightEye);
  const faceWidth = eyeDistance * 1.8; // Approximation de la largeur du visage
  
  // B. Calcul des positions des oreilles basé sur la géométrie du visage
  const leftEarBase = new THREE.Vector3(
    points.leftEye.x - faceWidth * 0.6,  // Plus loin que l'œil
    points.leftEye.y + eyeDistance * 0.2, // Légèrement plus bas que l'œil
    points.leftEye.z - eyeDistance * 0.1   // Légèrement en arrière
  );
  
  const rightEarBase = new THREE.Vector3(
    points.rightEye.x + faceWidth * 0.6,
    points.rightEye.y + eyeDistance * 0.2,
    points.rightEye.z - eyeDistance * 0.1
  );
  
  // C. Ajustement basé sur les points de référence disponibles
  const leftEarAdjusted = this.adjustEarWithLandmarks(leftEarBase, points, true);
  const rightEarAdjusted = this.adjustEarWithLandmarks(rightEarBase, points, false);
  
  // D. Compensation pour la rotation de la tête
  const leftEarFinal = this.compensateEarForRotation(leftEarAdjusted, rotations, true);
  const rightEarFinal = this.compensateEarForRotation(rightEarAdjusted, rotations, false);
  
  return {
    leftEar: leftEarFinal,
    rightEar: rightEarFinal
  };
}
private calculateEarPositionsOptimized(points: any, rotations: THREE.Euler): {leftEar: THREE.Vector3, rightEar: THREE.Vector3} {
  const settings = this.getPerformanceSettings();
  
  // Version ultra-simplifiée pour mobile prioritaire
  if (settings.priorityMode) {
    const eyeDistance = points.leftEye.distanceTo(points.rightEye);
    const faceWidth = eyeDistance * 1.8;
    
    // Calcul direct sans ajustements complexes
    const leftEar = new THREE.Vector3(
      points.leftEye.x - faceWidth * 0.6,
      points.leftEye.y + eyeDistance * 0.2,
      points.leftEye.z - eyeDistance * 0.1
    );
    
    const rightEar = new THREE.Vector3(
      points.rightEye.x + faceWidth * 0.6,
      points.rightEye.y + eyeDistance * 0.2,
      points.rightEye.z - eyeDistance * 0.1
    );
    
    return { leftEar, rightEar };
  } else {
    // Version complète pour desktop
    return this.calculateEarPositions(points, rotations);
  }
}
// 3. Ajustement basé sur les landmarks disponibles
private adjustEarWithLandmarks(earBase: THREE.Vector3, points: any, isLeft: boolean): THREE.Vector3 {
  const adjusted = earBase.clone();
  
  if (isLeft) {
    // Utiliser les points de référence du côté gauche
    const templePoint = points.leftTemple;
    const sidePoint = points.leftSideface;
    const cheekPoint = points.leftCheekbone;
    
    // Moyenne pondérée avec les points de référence
    adjusted.x = (adjusted.x * 0.5 + templePoint.x * 0.3 + sidePoint.x * 0.2);
    adjusted.y = (adjusted.y * 0.4 + templePoint.y * 0.3 + cheekPoint.y * 0.3);
    adjusted.z = (adjusted.z * 0.6 + templePoint.z * 0.4);
  } else {
    // Utiliser les points de référence du côté droit
    const templePoint = points.rightTemple;
    const sidePoint = points.rightSideface;
    const cheekPoint = points.rightCheekbone;
    
    adjusted.x = (adjusted.x * 0.5 + templePoint.x * 0.3 + sidePoint.x * 0.2);
    adjusted.y = (adjusted.y * 0.4 + templePoint.y * 0.3 + cheekPoint.y * 0.3);
    adjusted.z = (adjusted.z * 0.6 + templePoint.z * 0.4);
  }
  
  return adjusted;
}
// 4. Compensation améliorée pour la rotation
private compensateEarForRotation(earPosition: THREE.Vector3, rotations: THREE.Euler, isLeft: boolean): THREE.Vector3 {
  const compensated = earPosition.clone();
  
  // Compensation pour rotation Y (lacet - tête qui tourne gauche/droite)
  const yawCompensation = Math.sin(rotations.y) * 20;
  if (isLeft) {
    compensated.x += yawCompensation;
    compensated.z += Math.cos(rotations.y) * 10;
  } else {
    compensated.x -= yawCompensation;
    compensated.z += Math.cos(rotations.y) * 10;
  }
  
  // Compensation pour rotation X (tangage - tête qui penche haut/bas)
  const pitchCompensation = Math.sin(rotations.x) * 15;
  compensated.y += pitchCompensation;
  compensated.z += Math.cos(rotations.x) * 5;
  
  // Compensation pour rotation Z (roulis - tête qui s'incline)
  const rollCompensation = Math.sin(rotations.z) * 10;
  if (isLeft) {
    compensated.x += rollCompensation;
    compensated.y -= Math.cos(rotations.z) * 5;
  } else {
    compensated.x -= rollCompensation;
    compensated.y += Math.cos(rotations.z) * 5;
  }
  
  // Ajout de l'offset utilisateur
  compensated.x += isLeft ? this.glassesOffset.earOffset : -this.glassesOffset.earOffset;
  
  return compensated;
}
private cleanupOptimization() {
  // Limiter la taille des historiques sur mobile
  const settings = this.getPerformanceSettings();
  
  if (this.rotationHistory.length > settings.rotationHistorySize * 2) {
    this.rotationHistory = this.rotationHistory.slice(-settings.rotationHistorySize);
  }
}
// 15. DÉTECTION DE PERFORMANCE ET AJUSTEMENT DYNAMIQUE
private performanceMonitor = {
  frameCount: 0,
  lastCheck: Date.now(),
  avgFrameTime: 16.67, // 60fps target
  adaptiveMode: false
};
private monitorPerformance() {
  this.performanceMonitor.frameCount++;
  const now = Date.now();
  
  if (now - this.performanceMonitor.lastCheck > 2000) { // Vérifier toutes les 2 secondes au lieu de 1
    const actualFPS = this.performanceMonitor.frameCount / 2;
    this.performanceMonitor.frameCount = 0;
    this.performanceMonitor.lastCheck = now;
    
    // Réduire moins agressivement les FPS sur mobile
    if (actualFPS < 15 && this.isMobile()) {
      this.performanceMonitor.adaptiveMode = true;
      this.targetFrameTime = 1000 / 20; // Réduire à 20fps au lieu de 15
      console.log('Mode performance adaptatif activé - 20fps');
    } else if (actualFPS > 20 && this.performanceMonitor.adaptiveMode) {
      this.performanceMonitor.adaptiveMode = false;
      this.targetFrameTime = 1000 / 30; // Revenir à 30fps
      console.log('Mode performance normal restauré - 30fps');
    }
  }
}
private calculateGlassesTransform(points: any) {
  const settings = this.getPerformanceSettings();
  
  // A. Centre entre les yeux
  const eyeCenter = new THREE.Vector3()
    .addVectors(points.leftEye, points.rightEye)
    .multiplyScalar(0.5);
  
  // B. Position sur le nez
  const nosePosition = points.noseBridge.clone();
  nosePosition.y += this.glassesOffset.noseOffset;
  
  // C. Calcul des rotations - TOUJOURS calculer pour avoir le mouvement
  let rotations = this.calculateFaceRotations(points);
  
  // D. Lissage adaptatif selon la plateforme
  let smoothedRotations = rotations;
  if (settings.rotationHistorySize > 0) {
    smoothedRotations = this.smoothRotation(rotations);
  }
  
  // E. Calcul des oreilles optimisé
  const earPositions = this.calculateEarPositionsOptimized(points, smoothedRotations);
  
  // F. Position finale simplifiée pour mobile
  let finalPosition: THREE.Vector3;
  let dynamicAlpha: number;
  
  if (settings.priorityMode) {
    // Version simplifiée ultra-rapide pour mobile
    dynamicAlpha = 0.6; // Valeur fixe pour éviter les calculs
    finalPosition = new THREE.Vector3(
      eyeCenter.x * dynamicAlpha + nosePosition.x * (1 - dynamicAlpha) + this.glassesOffset.horizontal,
      eyeCenter.y * dynamicAlpha + nosePosition.y * (1 - dynamicAlpha) + this.glassesOffset.vertical,
      (eyeCenter.z * dynamicAlpha + nosePosition.z * (1 - dynamicAlpha)) + this.glassesOffset.depth - 8
    );
  } else {
    // Version complète pour desktop
    const faceOrientation = this.calculateFaceOrientation(points, smoothedRotations);
    const dynamicDepthAdjustment = this.calculateDynamicDepthAdjustment(smoothedRotations, faceOrientation);
    const orientationOffset = this.calculateOrientationOffset(smoothedRotations, faceOrientation);
    dynamicAlpha = this.calculateDynamicAlpha(smoothedRotations);
    
    finalPosition = new THREE.Vector3(
      eyeCenter.x * dynamicAlpha + nosePosition.x * (1 - dynamicAlpha) + 
      this.glassesOffset.horizontal + orientationOffset.x,
      
      eyeCenter.y * dynamicAlpha + nosePosition.y * (1 - dynamicAlpha) + 
      this.glassesOffset.vertical + orientationOffset.y,
      
      (eyeCenter.z * dynamicAlpha + nosePosition.z * (1 - dynamicAlpha)) + 
      this.glassesOffset.depth - dynamicDepthAdjustment + orientationOffset.z
    );
  }
  
  // G. Échelle optimisée
  const baseScale = this.calculateOptimalScale(points);
  const perspectiveScale = settings.priorityMode ? 1.0 : this.calculatePerspectiveScale(smoothedRotations, this.calculateFaceOrientation(points, smoothedRotations));
  const adjustedScale = baseScale * perspectiveScale;
  
  return {
    position: finalPosition,
    rotation: smoothedRotations,
    scale: new THREE.Vector3(adjustedScale, adjustedScale, adjustedScale),
    nosePosition: nosePosition,
    leftEarPosition: earPositions.leftEar,
    rightEarPosition: earPositions.rightEar,
    eyeCenter: eyeCenter
  };
}

// Nouvelles méthodes d'assistance pour le suivi amélioré
private calculateFaceOrientation(points: any, rotations: any) {
  // Vecteur directionnel du visage
  const eyeVector = new THREE.Vector3()
    .subVectors(points.rightEye, points.leftEye)
    .normalize();
  
  // Vecteur du nez vers les yeux
  const eyeCenter = new THREE.Vector3()
    .addVectors(points.leftEye, points.rightEye)
    .multiplyScalar(0.5);
  
  const noseToEyeVector = new THREE.Vector3()
    .subVectors(eyeCenter, points.noseBridge)
    .normalize();
  
  return {
    eyeVector,
    noseToEyeVector,
    faceAngle: Math.atan2(eyeVector.y, eyeVector.x)
  };
}

private calculateDynamicDepthAdjustment(rotations: any, faceOrientation: any) {
  // Ajustement plus fluide selon les rotations - RAPPROCHÉ
  const baseDepth = Math.cos(rotations.y) * 6 + Math.cos(rotations.x) * 3; // Réduit de 10->6 et 5->3
  
  // Correction supplémentaire selon l'orientation du visage - RAPPROCHÉE
  const orientationCorrection = Math.abs(Math.sin(rotations.y)) * 1.5; // Réduit de 3->1.5
  
  return baseDepth + orientationCorrection;
}

private calculateOrientationOffset(rotations: any, faceOrientation: any) {
  // Offsets adaptatifs selon l'orientation de la tête
  const lateralOffset = Math.sin(rotations.y) * 2; // Mouvement gauche/droite
  const verticalOffset = Math.sin(rotations.x) * 1.5; // Mouvement haut/bas
  const depthOffset = (1 - Math.cos(rotations.y)) * 1; // RAPPROCHÉ : Réduit de 2->1
  
  return new THREE.Vector3(lateralOffset, verticalOffset, -depthOffset); // NÉGATIF pour rapprocher
}

private calculateDynamicAlpha(rotations: any) {
  // Alpha qui s'adapte selon l'angle de la tête
  // Plus la tête est tournée, plus on privilégie les yeux
  const baseAlpha = 0.5;
  const rotationIntensity = Math.abs(rotations.x) + Math.abs(rotations.y);
  const adjustment = Math.min(rotationIntensity * 0.3, 0.3); // Max 0.3 d'ajustement
  
  return Math.min(0.8, baseAlpha + adjustment); // Alpha entre 0.5 et 0.8
}

private calculatePerspectiveScale(rotations: any, faceOrientation: any) {
  // Ajustement d'échelle selon la perspective
  const frontFactor = Math.cos(rotations.y); // 1 quand de face, diminue sur les côtés
  const verticalFactor = Math.cos(rotations.x); // 1 quand droit, diminue si tête penchée
  
  // Échelle légèrement réduite quand on n'est pas de face
  const minScale = 0.85;
  const scaleFactor = minScale + (1 - minScale) * frontFactor * verticalFactor;
  
  return scaleFactor;
}
//////////////////
private calculateOptimalScale(points: any): number {
  const ipd = points.leftEye.distanceTo(points.rightEye);
  const eyeToNose = points.eyeCenter.distanceTo(points.noseBridge);
  const faceWidth = points.leftEyeOuter.distanceTo(points.rightEyeOuter);
  
  // Valeurs de référence pour une distance "normale" de la caméra
  const referenceIPD = 80;
  const referenceFaceWidth = 100;
  const referenceNoseDistance = 30;
  
  // Calcul des facteurs d'échelle (plus la mesure est grande, plus l'échelle doit être grande)
  const ipdFactor = ipd / referenceIPD;
  const faceFactor = faceWidth / referenceFaceWidth;
  const noseFactor = eyeToNose / referenceNoseDistance;
  
  // Moyenne pondérée des facteurs
  let scale = (ipdFactor * 0.5 + faceFactor * 0.3 + noseFactor * 0.2);
  
  // Application d'une courbe de lissage pour éviter les variations trop brusques
  scale = this.smoothScale(scale);
  
  // Limitation avec une plage plus large pour permettre l'adaptation à la distance
  return Math.max(0.3, Math.min(2.0, scale));
}

// Méthode pour lisser les variations d'échelle
private previousScale: number = 1.0;
private smoothScale(newScale: number): number {
  const settings = this.getPerformanceSettings();
  
  if (settings.priorityMode) {
    // Lissage minimal pour mobile
    const adaptiveFactor = 0.8; // Plus réactif
    this.previousScale = this.previousScale * (1 - adaptiveFactor) + newScale * adaptiveFactor;
  } else {
    // Lissage normal pour desktop
    this.previousScale = this.previousScale * (1 - settings.smoothingFactor) + newScale * settings.smoothingFactor;
  }
  
  return this.previousScale;
}
// 7. LIMITATION FPS POUR MOBILE
private lastFrameTime = 0;
// 3. Conversion précise des coordonnées
private convertLandmarkToThreeJS(landmark: any, videoWidth: number, videoHeight: number): THREE.Vector3 {
  // Conversion standard MediaPipe -> Three.js
  const x = (landmark.x - 0.5) * videoWidth;
  const y = -(landmark.y - 0.5) * videoHeight;
  const z = landmark.z * videoWidth;
  
  return new THREE.Vector3(x, y, z);
}
private extractGlassesPoints(landmarks: any[], videoWidth: number, videoHeight: number) {
  // Utiliser les vraies dimensions vidéo, pas les dimensions d'affichage
  const realVideoWidth = this.videoElement?.nativeElement?.videoWidth || videoWidth;
  const realVideoHeight = this.videoElement?.nativeElement?.videoHeight || videoHeight;
  
  const getPoint = (index: number) => 
    this.convertLandmarkToThreeJS(landmarks[index], realVideoWidth, realVideoHeight);
  
  // ... reste de votre code existant ...
  const points: any = {
    leftEye: getPoint(this.FACE_LANDMARKS.leftEyeCenter),
    rightEye: getPoint(this.FACE_LANDMARKS.rightEyeCenter),
    leftEyeOuter: getPoint(this.FACE_LANDMARKS.leftEyeOuter),
    rightEyeOuter: getPoint(this.FACE_LANDMARKS.rightEyeOuter),
    noseBridge: getPoint(this.FACE_LANDMARKS.noseBridge),
    noseTop: getPoint(this.FACE_LANDMARKS.noseTop),
    noseTip: getPoint(this.FACE_LANDMARKS.noseTip),
    leftEarApprox: getPoint(this.FACE_LANDMARKS.leftEar),
    rightEarApprox: getPoint(this.FACE_LANDMARKS.rightEar),
    leftTemple: getPoint(this.FACE_LANDMARKS.leftTemple),
    rightTemple: getPoint(this.FACE_LANDMARKS.rightTemple),
    leftSideface: getPoint(this.FACE_LANDMARKS.leftJaw),
    rightSideface: getPoint(this.FACE_LANDMARKS.rightJaw),
    leftCheekbone: getPoint(this.FACE_LANDMARKS.leftCheek),
    rightCheekbone: getPoint(this.FACE_LANDMARKS.rightCheek),
    forehead: getPoint(this.FACE_LANDMARKS.forehead),
    chin: getPoint(this.FACE_LANDMARKS.chin),
    mouthLeft: getPoint(this.FACE_LANDMARKS.mouthLeft),
    mouthRight: getPoint(this.FACE_LANDMARKS.mouthRight)
  };
  
  points.eyeCenter = new THREE.Vector3()
    .addVectors(points.leftEye, points.rightEye)
    .multiplyScalar(0.5);
  
  return points;
}
// 6. Positionnement amélioré avec prise en compte de la rotation 3D
private positionGlassesWithThreePointSupport(glasses3D: THREE.Object3D, transform: any) {
  if (!glasses3D) return;
  
  // Position principale
  glasses3D.position.copy(transform.position);
  glasses3D.rotation.copy(transform.rotation);
  
  // Échelle ajustée selon la distance au visage
  const distanceToCamera = Math.abs(transform.position.z);
  const scaleFactor = Math.max(0.6, Math.min(1.2, 100 / distanceToCamera));
  const adjustedScale = transform.scale.clone().multiplyScalar(scaleFactor);
  glasses3D.scale.copy(adjustedScale);
  
  // Ajustement pour coller au visage
  const faceProximityAdjustment = new THREE.Vector3(0, 0, -10);
  glasses3D.position.add(faceProximityAdjustment);
}


// 11. Méthode principale d'animation
public animate(faceMeshService: any, videoElement: HTMLVideoElement | null, glasses3D: THREE.Object3D | null): void {
  try {
    const landmarks = faceMeshService.getFaceLandmarks();
    
    if (!landmarks || landmarks.length < 478 || !glasses3D) {
      return;
    }

    const videoWidth = videoElement?.videoWidth || 640;
    const videoHeight = videoElement?.videoHeight || 480;
    const video = this.videoElement?.nativeElement;
    // 1. Extraire les points essentiels
    const points = this.extractGlassesPoints(landmarks, videoWidth, videoHeight);
    
    // 2. Calculer la transformation
    const transform = this.calculateGlassesTransform(points);
    
    // 3. Positionner les lunettes
    this.positionGlassesWithThreePointSupport(glasses3D, transform);
  } catch (error) {
    console.error('Erreur dans l\'animation des lunettes:', error);
  }
}
private animate3D = (): void => {
  if(this.glasses3D){
  this.animate(
    this.faceMeshService, 
    this.videoElement?.nativeElement, 
    this.glasses3D,
  );
}
};
  onVideoReady(): void {
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const updateDimensions = () => {
      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 480;
      const displayWidth = video.clientWidth;
      const displayHeight = video.clientHeight;
      
      // Mettre à jour le canvas
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      canvas.style.width = displayWidth + 'px';
      canvas.style.height = displayHeight + 'px';
      
      // Mettre à jour Three.js
      if (this.threeInitialized) {
        this.updateThreeJSSize(displayWidth, displayHeight, videoWidth, videoHeight);
      }
      
      console.log(`Dimensions mises à jour: vidéo ${videoWidth}x${videoHeight}, affichage ${displayWidth}x${displayHeight}`);
    };
    
    if (video.readyState >= 1) {
      updateDimensions();
    } else {
      video.addEventListener('loadedmetadata', updateDimensions, { once: true });
    }
    
    if (video && this.cameraStream) {
      if (video.srcObject !== this.cameraStream) {
        video.srcObject = this.cameraStream;
        console.log('Flux vidéo assigné à la balise <video>');
      }
      video.play().catch(e => console.warn('Erreur play vidéo:', e));
    }
    
  } 
  // 3. MÉTHODE onVideoReady CORRIGÉE
  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.cameraSubscription.unsubscribe();
    this.faceDetectionSubscription.unsubscribe();
    this.faceMeshService.removeOnFrameCallback();
    this.faceMeshService.stop().catch(error => {
      console.error('Error stopping face mesh service:', error);
    });
    this.cameraService.stopCamera();
    // Nettoyer les listeners
  window.removeEventListener('resize', this.handleWindowResize);
  
  if (this.resizeObserver) {
    this.resizeObserver.disconnect();
  }
  }
  renderOverlay(): void {
    const ctx = this.faceMeshService.getCanvasContext();
    const canvas = this.faceMeshService.getCanvasElement();
    const landmarks = this.faceMeshService.getFaceLandmarks();
  
    if (ctx && canvas && landmarks) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  public forceResize(): void {
    setTimeout(() => {
      this.handleVideoContainerResize();
    }, 100);
  }
  //pour activer le camera
  async toggleCamera(): Promise<void> {
    try {
      console.log('toggleCamera appelé, état actuel:', this.cameraState$.value);
      
      if (this.isCameraStarting) {
        console.log('La caméra est déjà en cours de démarrage');
        return;
      }

      if (this.cameraState$.value) {
        console.log('Désactivation de la caméra...');
        await this.cameraService.stopCamera();
        await this.faceMeshService.stop();
        this.cameraState$.next(false);
        this.isCameraStarting = false;
      } else {
        console.log('Activation de la caméra...');
        this.isCameraStarting = true;
        
        // Vérifier si les éléments existent
        const video = this.videoElement?.nativeElement;
        const canvas = this.canvasElement?.nativeElement;
        
        if (!video || !canvas) {
          console.error('Éléments vidéo ou canvas non trouvés');
          this.cameraState$.next(false);
          this.isCameraStarting = false;
          return;
        }

        try {
          // Démarrer la caméra
          const success = await this.cameraService.startCamera(video);
          if (success) {
            console.log('Caméra démarrée avec succès');
            
            // Attendre que la vidéo soit prête avant d'initialiser FaceMesh
            await new Promise<void>((resolve) => {
              const checkVideoReady = () => {
                if (video.readyState >= 2) {
                  resolve();
                } else {
                  setTimeout(checkVideoReady, 100);
                }
              };
              checkVideoReady();
            });
            
            // Initialiser FaceMesh avec gestion d'erreur
            await this.faceMeshService.initialize(video, canvas);
            console.log('FaceMesh initialisé avec succès');
            this.isCameraStarting = false;
          } else {
            console.log('Échec du démarrage de la caméra');
            this.cameraState$.next(false);
            this.isCameraStarting = false;
          }
        } catch (error) {
          console.error('Erreur lors de l\'initialisation:', error);
          await this.cameraService.stopCamera();
          await this.faceMeshService.stop();
          this.cameraState$.next(false);
          this.isCameraStarting = false;
        }
      }
      
      console.log('Nouvel état:', this.cameraState$.value);
    } catch (error) {
      console.error('Erreur lors du basculement de la caméra:', error);
      this.cameraState$.next(false);
      this.isCameraStarting = false;
    }
  }
  async onCapturePhoto(): Promise<void> {
    if (this.videoElement) {
      this.capturedPhoto = await this.cameraService.capturePhoto(this.videoElement.nativeElement);
    }
  }
  downloadPhoto(): void {
    if (this.capturedPhoto) {
      const link = document.createElement('a');
      link.download = 'photo-avec-lunettes.png';
      link.href = this.capturedPhoto;
      link.click();
    }
  }
  //pour ajuster la taille du lunettes
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
    // Sinon, rien à dessiner ici (tout est fait en 3D)
  }
  
  private load3DModel() {
    console.log('Chemin du modèle 3D à charger :', this.getModel3DPathFromGlass(this.glass));
    // Supprime l'ancien modèle si besoin
    if (this.glasses3D) {
      this.scene3D.remove(this.glasses3D);
    }
    const loader = new GLTFLoader();
    loader.load(
      this.getModel3DPathFromGlass(this.glass),
      (gltf) => {
        // --- Correction calibration automatique ---
        this.glasses3D = gltf.scene;
        this.glasses3D.scale.set(1, 1, 1);
if (this.faceMeshService.getFaceLandmarks()) {
  const video = this.videoElement?.nativeElement;
  const videoWidth = video?.videoWidth || 640;
  const videoHeight = video?.videoHeight || 480;
  const points = this.extractGlassesPoints(
    this.faceMeshService.getFaceLandmarks(), 
    videoWidth, 
    videoHeight
  );
  this.glasses3D.position.copy(points.eyeCenter);
}
this.scene3D.add(this.glasses3D);
      },
      undefined,
      (error) => {
        console.error('Erreur de chargement du modèle 3D:', error);
      }
    );
  }
// 11. Modifiez initThreeJS pour être plus flexible
private initThreeJS() {
  if (this.threeInitialized) return;
  
  this.scene3D = new THREE.Scene();
  this.scene3D.background = null;
  
  const light = new THREE.AmbientLight(0xffffff, 1);
  this.scene3D.add(light);
  
  // Obtenir les dimensions actuelles
  const video = this.videoElement?.nativeElement;  
  const videoWidth = video?.videoWidth || 640;
  const videoHeight = video?.videoHeight || 480;
  const displayWidth = video?.clientWidth || 640;
  const displayHeight = video?.clientHeight || 480;
  
  const aspectRatio = videoWidth / videoHeight;
  const fov = 50;
  const cameraDistance = (videoHeight / 2) / Math.tan((fov * Math.PI / 180) / 2);
  
  this.camera3D = new THREE.PerspectiveCamera(fov, aspectRatio, 0.1, 5000);
  this.camera3D.position.set(0, 0, cameraDistance);
  this.camera3D.lookAt(0, 0, 0);
  
  this.renderer3D = new THREE.WebGLRenderer({ alpha: true });
  this.renderer3D.setSize(videoWidth, videoHeight);
  this.renderer3D.domElement.style.width = displayWidth + 'px';
  this.renderer3D.domElement.style.height = displayHeight + 'px';
  
  this.threeContainer.nativeElement.appendChild(this.renderer3D.domElement);
  console.log('Three.js initialisé avec dimensions:', { videoWidth, videoHeight, displayWidth, displayHeight });
  
  if (this.glass) {
    this.load3DModel();
  }
  
  this.threeInitialized = true;
}
}
