import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SpeakerDTO } from '@cfp-platform/shared-types';

export type CreateSpeakerPayload = Omit<SpeakerDTO, 'id'> & { id?: string };

@Injectable({
  providedIn: 'root'
})
export class CfpService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/speakers';

  submitSpeaker(speaker: CreateSpeakerPayload): Observable<SpeakerDTO> {
    return this.http.post<SpeakerDTO>(this.apiUrl, speaker);
  }

  getSpeakers(): Observable<SpeakerDTO[]> {
    return this.http.get<SpeakerDTO[]>(this.apiUrl);
  }
}
