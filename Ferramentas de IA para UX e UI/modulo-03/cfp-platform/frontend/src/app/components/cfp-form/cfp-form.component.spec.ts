import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { CfpFormComponent } from './cfp-form.component';
import { CfpService } from '../../services/cfp.service';
import { SpeakerDTO } from '@cfp-platform/shared-types';

describe('CfpFormComponent', () => {
  let component: CfpFormComponent;
  let fixture: ComponentFixture<CfpFormComponent>;
  let submitSpeakerSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    submitSpeakerSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [CfpFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CfpService,
          useValue: {
            submitSpeaker: submitSpeakerSpy
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CfpFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize Signals with empty/initial values', () => {
    expect(component.nome()).toBe('');
    expect(component.email()).toBe('');
    expect(component.talkTitle()).toBe('');
    expect(component.isGDE()).toBe(false);
    expect(component.isSubmitting()).toBe(false);
    expect(component.submitSuccess()).toBe(false);
    expect(component.errorMessage()).toBeNull();
    expect(component.isFormValid()).toBe(false);
  });

  it('should strictly keep the submit button disabled initially', () => {
    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton).toBeTruthy();
    expect(submitButton.disabled).toBe(true);
    expect(submitButton.getAttribute('aria-disabled')).toBe('true');
  });

  it('should enable the submit button when Signals correspond to a valid form', () => {
    component.nome.set('Ada Lovelace');
    component.email.set('ada@example.com');
    component.talkTitle.set('The Analytical Engine and Angular Signals');
    fixture.detectChanges();

    expect(component.isFormValid()).toBe(true);
    expect(component.isButtonDisabled()).toBe(false);

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);
    expect(submitButton.getAttribute('aria-disabled')).toBe('false');
  });

  it('should remain disabled if email is invalid', () => {
    component.nome.set('Ada Lovelace');
    component.email.set('invalid-email');
    component.talkTitle.set('Title');
    fixture.detectChanges();

    expect(component.isEmailValid()).toBe(false);
    expect(component.isFormValid()).toBe(false);

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it('should show aria-invalid and aria-describedby when a field is touched and invalid', () => {
    component.nomeTouched.set(true);
    fixture.detectChanges();

    const nomeInput = fixture.nativeElement.querySelector('#nome') as HTMLInputElement;
    expect(nomeInput.getAttribute('aria-invalid')).toBe('true');
    expect(nomeInput.getAttribute('aria-describedby')).toBe('nome-error');

    const errorSpan = fixture.nativeElement.querySelector('#nome-error');
    expect(errorSpan).toBeTruthy();
  });

  it('should submit successfully and reset form upon submission', () => {
    const mockCreatedSpeaker: SpeakerDTO = {
      id: 'mock-uuid-123',
      nome: 'Ada Lovelace',
      email: 'ada@example.com',
      talkTitle: 'The Analytical Engine',
      isGDE: true
    };
    submitSpeakerSpy.mockReturnValue(of(mockCreatedSpeaker));

    component.nome.set('Ada Lovelace');
    component.email.set('ada@example.com');
    component.talkTitle.set('The Analytical Engine');
    component.isGDE.set(true);
    fixture.detectChanges();

    component.onSubmit();
    fixture.detectChanges();

    expect(submitSpeakerSpy).toHaveBeenCalledWith({
      nome: 'Ada Lovelace',
      email: 'ada@example.com',
      talkTitle: 'The Analytical Engine',
      isGDE: true
    });
    expect(component.submitSuccess()).toBe(true);
    expect(component.submittedSpeaker()).toEqual(mockCreatedSpeaker);
    expect(component.nome()).toBe('');
  });

  it('should handle submission error and set errorMessage Signal', () => {
    submitSpeakerSpy.mockReturnValue(
      throwError(() => ({ error: { message: 'Falha no servidor' } }))
    );

    component.nome.set('Ada Lovelace');
    component.email.set('ada@example.com');
    component.talkTitle.set('The Analytical Engine');
    fixture.detectChanges();

    component.onSubmit();
    fixture.detectChanges();

    expect(component.isSubmitting()).toBe(false);
    expect(component.submitSuccess()).toBe(false);
    expect(component.errorMessage()).toBe('Falha no servidor');
  });
});
