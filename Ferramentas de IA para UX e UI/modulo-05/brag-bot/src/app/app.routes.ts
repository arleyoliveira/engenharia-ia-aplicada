import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { DetailComponent } from './pages/detail/detail.component';

export const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    title: 'Brag-Bot | Dashboard BTG Pactual • Pós IA'
  },
  {
    path: 'detail/:id',
    component: DetailComponent,
    title: 'Brag-Bot | Detalhes da Conquista • BTG Pactual'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
