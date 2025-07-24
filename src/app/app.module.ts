import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { VirtualGlassesComponent } from './components/virtual-glasses/virtual-glasses.component';

import { CameraService } from './services/camera.service';

@NgModule({
  declarations: [
  ],
  imports: [
  ],
  providers: [
    CameraService,
  ],
  bootstrap: []
})
export class AppModule { }
