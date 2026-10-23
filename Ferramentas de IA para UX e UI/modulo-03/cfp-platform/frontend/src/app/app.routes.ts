import { Route } from '@angular/router';
import { CfpFormComponent } from './components/cfp-form/cfp-form.component';
import { CfpDashboardComponent } from './components/cfp-dashboard/cfp-dashboard.component';
import { EventFormComponent } from './components/event-form/event-form.component';

export const appRoutes: Route[] = [
  { path: '', redirectTo: 'event/new', pathMatch: 'full' },
  { path: 'event/new', component: EventFormComponent },
  { path: 'talks/new', component: CfpFormComponent },
  { path: 'dashboard', component: CfpDashboardComponent },
  { path: '**', redirectTo: 'event/new' },
];
