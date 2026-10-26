import { Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BragService } from '../../services/brag.service';
import { BragItem } from '../../models/brag.model';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './detail.component.html'
})
export class DetailComponent {
  private readonly bragService = inject(BragService);
  private readonly route = inject(ActivatedRoute);

  // Input router param caso withComponentInputBinding esteja habilitado
  readonly id = input<string>();

  // Feedback de cópia
  readonly copied = signal<boolean>(false);

  // ID resolvido priorizando o input e com fallback para ActivatedRoute
  readonly resolvedId = computed<string>(() => {
    return this.id() || this.route.snapshot.paramMap.get('id') || '';
  });

  // Conquista encontrada pelo ID
  readonly brag = computed<BragItem | undefined>(() => {
    const idVal = this.resolvedId();
    if (!idVal) return undefined;
    return this.bragService.getBragById(idVal);
  });

  async copyBragToClipboard(item: BragItem): Promise<void> {
    const textToCopy = `🏆 CONQUISTA: ${item.title}\n\n📌 CONTEXTO:\n${item.context}\n\n🚀 IMPACTO:\n${item.impact}\n\n📊 MÉTRICAS:\n${item.metrics}\n\n🛠️ TECNOLOGIAS:\n${item.technologies.join(', ')}`;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy);
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2500);
      }
    } catch {
      // Fallback silencioso
    }
  }
}
