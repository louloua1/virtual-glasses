import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SideBarService {

  private baseUrl=`${environment.apiUrl}/enums`;
  constructor(private httpClient:HttpClient) { }
  getFormes(): Observable<string[]> {
    return this.httpClient.get<string[]>(`${this.baseUrl}/forme`);
  }

  getMatieres(): Observable<string[]> {
    return this.httpClient.get<string[]>(`${this.baseUrl}/matiere`);
  }

  getMontages(): Observable<string[]> {
    return this.httpClient.get<string[]>(`${this.baseUrl}/montage`);
  }

  getCouleurs(): Observable<string[]> {
    return this.httpClient.get<string[]>(`${this.baseUrl}/couleur`);
  }
  getGenre(): Observable<string[]> {
    return this.httpClient.get<string[]>(`${this.baseUrl}/genre`);
  }
  getCategorie(): Observable<string[]> {
    return this.httpClient.get<string[]>(`${this.baseUrl}/categorie`);
  }
}
