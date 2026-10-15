import {
  Component,
  PLATFORM_ID,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pix-receipt',
  standalone: true,
  imports: [],
  templateUrl: './pix-receipt.html',
  styleUrl: './pix-receipt.css',
})
export class PixReceiptComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router, { optional: true });

  // Input Signals (Angular 21+) para dados dinâmicos
  readonly valor = input<string>('150,00');
  readonly nome = input<string>('Arley O Mota');
  readonly cpf = input<string>('•••.459.802-••');
  readonly origem = input<string>('Lucas Albuquerque • Vélix S.A.');
  readonly instituicao = input<string>('FinTech Pagamentos S.A.');
  readonly dataHora = input<string>('18 de Outubro de 2024 às 14:32:05');
  readonly modalidade = input<string>('PIX Transferência Instantânea');
  readonly protocolo = input<string>('Protocolo #849.204.11');
  readonly idTransacao = input<string>('E18236120202410181432A90F84B02A7');
  readonly assinaturaDigital = input<string>('Assinado digitalmente por Vélix S.A.');

  // Outputs / Eventos
  readonly back = output<void>();
  readonly newTransfer = output<void>();
  readonly share = output<void>();
  readonly download = output<void>();

  // Estados reativos internos
  readonly isCopied = signal<boolean>(false);
  readonly toastMessage = signal<string>('');
  readonly isToastVisible = signal<boolean>(false);

  private toastTimeout: ReturnType<typeof setTimeout> | null = null;
  private copyTimeout: ReturnType<typeof setTimeout> | null = null;

  showToast(message: string): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.toastMessage.set(message);
    this.isToastVisible.set(true);

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      this.isToastVisible.set(false);
    }, 2800);
  }

  async copyTransactionId(): Promise<void> {
    const textToCopy = this.idTransacao();

    if (isPlatformBrowser(this.platformId) && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        this.isCopied.set(true);
        this.showToast('ID PIX copiado para a área de transferência');

        if (this.copyTimeout) {
          clearTimeout(this.copyTimeout);
        }

        this.copyTimeout = setTimeout(() => {
          this.isCopied.set(false);
        }, 2000);
        return;
      } catch {
        // Fallback em caso de erro no clipboard
      }
    }

    this.showToast('ID da transação selecionado para cópia');
  }

  async simulateShare(): Promise<void> {
    this.share.emit();

    if (isPlatformBrowser(this.platformId) && navigator.share) {
      try {
        await navigator.share({
          title: 'Comprovante PIX Vélix',
          text: `Comprovante de Transferência PIX de R$ ${this.valor()} para ${this.nome()}.`,
          url: window.location.href,
        });
        return;
      } catch {
        // Usuário cancelou o compartilhamento nativo
        return;
      }
    }

    if (isPlatformBrowser(this.platformId) && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(window.location.href);
        this.showToast('Link do comprovante copiado para compartilhamento!');
        return;
      } catch {
        // Fallback
      }
    }

    this.showToast('Comprovante pronto para compartilhamento!');
  }

  simulateDownload(): void {
    this.download.emit();
    this.showToast('Gerando PDF autenticado... O download iniciará em instantes.');

    if (isPlatformBrowser(this.platformId)) {
      // Simulação de impressão/PDF nativo
      setTimeout(() => {
        window.print();
      }, 600);
    }
  }

  handleBack(): void {
    this.back.emit();
    if (this.router) {
      this.router.navigate(['/']);
    } else if (isPlatformBrowser(this.platformId)) {
      window.history.back();
    }
  }

  handleNewTransfer(event: Event): void {
    event.preventDefault();
    this.newTransfer.emit();
    if (this.router) {
      this.router.navigate(['/']);
    }
  }
}

export { PixReceiptComponent as PixReceipt };
