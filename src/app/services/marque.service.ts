import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Marque } from '../classes/marque';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ModelService {

  private baseUrl=`${environment.apiUrl}/marques`;
  constructor(private httpClient:HttpClient) { }
  getMarques(): Observable<Marque[]> {
    return this.httpClient.get<Marque[]>(`${this.baseUrl}`);
  }

}
