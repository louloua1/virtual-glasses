import * as THREE from 'three';

export class MobileGlassesOptimizer {
  private devicePixelRatio: number;
  private screenOrientation: string;
  private videoConstraints: any;
  private readonly MOBILE_FRAME_INTERVAL = 50; // ~20fps sur mobile, 60fps sur desktop
  isMobile: boolean = false;
  

  constructor() {
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.isMobile = this.detectMobile();
    this.screenOrientation = this.getScreenOrientation();
    this.setupMobileConstraints();
  }

  // 1. Détection mobile améliorée
  private detectMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768 && 'ontouchstart' in window);
  }

  // 2. Contraintes vidéo optimisées pour mobile
  private setupMobileConstraints(): void {
    if (this.isMobile) {
      this.videoConstraints = {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 }, // Réduction du framerate sur mobile
          facingMode: 'user',
          aspectRatio: 4/3
        }
      };
    } else {
      this.videoConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user'
        }
      };
    }
  }

  // 3. Calcul des rotations optimisé pour mobile
 public  calculateFaceRotationsMobile(points: any): THREE.Euler {
    // Coefficients réduits pour mobile (moins de variations)
    const mobileDamping = this.isMobile ? 0.3 : 1.0;
    
    // Rotation Z (roulis) avec lissage mobile
    const eyeDirection = new THREE.Vector3()
      .subVectors(points.rightEye, points.leftEye)
      .normalize();
    const rotationZ = Math.atan2(eyeDirection.y, eyeDirection.x) * mobileDamping;

    // Rotation Y (lacet) avec limitation sur mobile
    const faceWidth = points.rightEye.x - points.leftEye.x;
    const noseOffset = points.noseTip.x - points.eyeCenter.x;
    const rotationY = Math.atan2(noseOffset, faceWidth * 0.5) * 0.3 * mobileDamping;

    // Rotation X (tangage) avec stabilisation mobile
    const faceHeight = Math.abs(points.forehead.y - points.chin.y);
    const noseRelativeY = (points.noseTip.y - points.eyeCenter.y) / Math.max(faceHeight, 1);
    const rotationX = Math.atan2(noseRelativeY, 1) * 0.2 * mobileDamping;

    return new THREE.Euler(
      Math.max(-0.3, Math.min(0.3, rotationX)),
      Math.max(-0.4, Math.min(0.4, rotationY)),
      Math.max(-0.2, Math.min(0.2, rotationZ))
    );
  }

  // 4. Lissage temporel adapté au mobile
  private rotationHistoryMobile: THREE.Euler[] = [];
  private readonly MOBILE_HISTORY_SIZE = this.isMobile ? 3 : 5; // Historique réduit sur mobile

  private smoothRotationMobile(newRotation: THREE.Euler): THREE.Euler {
    this.rotationHistoryMobile.push(newRotation.clone());

    if (this.rotationHistoryMobile.length > this.MOBILE_HISTORY_SIZE) {
      this.rotationHistoryMobile.shift();
    }

    // Lissage plus agressif sur mobile
    const smoothed = new THREE.Euler(0, 0, 0);
    let totalWeight = 0;
    const mobileSmoothing = this.isMobile ? 0.7 : 0.5;

    this.rotationHistoryMobile.forEach((rotation, index) => {
      const weight = (index + 1) / this.rotationHistoryMobile.length;
      const finalWeight = weight * mobileSmoothing;
      
      smoothed.x += rotation.x * finalWeight;
      smoothed.y += rotation.y * finalWeight;
      smoothed.z += rotation.z * finalWeight;
      totalWeight += finalWeight;
    });

    if (totalWeight > 0) {
      smoothed.x /= totalWeight;
      smoothed.y /= totalWeight;
      smoothed.z /= totalWeight;
    }

    return smoothed;
  }

  // 5. Calcul d'échelle adapté aux différentes résolutions mobiles
  private calculateMobileScale(points: any, videoWidth: number, videoHeight: number): number {
    const ipd = points.leftEye.distanceTo(points.rightEye);
    const screenWidth = window.innerWidth;
    const videoElement = document.querySelector('video') as HTMLVideoElement;
    
    // Facteur de base selon la taille d'écran
    let baseFactor = 1.0;
    if (screenWidth <= 375) { // iPhone SE, petits écrans
      baseFactor = 0.8;
    } else if (screenWidth <= 414) { // iPhone standard
      baseFactor = 0.9;
    } else if (screenWidth >= 768) { // Tablettes
      baseFactor = 1.1;
    }

    // Ajustement selon le ratio vidéo/écran
    const videoDisplayWidth = videoElement?.clientWidth || videoWidth;
    const scaleRatio = videoDisplayWidth / videoWidth;
    
    // Calcul final avec limitations
    const ipdFactor = (ipd / 70) * baseFactor * scaleRatio;
    const finalScale = Math.max(0.5, Math.min(1.5, ipdFactor));
    
    console.log(`Mobile scale calculation: screenWidth=${screenWidth}, baseFactor=${baseFactor}, scaleRatio=${scaleRatio}, finalScale=${finalScale}`);
    
    return finalScale;
  }

  // 6. Positionnement des oreilles optimisé pour mobile
  private calculateEarPositionsMobile(points: any, rotations: THREE.Euler, videoWidth: number): {leftEar: THREE.Vector3, rightEar: THREE.Vector3} {
    const eyeDistance = points.leftEye.distanceTo(points.rightEye);
    const mobileReduction = this.isMobile ? 0.8 : 1.0; // Réduction sur mobile
    
    // Adaptation selon la largeur de l'écran
    const screenFactor = Math.min(1.0, window.innerWidth / 375);
    const faceWidth = eyeDistance * 1.6 * mobileReduction * screenFactor;
    
    const leftEarBase = new THREE.Vector3(
      points.leftEye.x - faceWidth * 0.55,
      points.leftEye.y + eyeDistance * 0.15,
      points.leftEye.z - eyeDistance * 0.08
    );
    
    const rightEarBase = new THREE.Vector3(
      points.rightEye.x + faceWidth * 0.55,
      points.rightEye.y + eyeDistance * 0.15,
      points.rightEye.z - eyeDistance * 0.08
    );

    // Compensation de rotation réduite sur mobile
    const mobileRotationDamping = 0.6;
    
    // Compensation Y (lacet)
    const yawComp = Math.sin(rotations.y) * 15 * mobileRotationDamping;
    leftEarBase.x += yawComp;
    rightEarBase.x -= yawComp;

    // Compensation X (tangage)
    const pitchComp = Math.sin(rotations.x) * 10 * mobileRotationDamping;
    leftEarBase.y += pitchComp;
    rightEarBase.y += pitchComp;

    // Compensation Z (roulis)
    const rollComp = Math.sin(rotations.z) * 8 * mobileRotationDamping;
    leftEarBase.x += rollComp;
    rightEarBase.x -= rollComp;

    return {
      leftEar: leftEarBase,
      rightEar: rightEarBase
    };
  }

  // 7. Configuration Three.js optimisée pour mobile
  private setupMobileThreeJS(): THREE.WebGLRenderer {
    let renderer: THREE.WebGLRenderer;
    if (this.isMobile) {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'low-power',
        precision: 'mediump'
      });
      renderer.setPixelRatio(Math.min(this.devicePixelRatio, 2));
      renderer.shadowMap.enabled = false;
    } else {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
      });
      renderer.setPixelRatio(this.devicePixelRatio);
      renderer.shadowMap.enabled = true;
    }
    return renderer;
  }
  // 8. Gestion de l'orientation mobile
  public  handleOrientationChange(): void {
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.screenOrientation = this.getScreenOrientation();
        this.updateCameraConstraints();
        // Réinitialiser le canvas et la caméra
        this.reinitializeCamera();
      }, 500); // Délai pour laisser le temps au navigateur de s'adapter
    });
  }

  private getScreenOrientation(): string {
    if (screen.orientation) {
      return screen.orientation.type;
    }
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  }

  private updateCameraConstraints(): void {
    if (this.screenOrientation.includes('landscape')) {
      this.videoConstraints.video.width = { ideal: 640, max: 1280 };
      this.videoConstraints.video.height = { ideal: 480, max: 720 };
    } else {
      this.videoConstraints.video.width = { ideal: 480, max: 720 };
      this.videoConstraints.video.height = { ideal: 640, max: 1280 };
    }
  }

  // 9. Animation optimisée pour mobile avec throttling
  private lastFrameTime = 0;
  public animateMobile(faceMeshService: any, videoElement: HTMLVideoElement | null, glasses3D: THREE.Object3D | null): boolean {
    const now = Date.now();
    
    // Throttling des frames sur mobile
    if (now - this.lastFrameTime < this.MOBILE_FRAME_INTERVAL) {
      return false;
    }
    this.lastFrameTime = now;

    try {
      const landmarks = faceMeshService.getFaceLandmarks();
      
      if (!landmarks || landmarks.length < 478 || !glasses3D) {
        return false;
      }

      const videoWidth = videoElement?.videoWidth || 640;
      const videoHeight = videoElement?.videoHeight || 480;
      
      // Extraction des points avec validation mobile
      const points = this.extractGlassesPointsMobile(landmarks, videoWidth, videoHeight);
      if (!this.validatePoints(points)) {
        return false;
      }
      
      // Calcul de transformation mobile
      const transform = this.calculateGlassesTransformMobile(points, videoWidth, videoHeight);
      
      // Positionnement avec validation
      this.positionGlassesWithMobileSupport(glasses3D, transform);
      
      return true;
    } catch (error) {
      console.error('Erreur dans l\'animation mobile:', error);
      return false;
    }
  }

  // 10. Validation des points pour éviter les erreurs
  private validatePoints(points: any): boolean {
    const requiredPoints = ['leftEye', 'rightEye', 'noseBridge', 'eyeCenter'];
    return requiredPoints.every(point => 
      points[point] && 
      typeof points[point].x === 'number' && 
      typeof points[point].y === 'number' && 
      typeof points[point].z === 'number' &&
      !isNaN(points[point].x) && 
      !isNaN(points[point].y) && 
      !isNaN(points[point].z)
    );
  }

  // 11. Extraction de points avec fallback mobile
  private extractGlassesPointsMobile(landmarks: any[], videoWidth: number, videoHeight: number): any {
    const getPointSafe = (index: number) => {
      try {
        return this.convertLandmarkToThreeJS(landmarks[index], videoWidth, videoHeight);
      } catch (error) {
        console.warn(`Erreur extraction point ${index}:`, error);
        return new THREE.Vector3(0, 0, 0);
      }
    };

    const points: any = {
      leftEye: getPointSafe(159),
      rightEye: getPointSafe(386),
      leftEyeOuter: getPointSafe(33),
      rightEyeOuter: getPointSafe(263),
      noseBridge: getPointSafe(168),
      noseTip: getPointSafe(1),
      leftTemple: getPointSafe(127),
      rightTemple: getPointSafe(356),
      forehead: getPointSafe(10),
      chin: getPointSafe(175)
    };

    // Calcul sécurisé du centre des yeux
    points.eyeCenter = new THREE.Vector3()
      .addVectors(points.leftEye, points.rightEye)
      .multiplyScalar(0.5);

    return points;
  }

  // 12. Transformation complète pour mobile
  private calculateGlassesTransformMobile(points: any, videoWidth: number, videoHeight: number): any {
    // Position de base
    const eyeCenter = points.eyeCenter.clone();
    const nosePosition = points.noseBridge.clone();
    
    // Rotations mobiles
    const rotations = this.calculateFaceRotationsMobile(points);
    const smoothedRotations = this.smoothRotationMobile(rotations);
    
    // Échelle mobile
    const scale = this.calculateMobileScale(points, videoWidth, videoHeight);
    
    // Positions des oreilles
    const earPositions = this.calculateEarPositionsMobile(points, smoothedRotations, videoWidth);
    
    // Ajustement de profondeur mobile
    const depthAdjustment = Math.cos(smoothedRotations.y) * 8 + Math.cos(smoothedRotations.x) * 4;
    
    const finalPosition = new THREE.Vector3(
      eyeCenter.x,
      eyeCenter.y,
      nosePosition.z - depthAdjustment
    );

    return {
      position: finalPosition,
      rotation: smoothedRotations,
      scale: new THREE.Vector3(scale, scale, scale),
      nosePosition: nosePosition,
      leftEarPosition: earPositions.leftEar,
      rightEarPosition: earPositions.rightEar,
      eyeCenter: eyeCenter
    };
  }

  // 13. Positionnement final avec support mobile
  private positionGlassesWithMobileSupport(glasses3D: THREE.Object3D, transform: any): void {
    if (!glasses3D) return;
    
    // Position et rotation
    glasses3D.position.copy(transform.position);
    glasses3D.rotation.copy(transform.rotation);
    
    // Échelle avec facteur de distance mobile
    const distanceToCamera = Math.abs(transform.position.z);
    const mobileDistanceFactor = this.isMobile ? 1.2 : 1.0;
    const scaleFactor = Math.max(0.6, Math.min(1.4, (100 / distanceToCamera) * mobileDistanceFactor));
    
    const adjustedScale = transform.scale.clone().multiplyScalar(scaleFactor);
    glasses3D.scale.copy(adjustedScale);
    
    // Ajustement de proximité pour mobile
    const proximityOffset = this.isMobile ? -8 : -10;
    const faceProximityAdjustment = new THREE.Vector3(0, 0, proximityOffset);
    glasses3D.position.add(faceProximityAdjustment);
  }

  // 14. Réinitialisation de caméra pour changement d'orientation
  private async reinitializeCamera(): Promise<void> {
    // Cette méthode doit être appelée depuis votre composant principal
    console.log('Réinitialisation nécessaire après changement d\'orientation');
  }

  // 15. Utilitaire de conversion amélioré
  private convertLandmarkToThreeJS(landmark: any, videoWidth: number, videoHeight: number): THREE.Vector3 {
    if (!landmark || typeof landmark.x !== 'number' || typeof landmark.y !== 'number') {
      throw new Error('Landmark invalide');
    }
    
    const x = (landmark.x - 0.5) * videoWidth;
    const y = -(landmark.y - 0.5) * videoHeight;
    const z = (landmark.z || 0) * videoWidth;
    
    return new THREE.Vector3(x, y, z);
  }

  // 16. Getters publics
  public getVideoConstraints() {
    return this.videoConstraints;
  }

  public isMobileDevice(): boolean {
    return this.isMobile;
  }

  public getCurrentOrientation(): string {
    return this.screenOrientation;
  }
}