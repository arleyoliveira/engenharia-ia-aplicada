import { Route } from '@angular/router';
import { CfpFormComponent } from './components/cfp-form/cfp-form.component';
import { CfpDashboardComponent } from './components/cfp-dashboard/cfp-dashboard.component';

export const appRoutes: Route[] = [
  { path: '', component: CfpFormComponent, pathMatch: 'full' },
  { path: 'dashboard', component: CfpDashboardComponent },
  { path: '**', redirectTo: '' },
];
