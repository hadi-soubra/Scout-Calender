import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { User } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  readonly user = signal<User | null>(null);
  /** False until the initial /api/me check has finished. */
  readonly checked = signal(false);

  async restore() {
    try {
      this.user.set(await firstValueFrom(this.http.get<User>('/api/me')));
    } catch {
      this.user.set(null);
    } finally {
      this.checked.set(true);
    }
  }

  async login(email: string, password: string) {
    this.user.set(await firstValueFrom(this.http.post<User>('/api/login', { email, password })));
  }

  async logout() {
    try {
      await firstValueFrom(this.http.post('/api/logout', {}));
    } finally {
      this.user.set(null);
    }
  }

  canEdit(ownerId: number) {
    const u = this.user();
    return !!u && (u.isAdmin || u.id === ownerId);
  }
}
