import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { PageGlasses } from '../classes/page-glasses';
import {Glasses} from '../classes/glasses';
import { FiltresLunetteDTO } from '../classes/filtres-lunette-dto';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VirtualGlassesService {

  private baseUrl=`${environment.apiUrl}/lunettes`;

  constructor(private httpClient:HttpClient) { }
  getGlasses(page: number, size: number): Observable<PageGlasses> {
    return this.httpClient.get<PageGlasses>(`${this.baseUrl}/pageOperations?page=${page}&size=${size}`);
  }
  getGlassesList(): Observable<Glasses[]> {
    return this.httpClient.get<Glasses[]>(`${this.baseUrl}/listeLunette`);
  }
  addLike(lunetteId: number): Observable<Glasses> {
    return this.httpClient.post<Glasses>(`${this.baseUrl}/${lunetteId}/like`, {});
  }

  removeLike(lunetteId: number): Observable<Glasses> {
    return this.httpClient.post<Glasses>(`${this.baseUrl}/${lunetteId}/unlike`, {});
  }
  getGlassesSelonCategorie(page: number, size: number): Observable<PageGlasses> {
    return this.httpClient.get<PageGlasses>(`${this.baseUrl}/categorie?page=${page}&size=${size}`);
  }
  filteredGlassesPage = signal<PageGlasses | null>(null);
  currentFiltres = signal<FiltresLunetteDTO | null>(null);
  filteredGlasses = signal<Glasses[]>([]);

  searchGlasses(filtres: FiltresLunetteDTO, page: number, size: number): Observable<PageGlasses> {
  this.currentFiltres.set(filtres);
  return this.httpClient.post<PageGlasses>(`${this.baseUrl}/search?page=${page}&size=${size}`, filtres);
}

  hasActiveFilters(): boolean {
  return this.filteredGlassesPage() !== null;
}


}
