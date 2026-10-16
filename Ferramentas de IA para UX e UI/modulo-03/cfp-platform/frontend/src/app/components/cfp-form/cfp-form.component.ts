import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CfpService } from '../../services/cfp.service';
import { SpeakerDTO } from '@cfp-platform/shared-types';

@Component({
  selector: 'app-cfp-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cfp-form.component.html',
  styleUrl: './cfp-form.component.css'
})
export class CfpFormComponent {
  private readonly cfpService = inject(CfpService);

  // Field values managed via Signals
  readonly nome = signal<string>('');
  readonly email = signal<string>('');
  readonly talkTitle = signal<string>('');
  readonly isGDE = signal<boolean>(false);

  // Touched states for user interaction / accessibility feedback
  readonly nomeTouched = signal<boolean>(false);
  readonly emailTouched = signal<boolean>(false);
  readonly talkTitleTouched = signal<boolean>(false);

  // Submission lifecycle status Signals
  readonly isSubmitting = signal<boolean>(false);
  readonly submitSuccess = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly submittedSpeaker = signal<SpeakerDTO | null>(null);

  // Computed field validations
  readonly isNomeValid = computed(() => this.nome().trim().length > 0);
  readonly isEmailValid = computed(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.email().trim());
  });
  readonly isTalkTitleValid = computed(() => this.talkTitle().trim().length > 0);

  // Computed form validity
  readonly isFormValid = computed(
    () => this.isNomeValid() && this.isEmailValid() && this.isTalkTitleValid()
  );

  // Computed submit button disabled state
  readonly isButtonDisabled = computed(
    () => !this.isFormValid() || this.isSubmitting()
  );

  onSubmit(): void {
    this.nomeTouched.set(true);
    this.emailTouched.set(true);
    this.talkTitleTouched.set(true);

    if (!this.isFormValid() || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.submitSuccess.set(false);

    const payload = {
      nome: this.nome().trim(),
      email: this.email().trim(),
      talkTitle: this.talkTitle().trim(),
      isGDE: this.isGDE()
    };

    this.cfpService.submitSpeaker(payload).subscribe({
      next: (createdSpeaker) => {
        this.isSubmitting.set(false);
        this.submitSuccess.set(true);
        this.submittedSpeaker.set(createdSpeaker);
        this.resetForm();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg =
          err?.error?.message ||
          (Array.isArray(err?.error?.message)
            ? err.error.message.join(', ')
            : 'Ocorreu um erro ao submeter a proposta. Tente novamente.');
        this.errorMessage.set(msg);
      }
    });
  }

  resetForm(): void {
    this.nome.set('');
    this.email.set('');
    this.talkTitle.set('');
    this.isGDE.set(false);
    this.nomeTouched.set(false);
    this.emailTouched.set(false);
    this.talkTitleTouched.set(false);
  }
}
