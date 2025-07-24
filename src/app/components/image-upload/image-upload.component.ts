import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-image-upload',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './image-upload.component.html',
  styleUrls: ['./image-upload.component.scss']
})
export class ImageUploadComponent {
  videoUrl?: string;
  loading = false;

  async animateImage(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.loading = true;

    // 1)  Clé D-ID  (username:password)
    const username = 'Y2hhaW1ha2hhcnJhdDZAZ21haWwuY29t';
    const password = 'C7g0zheDFl-IIRJaxZiCQ';

    // 2) Convertir en base64
    const base64 = await this.fileToBase64(file);

    // 3) Appel API
    const res = await fetch('https://api.d-id.com/v1/talks', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${username}:${password}`),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_url: base64,
        script: {
          type: 'text',
          input: 'Hello, I am your animated avatar!'
        }
      })
    });

    if (!res.ok) {
      console.error('Erreur API', res.status, await res.text());
      this.loading = false;
      return;
    }

    const data = await res.json();
    this.videoUrl = data.result_url; // MP4 généré
    this.loading = false;
  }

  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}