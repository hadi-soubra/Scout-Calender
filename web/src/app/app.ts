import { Component, inject, signal, viewChild } from '@angular/core';
import { AuthService } from './services/auth.service';
import { CalendarComponent, MonthPins, NewRange } from './calendar/calendar';
import { LoginOverlayComponent } from './login-overlay/login-overlay';
import { DialogTarget, EventDialogComponent } from './event-dialog/event-dialog';
import { PinListComponent } from './pin-list/pin-list';
import { tint } from './dates';

@Component({
  selector: 'app-root',
  imports: [CalendarComponent, LoginOverlayComponent, EventDialogComponent, PinListComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected auth = inject(AuthService);
  private calendar = viewChild.required(CalendarComponent);

  protected readonly month = signal<MonthPins>({ title: '', pins: [] });
  protected readonly dialog = signal<DialogTarget | null>(null);
  protected readonly toast = signal('');
  protected readonly tint = tint;

  constructor() {
    this.auth.restore();
  }

  protected onCreate(range: NewRange) {
    this.dialog.set({ range });
  }

  protected onSaved() {
    this.dialog.set(null);
    this.calendar().refetch();
  }

  protected async logout() {
    this.dialog.set(null);
    await this.auth.logout();
  }

  protected showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3500);
  }
}
