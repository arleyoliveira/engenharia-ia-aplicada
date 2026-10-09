import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Pix App');
  });

  it('should allow user to toggle and select themes', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.setTheme('dark');
    expect(app.currentTheme()).toBe('dark');

    app.setTheme('light');
    expect(app.currentTheme()).toBe('light');

    app.toggleTheme();
    expect(app.currentTheme()).toBe('dark');
  });
});
