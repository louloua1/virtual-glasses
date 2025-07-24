import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

@Injectable({
  providedIn: 'root'
})
export class FaceMeshService {
  private faceMeshForVideo: FaceMesh | null = null;
  private faceMeshForImage: FaceMesh | null = null;
  private camera: Camera | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private isInitialized = false;
  private lastFaceLandmarks: any | null = null;
  private initializationPromise: Promise<void> | null = null;
  private fallbackMode = false;

  private faceDetection$ = new BehaviorSubject<boolean>(false);

  constructor() {}

  private onFrameCallback: (() => void) | null = null;

  setOnFrameCallback(callback: () => void): void {
    this.onFrameCallback = callback;
  }

  removeOnFrameCallback(): void {
    this.onFrameCallback = null;
  }

  async initialize(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<void> {
    if (this.isInitialized) {
      // Déjà initialisé, ne réinitialise pas !
      return;
    }
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        this.canvasCtx = canvasElement.getContext('2d');
        if (!this.canvasCtx) throw new Error('Could not get canvas context');

        // Set canvas dimensions to match video
        if (videoElement.videoWidth && videoElement.videoHeight) {
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
        } else {
          canvasElement.width = 640;
          canvasElement.height = 480;
        }

        // Clean up existing instances (camera uniquement)
        await this.cleanup();

        // Instancie FaceMesh UNE SEULE FOIS
        if (!this.faceMeshForVideo) {
          const MEDIAPIPE_VERSION = '0.4.1633559619';
          this.faceMeshForVideo = new FaceMesh({
            locateFile: (file) =>
              `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${MEDIAPIPE_VERSION}/${file}`,
          });

          this.faceMeshForVideo.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          });

          this.faceMeshForVideo.onResults((results) => {
            try {
              this.drawFaceMesh(results);
              this.faceDetection$.next(true);
              if (this.onFrameCallback) this.onFrameCallback();
            } catch (error) {
              console.error('Error in face mesh results handler:', error);
              this.faceDetection$.next(false);
            }
          });
        }

        // Camera setup
        this.camera = new Camera(videoElement, {
          onFrame: async () => {
            try {
              if (this.faceMeshForVideo && this.videoElement && this.videoElement.readyState >= 2) {
                await this.faceMeshForVideo.send({ image: this.videoElement });
              }
            } catch (error) {
              console.error('Error sending frame to face mesh:', error);
            }
          },
          width: 640,
          height: 480
        });

        await this.camera.start();
        this.isInitialized = true;
        resolve();
      } catch (error) {
        console.error('Error initializing FaceMesh service:', error);
        await this.cleanup();
        reject(error);
      } finally {
        this.initializationPromise = null;
      }
    });

    return this.initializationPromise;
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.camera) {
        this.camera.stop();
        this.camera = null;
      }
      // Ne touche pas à this.faceMeshForVideo ici !
      this.isInitialized = false;
      this.fallbackMode = false;
      this.lastFaceLandmarks = null;
      this.faceDetection$.next(false);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  private drawFaceMesh(results: any): void {
    if (!this.canvasCtx || !this.canvasElement || !this.videoElement) return;
    try {
      this.canvasCtx.save();
      this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        this.lastFaceLandmarks = results.multiFaceLandmarks[0];
        this.faceDetection$.next(true);
      } else {
        this.lastFaceLandmarks = null;
        this.faceDetection$.next(false);
      }
      this.canvasCtx.restore();
    } catch (error) {
      console.error('Error in drawFaceMesh:', error);
      this.faceDetection$.next(false);
    }
  }

  getFaceDetectionStatus(): Observable<boolean> {
    return this.faceDetection$.asObservable();
  }

  async stop(): Promise<void> {
    await this.cleanup();
  }

  getFaceLandmarks(): any | null {
    return this.lastFaceLandmarks;
  }

  getCanvasContext(): CanvasRenderingContext2D | null {
    return this.canvasCtx;
  }

  getCanvasElement(): HTMLCanvasElement | null {
    return this.canvasElement;
  }

  isReady(): boolean {
    return this.isInitialized && (this.faceMeshForVideo !== null || this.fallbackMode);
  }

  isInFallbackMode(): boolean {
    return this.fallbackMode;
  }

  private async initializeImageProcessor(): Promise<void> {
    if (this.faceMeshForImage) return;
    
    const MEDIAPIPE_VERSION = '0.4.1633559619';
    this.faceMeshForImage = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${MEDIAPIPE_VERSION}/${file}`,
    });

    this.faceMeshForImage.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    await this.faceMeshForImage.initialize();
  }

  public async detectOnImage(imageElement: HTMLImageElement): Promise<any> {
      await this.initializeImageProcessor();
      return new Promise(async (resolve) => {
          this.faceMeshForImage!.onResults((results) => {
              resolve(results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0 ? results.multiFaceLandmarks[0] : null);
          });
          await this.faceMeshForImage!.send({ image: imageElement });
      });
  }
}