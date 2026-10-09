import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly platformId = inject(PLATFORM_ID);
  readonly currentTheme = signal<'light' | 'dark'>('light');
  readonly isMenuOpen = signal<boolean>(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('pix_theme') as 'light' | 'dark' | null;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        this.setTheme(savedTheme);
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        this.setTheme('dark');
      } else {
        this.setTheme('light');
      }
    }
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.currentTheme.set(theme);
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('pix_theme', theme);
    }
  }

  toggleTheme(): void {
    const nextTheme = this.currentTheme() === 'light' ? 'dark' : 'light';
    this.setTheme(nextTheme);
  }

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }
}

export { App as AppComponent };
