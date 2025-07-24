import { Component } from '@angular/core';
import { Glasses } from '../../classes/glasses';
import { VirtualGlassesComponent } from '../virtual-glasses/virtual-glasses.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VirtualGlassesService } from '../../services/virtual-glasses.service';

@Component({
  selector: 'app-essayage',
  imports: [VirtualGlassesComponent,CommonModule,FormsModule],
  templateUrl: './essayage.component.html',
  styleUrl: './essayage.component.scss'
})
export class EssayageComponent {
  selectedGlass: Glasses | null = null;
showVirtualTryOn = false; 
  currentPage:number=0;
  pageSize:number=4;
  totalPages!:number;
  errorMessage !:string;
  constructor(private lunetteService: VirtualGlassesService) {}
glassesList: Glasses[] = [];

ngOnInit() {
  // Charger la liste des lunettes
  this.lunetteService.getGlassesList().subscribe(
    (res: Glasses[]) => this.glassesList = res
  );
  // selectedGlass reste null au début
}

onSelectGlass(glass: Glasses) {
  this.selectedGlass = glass;
}
  onStartTryOn(glass: Glasses|null) {
    this.selectedGlass = glass;
    console.log('aaaa'+this.selectedGlass);
  this.showVirtualTryOn = true;
   
  }
  // essayage.component.ts
  scrollToSection() {
    const el = document.getElementById('cards-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
}

}
