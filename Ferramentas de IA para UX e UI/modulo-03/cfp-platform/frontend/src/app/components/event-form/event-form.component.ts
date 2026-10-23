import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EventService } from '../../services/event.service';
import { EventDTO } from '@cfp-platform/shared-types';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.css'
})
export class EventFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly eventService = inject(EventService);

  // Reactive Form initialization
  readonly eventForm = this.fb.group({
    nome: ['', [Validators.required]],
    endereco: ['', [Validators.required]],
    capacidade: [null as number | null, [Validators.required, Validators.min(1)]],
    data: ['', [Validators.required]],
  });

  // UI state managed via Signals
  readonly isSubmitting = signal<boolean>(false);
  readonly submitSuccess = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly submittedEvent = signal<EventDTO | null>(null);
  readonly formTouched = signal<boolean>(false);

  isFieldInvalid(fieldName: string): boolean {
    const control = this.eventForm.get(fieldName);
    return !!(control && control.invalid && (control.touched || this.formTouched()));
  }

  onSubmit(): void {
    this.formTouched.set(true);
    this.eventForm.markAllAsTouched();

    if (this.eventForm.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.submitSuccess.set(false);

    const formValue = this.eventForm.value;
    const payload = {
      nome: formValue.nome!.trim(),
      endereco: formValue.endereco!.trim(),
      capacidade: Number(formValue.capacidade),
      data: formValue.data!
    };

    this.eventService.createEvent(payload).subscribe({
      next: (createdEvent) => {
        this.isSubmitting.set(false);
        this.submitSuccess.set(true);
        this.submittedEvent.set(createdEvent);
        this.resetForm();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg =
          err?.error?.message ||
          (Array.isArray(err?.error?.message)
            ? err.error.message.join(', ')
            : 'Ocorreu um erro ao cadastrar o local do evento. Tente novamente.');
        this.errorMessage.set(msg);
      }
    });
  }

  resetForm(): void {
    this.eventForm.reset();
    this.formTouched.set(false);
  }
}
