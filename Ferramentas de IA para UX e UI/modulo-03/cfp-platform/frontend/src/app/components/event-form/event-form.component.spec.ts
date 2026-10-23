import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { EventFormComponent } from './event-form.component';
import { EventService } from '../../services/event.service';
import { EventDTO } from '@cfp-platform/shared-types';

describe('EventFormComponent', () => {
  let component: EventFormComponent;
  let fixture: ComponentFixture<EventFormComponent>;
  let createEventSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createEventSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [EventFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: EventService,
          useValue: {
            createEvent: createEventSpy
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EventFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize Reactive Form with empty controls and Signals with default values', () => {
    expect(component.eventForm.get('nome')?.value).toBe('');
    expect(component.eventForm.get('endereco')?.value).toBe('');
    expect(component.eventForm.get('capacidade')?.value).toBeNull();
    expect(component.eventForm.get('data')?.value).toBe('');

    expect(component.isSubmitting()).toBe(false);
    expect(component.submitSuccess()).toBe(false);
    expect(component.errorMessage()).toBeNull();
  });

  it('should mark fields as invalid on submit when empty', () => {
    component.onSubmit();
    fixture.detectChanges();

    expect(component.eventForm.invalid).toBe(true);
    expect(component.isFieldInvalid('nome')).toBe(true);
    expect(component.isFieldInvalid('endereco')).toBe(true);
    expect(component.isFieldInvalid('capacidade')).toBe(true);
    expect(component.isFieldInvalid('data')).toBe(true);
  });

  it('should submit successfully when form is valid', () => {
    const mockCreatedEvent: EventDTO = {
      id: 'event-uuid-123',
      nome: 'Summit Tech 2026',
      endereco: 'Av. Paulista, 1000',
      capacidade: 500,
      data: '2026-11-20'
    };
    createEventSpy.mockReturnValue(of(mockCreatedEvent));

    component.eventForm.patchValue({
      nome: 'Summit Tech 2026',
      endereco: 'Av. Paulista, 1000',
      capacidade: 500,
      data: '2026-11-20'
    });
    fixture.detectChanges();

    component.onSubmit();
    fixture.detectChanges();

    expect(createEventSpy).toHaveBeenCalledWith({
      nome: 'Summit Tech 2026',
      endereco: 'Av. Paulista, 1000',
      capacidade: 500,
      data: '2026-11-20'
    });
    expect(component.submitSuccess()).toBe(true);
    expect(component.submittedEvent()).toEqual(mockCreatedEvent);
  });

  it('should handle submission error and set errorMessage Signal', () => {
    createEventSpy.mockReturnValue(
      throwError(() => ({ error: { message: 'Erro ao salvar evento' } }))
    );

    component.eventForm.patchValue({
      nome: 'Summit Tech 2026',
      endereco: 'Av. Paulista, 1000',
      capacidade: 500,
      data: '2026-11-20'
    });
    fixture.detectChanges();

    component.onSubmit();
    fixture.detectChanges();

    expect(component.isSubmitting()).toBe(false);
    expect(component.submitSuccess()).toBe(false);
    expect(component.errorMessage()).toBe('Erro ao salvar evento');
  });
});
