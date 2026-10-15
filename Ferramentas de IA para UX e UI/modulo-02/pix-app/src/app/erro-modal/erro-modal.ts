import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  PLATFORM_ID,
  ViewChild,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-erro-modal',
  standalone: true,
  imports: [],
  templateUrl: './erro-modal.html',
  styleUrl: './erro-modal.css',
})
export class ErroModal {
  private readonly platformId = inject(PLATFORM_ID);

  @Input() title: string = '';
  @Input() message: string = '';

  @Input()
  set isOpen(value: boolean) {
    this.isVisible.set(value);
    if (value) {
      this.handleOpen();
    }
  }
  get isOpen(): boolean {
    return this.isVisible();
  }

  @Output() closed = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('modalDialog') modalDialog?: ElementRef<HTMLElement>;
  @ViewChild('primaryButton') primaryButton?: ElementRef<HTMLButtonElement>;

  readonly isVisible = signal(true);
  readonly titleId = 'erro-modal-title';
  readonly messageId = 'erro-modal-message';

  private previouslyFocusedElement: HTMLElement | null = null;

  constructor() {
    afterNextRender(() => {
      if (this.isVisible()) {
        this.captureAndFocus();
      }
    });
  }

  private handleOpen(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.captureAndFocus();
      }, 0);
    }
  }

  private captureAndFocus(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (document.activeElement instanceof HTMLElement) {
      this.previouslyFocusedElement = document.activeElement;
    }

    if (this.primaryButton) {
      this.primaryButton.nativeElement.focus();
    } else if (this.modalDialog) {
      this.modalDialog.nativeElement.focus();
    }
  }

  closeModal(): void {
    this.isVisible.set(false);
    this.closed.emit();
    this.close.emit();
    this.restorePreviousFocus();
  }

  private restorePreviousFocus(): void {
    if (isPlatformBrowser(this.platformId) && this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus();
      this.previouslyFocusedElement = null;
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event?: Event): void {
    if (this.isVisible()) {
      event?.preventDefault();
      this.closeModal();
    }
  }

  @HostListener('keydown', ['$event'])
  handleTabTrap(event: KeyboardEvent): void {
    if (!this.isVisible() || event.key !== 'Tab') return;

    const dialogEl = this.modalDialog?.nativeElement;
    if (!dialogEl) return;

    const focusableElements = dialogEl.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement || document.activeElement === dialogEl) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }
}

export { ErroModal as ErroModalComponent };
