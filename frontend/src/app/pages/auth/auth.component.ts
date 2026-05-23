import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Component, OnDestroy, inject, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { UserService } from '../../services/user.service';

type AuthMode = 'login' | 'register';
type AuthControl = 'name' | 'email' | 'password' | 'confirmPassword' | 'acceptTerms';

interface AuthResponse {
  message: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css'
})
export class AuthComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly userService = inject(UserService);
  
  private morphTimer?: ReturnType<typeof setTimeout>;
  private readonly apiBaseUrl = this.resolveApiBaseUrl();

  mode: AuthMode = 'login';
  submitted = false;
  successMessage = '';
  errorMessage = '';
  isSubmitting = false;
  isMorphing = false;
  showPassword = false;
  showConfirmPassword = false;

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

  ngOnInit(): void {
    // Capturar tokens da URL (vindo do redirect da Steam)
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      const refresh = params['refresh'];
      
      if (token && refresh) {
        this.isSubmitting = true;
        localStorage.setItem('wealthsphere_access_token', token);
        localStorage.setItem('wealthsphere_refresh_token', refresh);
        
        // Buscar perfil do utilizador para completar o login
        this.userService.getProfile().subscribe({
          next: (res) => {
            localStorage.setItem('wealthsphere_user', JSON.stringify(res.profile));
            this.successMessage = `Login via Steam efetuado com sucesso!`;
            this.isSubmitting = false;
            setTimeout(() => {
              this.router.navigate(['/dashboard-user']);
            }, 1000);
          },
          error: () => {
            this.errorMessage = 'Erro ao sincronizar perfil da Steam.';
            this.isSubmitting = false;
          }
        });
      }
    });
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
    this.errorMessage = '';
    this.authForm.patchValue({ name: '', confirmPassword: '', acceptTerms: false });
    this.applyModeValidators();
    this.morphTimer = setTimeout(() => {
      this.isMorphing = false;
    }, 520);
  }

  loginWithSteam(): void {
    // Redirecionar para a rota de auth do backend
    window.location.href = `${this.apiBaseUrl}/auth/steam`;
  }

  togglePasswordVisibility(field: 'password' | 'confirmPassword'): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
      return;
    }

    this.showConfirmPassword = !this.showConfirmPassword;
  }

  submit(): void {
    this.submitted = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.authForm.updateValueAndValidity();

    if (this.authForm.invalid) {
      this.authForm.markAllAsTouched();
      return;
    }

    const value = this.authForm.getRawValue();

    if (!this.isRegister) {
      this.isSubmitting = true;
      this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/login`, {
        email: value.email,
        password: value.password
      }).subscribe({
        next: (response) => {
          localStorage.setItem('wealthsphere_access_token', response.tokens.accessToken);
          localStorage.setItem('wealthsphere_refresh_token', response.tokens.refreshToken);
          localStorage.setItem('wealthsphere_user', JSON.stringify(response.user));
          this.successMessage = `Bem-vindo de volta, ${response.user.name}!`;
          this.isSubmitting = false;
          setTimeout(() => {
            this.router.navigate(['/dashboard-user']);
          }, 1500);
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.getErrorMessage(error);
          this.isSubmitting = false;
        }
      });
      return;
    }

    const payload = {
      name: value.name,
      email: value.email,
      password: value.password
    };

    this.isSubmitting = true;
    this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/register`, payload).subscribe({
      next: (response) => {
        localStorage.setItem('wealthsphere_access_token', response.tokens.accessToken);
        localStorage.setItem('wealthsphere_refresh_token', response.tokens.refreshToken);
        localStorage.setItem('wealthsphere_user', JSON.stringify(response.user));
        this.successMessage = `Conta criada com sucesso. Bem-vindo, ${response.user.name}!`;
        this.isSubmitting = false;
        setTimeout(() => {
          this.router.navigate(['/dashboard-user']);
        }, 1500);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage = this.getErrorMessage(error);
        this.isSubmitting = false;
      }
    });
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


  private resolveApiBaseUrl(): string {
    const configuredUrl = localStorage.getItem('wealthsphere_api_url')?.trim();

    if (configuredUrl) {
      return configuredUrl.replace(/\/$/, '');
    }

    return environment.apiUrl;
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return `Não consegui ligar ao backend. Confirma se o servidor em ${environment.apiUrl} está ativo.`;
    }

    if (typeof error.error?.message === 'string') {
      return error.error.message;
    }

    return 'O registo falhou. Tenta novamente daqui a pouco.';
  }

  ngOnDestroy(): void {
    clearTimeout(this.morphTimer);
  }
}
