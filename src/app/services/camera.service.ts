import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  private stream: MediaStream | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private _isCameraActive = false;
  public stream$ = new BehaviorSubject<MediaStream | null>(null);
  public isCameraActive$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  setCameraActive(value: boolean): void {
    this._isCameraActive = value;
    this.isCameraActive$.next(value); 
    //this.getVideoElement().play();
  }

  getCameraActive(): boolean {
    return this._isCameraActive;
  }

  async startCamera(videoElement: HTMLVideoElement): Promise<boolean> {
    try {
      console.log('Demande d\'accès caméra...');
      // if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      //   alert("L'accès à la caméra n'est pas supporté sur ce navigateur ou cette URL. Utilisez HTTPS ou localhost.");
      //   return false;
      // }
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
      console.log('Stream obtenu:', this.stream);
      videoElement.srcObject = this.stream;
  
      try {
        await videoElement.play();
        console.log('Video play lancée');
      } catch (playError) {
        console.error('Erreur lors de videoElement.play():', playError);
        return false;
      }
  
      this.stream$.next(this.stream);
      this.setCameraActive(true);
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'activation de la caméra:', error);
      return false;
    }
  }
  


  stopCamera(): void {
    if (this.stream) {
      const tracks = this.stream.getTracks();
      tracks.forEach(track => track.stop());
      this.stream = null;
      this.setCameraActive(false);
    }
  }

  async capturePhoto(videoElement: HTMLVideoElement): Promise<string | null> {
    if (!this._isCameraActive || !videoElement) return null;
  
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d')!;
    
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  }
  

  getVideoElement(): HTMLVideoElement {
    throw new Error('getVideoElement() is not implemented or needed');
  }

}
