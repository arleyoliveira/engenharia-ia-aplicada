import { Component, computed, signal } from '@angular/core';
import { ErroModal } from '../erro-modal/erro-modal';
import { PixReceiptComponent } from '../pix-receipt/pix-receipt';

@Component({
  selector: 'app-pix-transferer',
  standalone: true,
  imports: [ErroModal, PixReceiptComponent],
  templateUrl: './pix-transferer.html',
  styleUrl: './pix-transferer.css',
})
export class PixTransfererComponent {
  readonly pixKey = signal('');
  readonly amount = signal('');
  readonly scheduledDate = signal('');
  readonly isSubmitted = signal(false);

  readonly showErrorModal = signal(false);
  readonly errorTitle = signal('Limite Excedido');
  readonly errorMessage = signal(
    'Para sua segurança, transferências Pix acima de R$5.000,00 precisam ser aprovadas pelo o gerante.'
  );

  readonly formattedAmount = computed(() => {
    const raw = this.amount().trim().replace(',', '.');
    const numeric = parseFloat(raw);
    if (isNaN(numeric)) {
      return this.amount();
    }
    return numeric.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  });

  readonly receiptDate = computed(() => {
    if (this.scheduledDate()) {
      const [year, month, day] = this.scheduledDate().split('-');
      if (year && month && day) {
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        return `Agendado para ${date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}`;
      }
      return `Agendado para ${this.scheduledDate()}`;
    }
    const now = new Date();
    return (
      now.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }) +
      ' às ' +
      now.toLocaleTimeString('pt-BR')
    );
  });

  readonly modalidade = computed(() =>
    this.scheduledDate() ? 'PIX Agendado' : 'PIX Transferência Instantânea'
  );

  onPixKeyChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.pixKey.set(input.value);
  }

  onAmountChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.amount.set(input.value);
  }

  onScheduledDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.scheduledDate.set(input.value);
  }

  confirmTransfer(event: Event): void {
    event.preventDefault();

    const raw = this.amount().trim().replace(',', '.');
    const numericAmount = parseFloat(raw);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return;
    }

    if (numericAmount > 5000) {
      this.isSubmitted.set(false);
      this.showErrorModal.set(true);
      return;
    }

    this.showErrorModal.set(false);
    this.isSubmitted.set(true);
  }

  resetTransfer(): void {
    this.isSubmitted.set(false);
    this.pixKey.set('');
    this.amount.set('');
    this.scheduledDate.set('');
  }

  closeErrorModal(): void {
    this.showErrorModal.set(false);
  }
}

export { PixTransfererComponent as PixTransferer };
export { PixTransfererComponent as PixTranferComponent };

