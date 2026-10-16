import { Component, OnInit, inject, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SpeakerDTO } from '@cfp-platform/shared-types';

@Component({
  selector: 'app-cfp-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cfp-dashboard.component.html',
  styleUrl: './cfp-dashboard.component.css'
})
export class CfpDashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/speakers';

  // State managed via Signals
  readonly speakers: WritableSignal<SpeakerDTO[]> = signal<SpeakerDTO[]>([]);
  readonly isLoading: WritableSignal<boolean> = signal<boolean>(true);
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  ngOnInit(): void {
    this.fetchSpeakers();
  }

  fetchSpeakers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.http.get<SpeakerDTO[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.speakers.set(data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg =
          err?.error?.message ||
          (Array.isArray(err?.error?.message)
            ? err.error.message.join(', ')
            : 'Erro ao carregar palestras submetidas. Verifique a conexão com o servidor.');
        this.errorMessage.set(msg);
      }
    });
  }
}
