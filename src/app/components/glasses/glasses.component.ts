import { Component, effect, ElementRef, ViewChild } from '@angular/core';
import { SideBarComponent } from "../side-bar/side-bar.component";
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { VirtualGlassesService } from '../../services/virtual-glasses.service';
import { PageGlasses } from '../../classes/page-glasses';
import { VirtualGlassesComponent } from "../virtual-glasses/virtual-glasses.component";


@Component({
  selector: 'app-glasses',
  imports: [SideBarComponent, CommonModule, ReactiveFormsModule, VirtualGlassesComponent],
  templateUrl: './glasses.component.html',
  standalone:true,
  styleUrl: './glasses.component.css'
})
export class GlassesComponent {
  lunettes !:any[];
  errorMessage !:string;
  currentPage:number=0;
  pageSize:number=4;
  totalPages!:number;
  selectedGlass: any = null;
  showVirtualTryOn = false ;  
  constructor(private lunetteService: VirtualGlassesService) {
    effect(() => {
      const pageResult = this.lunetteService.filteredGlassesPage();
      if (pageResult) {
        this.lunettes = pageResult.content;
        this.totalPages = pageResult.totalPages;
        console.log('Lunettes filtrées:', this.lunettes);
      } else {
        this.lunettes = [];
        this.totalPages = 0;
      }
    });
  }
  ngOnInit() {
    if (!this.lunetteService.hasActiveFilters()) {
    this.getGlasses(); // appel normal sans filtres
  }
  }
  getGlasses() {
    this.lunetteService.getGlasses(this.currentPage, this.pageSize).subscribe({
      next: (res: PageGlasses) => {
        this.lunettes = res.content;
        this.totalPages = res.totalPages;
      },
      error: (err) => {
        this.errorMessage = err.message || 'Erreur de chargement';
      }
    });
  }
  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
    this.currentPage = page;

    // Requête selon mode actif : normal ou filtré
    if (this.lunetteService.hasActiveFilters()) {
      const filtres = this.lunetteService.currentFiltres();
      if (filtres) {
        this.lunetteService.searchGlasses(filtres, page, this.pageSize)
          .subscribe(res => {
            this.lunettes = res.content;
            this.totalPages = res.totalPages;
          });
      }
    } else {
      this.getGlasses(); // chargement normal sans filtre
    }
  }
  }
  tryGlasses(glass: any) // Changed from Glasses to any
  {
    this.selectedGlass = glass;
    this.showVirtualTryOn = true;
  }
  viewDetails(glass: any) // Changed from Glasses to any
  {

  }
  toggleLike(glass: any): void {
  glass.liked = !glass.liked;
  if (glass.liked) {
    this.lunetteService.addLike(glass.id!).subscribe({
      next: (res) => {
        console.log('Like added:', res);
      },
      error: (err) => {
        console.error('Error adding like:', err);
        glass.liked = false; // Revert the like state on error
      }
    });
  } else {
    this.lunetteService.removeLike(glass.id!).subscribe({
      next: (res) => {
        console.log('Like removed:', res);
      },
      error: (err) => {
        console.error('Error removing like:', err);
        glass.liked = true; // Revert the like state on error
      }
    });
  }
}
 
}
