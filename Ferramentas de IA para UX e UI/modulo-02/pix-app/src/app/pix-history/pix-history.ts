import { Component, signal } from '@angular/core';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: 'received' | 'sent';
  date: string;
}

@Component({
  selector: 'app-pix-history',
  standalone: true,
  imports: [],
  templateUrl: './pix-history.html',
  styleUrl: './pix-history.css',
})
export class PixHistoryComponent {
  // Signal reativo contendo o mock de 3 transações conforme diretrizes
  readonly transactions = signal<Transaction[]>([
    {
      id: 'tx-1',
      title: 'Pix recebido - Erick S.',
      amount: 500.0,
      type: 'received',
      date: '14 de Março, 14:30',
    },
    {
      id: 'tx-2',
      title: 'Transferência enviada - Pagamentos S/A',
      amount: 150.0,
      type: 'sent',
      date: '13 de Março, 09:15',
    },
    {
      id: 'tx-3',
      title: 'Pix recebido - Loja Central',
      amount: 1250.0,
      type: 'received',
      date: '12 de Março, 18:45',
    },
  ]);

  readonly reportGenerated = signal<boolean>(false);

  formatAmount(amount: number, type: 'received' | 'sent'): string {
    const prefix = type === 'received' ? '+ R$' : '- R$';
    const formatted = amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${prefix} ${formatted}`;
  }

  generateReport(): void {
    this.reportGenerated.set(true);
    setTimeout(() => {
      this.reportGenerated.set(false);
    }, 2500);
  }
}

export { PixHistoryComponent as PixHistory };
