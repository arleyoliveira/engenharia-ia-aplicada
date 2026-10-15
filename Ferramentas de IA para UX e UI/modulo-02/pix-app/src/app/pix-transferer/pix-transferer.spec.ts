import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PixTransferer } from './pix-transferer';

describe('PixTransferer', () => {
  let component: PixTransferer;
  let fixture: ComponentFixture<PixTransferer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PixTransferer],
    }).compileComponents();

    fixture = TestBed.createComponent(PixTransferer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should submit transfer when amount is less than or equal to 5000', () => {
    component.amount.set('5000');
    component.pixKey.set('12345678900');
    const fakeEvent = new Event('submit');
    component.confirmTransfer(fakeEvent);

    expect(component.isSubmitted()).toBe(true);
    expect(component.showErrorModal()).toBe(false);
  });

  it('should show ErroModal when amount is greater than 5000', () => {
    component.amount.set('5000.01');
    component.pixKey.set('12345678900');
    const fakeEvent = new Event('submit');
    component.confirmTransfer(fakeEvent);

    expect(component.isSubmitted()).toBe(false);
    expect(component.showErrorModal()).toBe(true);
    expect(component.errorTitle()).toBe('Limite Excedido');
    expect(component.errorMessage()).toBe(
      'Para sua segurança, transferências Pix acima de R$5.000,00 precisam ser aprovadas pelo o gerante.'
    );
  });

  it('should close ErroModal when closeErrorModal is called', () => {
    component.showErrorModal.set(true);
    component.closeErrorModal();
    expect(component.showErrorModal()).toBe(false);
  });

  it('should not submit transfer when amount is invalid or zero', () => {
    component.amount.set('0');
    component.confirmTransfer(new Event('submit'));
    expect(component.isSubmitted()).toBe(false);

    component.amount.set('invalid');
    component.confirmTransfer(new Event('submit'));
    expect(component.isSubmitted()).toBe(false);
  });

  it('should render app-pix-receipt and hide the form when transfer is submitted', async () => {
    component.amount.set('250.50');
    component.pixKey.set('user@pix.com');
    component.confirmTransfer(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.pix-card')).toBeNull();
    expect(compiled.querySelector('app-pix-receipt')).not.toBeNull();
  });

  it('should reset transfer and show the form again when resetTransfer is called', async () => {
    component.amount.set('100');
    component.pixKey.set('123456');
    component.scheduledDate.set('2026-12-25');
    component.confirmTransfer(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isSubmitted()).toBe(true);

    component.resetTransfer();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isSubmitted()).toBe(false);
    expect(component.amount()).toBe('');
    expect(component.pixKey()).toBe('');
    expect(component.scheduledDate()).toBe('');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.pix-card')).not.toBeNull();
    expect(compiled.querySelector('app-pix-receipt')).toBeNull();
  });
});

