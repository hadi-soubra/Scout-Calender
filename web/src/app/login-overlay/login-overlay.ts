import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { apiError } from '../services/api-error';

@Component({
  selector: 'app-login-overlay',
  imports: [FormsModule],
  template: `
    <form class="card" (ngSubmit)="submit()">
      <h1>Beirut 02 Calendar</h1>
      <p class="sub">Sign in with your unit account to continue.</p>
      <input name="email" type="email" autocomplete="username" placeholder="Email"
        [(ngModel)]="email" autofocus />
      <input name="password" type="password" autocomplete="current-password" placeholder="Password"
        [(ngModel)]="password" />
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      <button class="btn dark" type="submit" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
    </form>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 40;
      display: grid;
      place-items: center;
      padding: 16px;
    }

    .card {
      width: min(344px, 100%);
      padding: 1.35rem 1.35rem 1.4rem;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surface);
      box-shadow: var(--shadow-lg);
      display: grid;
      gap: 0.7rem;
    }

    h1 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
    }

    .sub {
      margin: -0.35rem 0 0.35rem;
      color: var(--ink-muted);
      font-size: 0.82rem;
    }

    .btn {
      width: 100%;
      margin-top: 0.1rem;
    }

    .error {
      margin: 0;
      color: var(--danger);
      font-size: 0.82rem;
    }
  `,
})
export class LoginOverlayComponent {
  private auth = inject(AuthService);

  email = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal('');

  async submit() {
    this.error.set('');
    if (!this.email || !this.password) return this.error.set('Enter your email and password.');
    this.busy.set(true);
    try {
      await this.auth.login(this.email, this.password);
    } catch (err) {
      this.error.set(apiError(err, 'Could not sign in. Please try again.'));
      this.password = '';
    } finally {
      this.busy.set(false);
    }
  }
}
