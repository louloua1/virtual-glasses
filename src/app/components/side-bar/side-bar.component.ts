import { CommonModule } from '@angular/common';
import { Component, effect, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SideBarService } from '../../services/side-bar.service';
import { ModelService } from '../../services/marque.service';
import { Marque } from '../../classes/marque';
import { FiltresLunetteDTO } from '../../classes/filtres-lunette-dto';
import { VirtualGlassesService } from '../../services/virtual-glasses.service';

@Component({
  selector: 'app-side-bar',
  imports: [CommonModule,ReactiveFormsModule],
  templateUrl: './side-bar.component.html',
  styleUrl: './side-bar.component.css'
})
export class SideBarComponent {
  // Données récupérées depuis les services
  genres = signal<string[]>([]);
  categories = signal<string[]>([]);
  formes = signal<string[]>([]);
  matieres = signal<string[]>([]);
  montages = signal<string[]>([]);
  couleurs = signal<string[]>(['#ff0000', '#00ff00', '#0000ff']);
  marques = signal<Marque[]>([]);
  currentPage:number=0;
  pageSize:number=4;

  // Sélections utilisateur
  selectedGenres = signal<string[]>([]);
  selectedCategories = signal<string[]>([]);
  selectedFormes = signal<string[]>([]);
  selectedMatieres = signal<string[]>([]);
  selectedMontages = signal<string[]>([]);
  selectedCouleurs = signal<string[]>([]);
  selectedMarques = signal<Marque[]>([]);

  constructor(private sideBarService: SideBarService,private modelService:ModelService,private glassesService:VirtualGlassesService) {
    // Exemple d'effet : log automatique
    effect(() => {
  const filtres: FiltresLunetteDTO = {
    genres: this.selectedGenres(),
    categories: this.selectedCategories(),
    formes: this.selectedFormes(),
    matieres: this.selectedMatieres(),
    montages: this.selectedMontages(),
    couleurs: this.selectedCouleurs(),
    marques: this.selectedMarques().map(m => m.id),
  };
  console.log('Filtres envoyés:', filtres);

  this.glassesService.searchGlasses(filtres, 0, 4).subscribe({
    next: (res) => {
      this.glassesService.filteredGlasses.set(res.content);       // les lunettes
      this.glassesService.filteredGlassesPage.set(res);           // toute la page
    },
    error: (err) => {
      console.error('Erreur recherche lunettes :', err);
      this.glassesService.filteredGlasses.set([]); // ou gérer autrement
    }
  });
});

  }

  ngOnInit(): void {
    this.sideBarService.getGenre().subscribe(data => this.genres.set(data));
    this.sideBarService.getCategorie().subscribe(data => this.categories.set(data));
    this.sideBarService.getFormes().subscribe(data => this.formes.set(data));
    this.sideBarService.getMatieres().subscribe(data => this.matieres.set(data));
    this.sideBarService.getMontages().subscribe(data => this.montages.set(data));
    this.sideBarService.getCouleurs().subscribe(data => this.couleurs.set(data));
    this.modelService.getMarques().subscribe(data => this.marques.set(data));
  }
  couleurToCssMap: { [key: string]: string } = {
  NOIR: 'black',
  BLANC: 'white',
  ROUGE: 'red',
  BLEU: 'blue',
  VERT: 'green',
  JAUNE: 'yellow',
  GRIS: 'gray',
  MARRON: '#8B4513', // marron en hex
  OR: 'gold',
  ARGENT: 'silver'
};

  toggle<T>(signalList: () => T[], setSignalList: (v: T[]) => void, value: T) {
    const current = signalList();
    setSignalList(current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]);
  }

  toggleGenre(genre: string) {
    this.toggle(this.selectedGenres, this.selectedGenres.set, genre);
  }

  toggleCategory(cat: string) {
    this.toggle(this.selectedCategories, this.selectedCategories.set, cat);
  }

  toggleForme(forme: string) {
    this.toggle(this.selectedFormes, this.selectedFormes.set, forme);
  }

  toggleMatiere(matiere: string) {
    this.toggle(this.selectedMatieres, this.selectedMatieres.set, matiere);
  }

  toggleMontage(montage: string) {
    this.toggle(this.selectedMontages, this.selectedMontages.set, montage);
  }

  toggleCouleur(couleur: string) {
    this.toggle(this.selectedCouleurs, this.selectedCouleurs.set, couleur);
  }

  toggleMarque(marque: Marque) {
  const current = this.selectedMarques();
  const exists = current.some(m => m.id === marque.id);

  this.selectedMarques.set(
    exists ? current.filter(m => m.id !== marque.id) : [...current, marque]
  );
}
  isMarqueSelected(marque: Marque): boolean {
  return this.selectedMarques().some(m => m.id === marque.id);
}

}


