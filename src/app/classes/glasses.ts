export class Glasses {
    id?: number;
  nom!: string;
  couleur!: string;
  forme!: string;
  matiere!: string;
  montage!: string;
  imageUrl?: string;
  marqueId!: number;
  categorie?: string;
  prix!: number;
  liked: boolean = false;
  model3DPath?: string;
}
