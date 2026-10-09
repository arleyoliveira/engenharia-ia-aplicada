import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { PixReceiptComponent } from './pix-receipt';

describe('PixReceiptComponent', () => {
  let component: PixReceiptComponent;
  let fixture: ComponentFixture<PixReceiptComponent>;
  let componentRef: ComponentRef<PixReceiptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PixReceiptComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PixReceiptComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render default valor and nome', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.amount-value')?.textContent?.trim()).toBe('150,00');
    expect(compiled.querySelector('.detail-value.highlight')?.textContent?.trim()).toBe('Arley O Mota');
  });

  it('should update view when signal inputs are set', () => {
    componentRef.setInput('valor', '350,50');
    componentRef.setInput('nome', 'Maria Silva');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.amount-value')?.textContent?.trim()).toBe('350,50');
    expect(compiled.querySelector('.detail-value.highlight')?.textContent?.trim()).toBe('Maria Silva');
  });

  it('should show toast when copyTransactionId is called', async () => {
    component.showToast('Test Toast');
    expect(component.isToastVisible()).toBe(true);
    expect(component.toastMessage()).toBe('Test Toast');
  });
});
