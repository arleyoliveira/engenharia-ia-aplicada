import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(appRoutes)
      ]
    }).compileComponents();
  });

  it('should render the router outlet and default route', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should render the exact 3 required navigation links', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const eventLink = compiled.querySelector('a[routerLink="/event/new"]');
    const talksLink = compiled.querySelector('a[routerLink="/talks/new"]');
    const dashboardLink = compiled.querySelector('a[routerLink="/dashboard"]');

    expect(eventLink).toBeTruthy();
    expect(eventLink?.textContent?.trim()).toBe('Cadastro de Evento');

    expect(talksLink).toBeTruthy();
    expect(talksLink?.textContent?.trim()).toBe('Cadastro de Palestra');

    expect(dashboardLink).toBeTruthy();
    expect(dashboardLink?.textContent?.trim()).toBe('Dashboard');
  });
});
