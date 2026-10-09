import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErroModal } from './erro-modal';

describe('ErroModal', () => {
  let component: ErroModal;
  let fixture: ComponentFixture<ErroModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErroModal],
    }).compileComponents();

    fixture = TestBed.createComponent(ErroModal);
    component = fixture.componentInstance;
    component.title = 'Erro de Validação';
    component.message = 'Chave Pix informada é inválida.';
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render title and message inputs', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.modal-title')?.textContent).toContain('Erro de Validação');
    expect(compiled.querySelector('.modal-message')?.textContent).toContain('Chave Pix informada é inválida.');
  });

  it('should close when close button is clicked', () => {
    let closedTriggered = false;
    component.closed.subscribe(() => {
      closedTriggered = true;
    });

    const closeButton = fixture.nativeElement.querySelector('.modal-action-btn') as HTMLButtonElement;
    closeButton.click();
    fixture.detectChanges();

    expect(component.isVisible()).toBe(false);
    expect(closedTriggered).toBe(true);
  });

  it('should close on ESC keydown event', () => {
    let closedTriggered = false;
    component.closed.subscribe(() => {
      closedTriggered = true;
    });

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);
    fixture.detectChanges();

    expect(component.isVisible()).toBe(false);
    expect(closedTriggered).toBe(true);
  });
});
