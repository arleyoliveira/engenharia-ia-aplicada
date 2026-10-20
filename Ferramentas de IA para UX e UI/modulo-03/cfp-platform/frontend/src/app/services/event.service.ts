import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EventDTO } from '@cfp-platform/shared-types';

export type CreateEventPayload = Omit<EventDTO, 'id'> & { id?: string };

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/events';

  createEvent(event: CreateEventPayload): Observable<EventDTO> {
    return this.http.post<EventDTO>(this.apiUrl, event);
  }

  getEvents(): Observable<EventDTO[]> {
    return this.http.get<EventDTO[]>(this.apiUrl);
  }
}
