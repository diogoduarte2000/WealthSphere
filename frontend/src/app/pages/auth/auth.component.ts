import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { RouterLink } from '@angular/router';

type AuthMode = 'login' | 'register';
type AuthControl = 'name' | 'email' | 'password' | 'confirmPassword' | 'acceptTerms';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css'
})
export class AuthComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private morphTimer?: ReturnType<typeof setTimeout>;

  mode: AuthMode = 'login';
  submitted = false;
  successMessage = '';
  isMorphing = false;

  readonly authForm = this.fb.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: [''],
    remember: [true],
    acceptTerms: [false]
  }, { validators: this.passwordMatchValidator() });

  constructor() {
    this.applyModeValidators();
  }

  get isRegister(): boolean {
    return this.mode === 'register';
  }

  setMode(mode: AuthMode): void {
    if (this.mode === mode) {
      return;
    }

    this.isMorphing = true;
    clearTimeout(this.morphTimer);
    this.mode = mode;
    this.submitted = false;
    this.successMessage = '';
    this.authForm.patchValue({ name: '', confirmPassword: '', acceptTerms: false });
    this.applyModeValidators();
    this.morphTimer = setTimeout(() => {
      this.isMorphing = false;
    }, 520);
  }

  submit(): void {
    this.submitted = true;
    this.successMessage = '';
    this.authForm.updateValueAndValidity();

    if (this.authForm.invalid) {
      this.authForm.markAllAsTouched();
      return;
    }

    const value = this.authForm.getRawValue();
    const payload = {
      mode: this.mode,
      name: this.isRegister ? value.name : undefined,
      email: value.email,
      password: value.password,
      remember: value.remember
    };

    console.info('Auth payload ready for API integration:', payload);
    this.successMessage = this.isRegister
      ? 'Conta validada no frontend. Falta ligar ao endpoint de registo.'
      : 'Login validado no frontend. Falta ligar ao endpoint de sessão.';
  }

  isInvalid(controlName: AuthControl): boolean {
    const control = this.authForm.get(controlName);
    return !!control && control.invalid && (control.touched || this.submitted);
  }

  hasPasswordMismatch(): boolean {
    const confirm = this.authForm.get('confirmPassword');
    return this.isRegister
      && this.authForm.hasError('passwordMismatch')
      && !!confirm
      && (confirm.touched || this.submitted);
  }

  private applyModeValidators(): void {
    const name = this.authForm.get('name');
    const confirmPassword = this.authForm.get('confirmPassword');
    const acceptTerms = this.authForm.get('acceptTerms');

    if (this.isRegister) {
      name?.setValidators([Validators.required, Validators.minLength(2)]);
      confirmPassword?.setValidators([Validators.required]);
      acceptTerms?.setValidators([Validators.requiredTrue]);
    } else {
      name?.clearValidators();
      confirmPassword?.clearValidators();
      acceptTerms?.clearValidators();
    }

    name?.updateValueAndValidity({ emitEvent: false });
    confirmPassword?.updateValueAndValidity({ emitEvent: false });
    acceptTerms?.updateValueAndValidity({ emitEvent: false });
    this.authForm.updateValueAndValidity({ emitEvent: false });
  }

  private passwordMatchValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!this.isRegister) {
        return null;
      }

      const password = control.get('password')?.value;
      const confirmPassword = control.get('confirmPassword')?.value;

      return password && confirmPassword && password !== confirmPassword
        ? { passwordMismatch: true }
        : null;
    };
  }

  ngOnDestroy(): void {
    clearTimeout(this.morphTimer);
  }
}
