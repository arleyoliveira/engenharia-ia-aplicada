import { Routes } from '@angular/router';
import { PixTransfererComponent } from './pix-transferer/pix-transferer';
import { PixReceiptComponent } from './pix-receipt/pix-receipt';
import { PixHistoryComponent } from './pix-history/pix-history';

export const routes: Routes = [
  {
    path: '',
    component: PixTransfererComponent,
  },
  {
    path: 'pix',
    component: PixTransfererComponent,
  },
  {
    path: 'comprovante',
    component: PixReceiptComponent,
  },
  {
    path: 'receipt',
    component: PixReceiptComponent,
  },
  {
    path: 'extrato',
    component: PixHistoryComponent,
  },
  {
    path: 'history',
    component: PixHistoryComponent,
  },
];

