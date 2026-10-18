import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { PinsService } from '../services/pins.service';
import { apiError } from '../services/api-error';
import { Pin, PinInput } from '../models';
import { NewRange } from '../calendar/calendar';
import { addDays, tint } from '../dates';

/** Open an existing pin, or start a new one from a selected range. */
export type DialogTarget = { pin: Pin } | { range: NewRange };

@Component({
  selector: 'app-event-dialog',
  imports: [FormsModule],
  templateUrl: './event-dialog.html',
  styleUrl: './event-dialog.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class EventDialogComponent {
  private auth = inject(AuthService);
  private pins = inject(PinsService);

  readonly target = input.required<DialogTarget>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  readonly pin = computed(() => ('pin' in this.target() ? (this.target() as { pin: Pin }).pin : null));
  readonly canEdit = computed(() => {
    const p = this.pin();
    return p ? this.auth.canEdit(p.userId) : true;
  });
  readonly editing = signal(false);
  readonly confirmDelete = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  // Form fields. Leaving both times empty makes an all-day pin; the end date is the
  // *inclusive* last day.
  title = '';
  startDate = '';
  startTime = '';
  endDate = '';
  endTime = '';
  location = '';
  description = '';

  readonly tint = tint;

  ngOnInit() {
    const t = this.target();
    if ('pin' in t) {
      this.fill(t.pin);
    } else {
      this.editing.set(true);
      this.setRange(t.range.start, t.range.end, t.range.allDay);
    }
  }

  private fill(p: Pin) {
    this.title = p.title;
    this.setRange(p.start, p.end, p.allDay);
    this.location = p.location;
    this.description = p.description;
  }

  private setRange(start: string, end: string | null, allDay: boolean) {
    this.startDate = start.slice(0, 10);
    this.startTime = allDay ? '' : start.slice(11, 16);
    this.endDate = end ? (allDay ? addDays(end, -1) : end.slice(0, 10)) : this.startDate;
    this.endTime = end && !allDay ? end.slice(11, 16) : '';
  }

  /** Keep the end date from falling before the start date. */
  startDateChanged() {
    if (!this.endDate || this.endDate < this.startDate) this.endDate = this.startDate;
  }

  startEdit() {
    this.fill(this.pin()!);
    this.error.set('');
    this.editing.set(true);
  }

  cancelEdit() {
    if (this.pin()) this.editing.set(false);
    else this.closed.emit();
  }

  async save() {
    this.error.set('');
    if (!this.title.trim()) return this.error.set('Please add a title.');
    if (!this.startDate) return this.error.set('Please pick a start date.');
    const endDate = this.endDate || this.startDate;
    if (endDate < this.startDate) return this.error.set('The end date must be after the start date.');
    if (this.endTime && !this.startTime) return this.error.set('Add a start time too, or clear the end time for an all-day pin.');

    const allDay = !this.startTime;
    let start: string;
    let end: string | null;
    if (allDay) {
      start = this.startDate;
      end = endDate === this.startDate ? null : addDays(endDate, 1);
    } else {
      start = `${this.startDate}T${this.startTime}`;
      if (this.endTime) end = `${endDate}T${this.endTime}`;
      else if (endDate === this.startDate) end = null;
      else return this.error.set('Add an end time for a pin that runs over several days.');
      if (end && end <= start) return this.error.set('The end must be after the start.');
    }

    const input: PinInput = {
      title: this.title.trim(),
      allDay,
      start,
      end,
      location: this.location.trim(),
      description: this.description,
    };

    this.busy.set(true);
    try {
      const p = this.pin();
      if (p) await this.pins.update(p.id, input);
      else await this.pins.create(input);
      this.saved.emit();
    } catch (err) {
      this.error.set(apiError(err));
    } finally {
      this.busy.set(false);
    }
  }

  async remove() {
    this.busy.set(true);
    try {
      await this.pins.remove(this.pin()!.id);
      this.saved.emit();
    } catch (err) {
      this.error.set(apiError(err));
    } finally {
      this.busy.set(false);
    }
  }

  /** Human-readable date range for the view mode. */
  when(p: Pin) {
    const day: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    const time: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    const parse = (s: string) => new Date(s.length === 10 ? `${s}T00:00` : s);
    const start = parse(p.start);
    if (p.allDay) {
      const last = p.end ? parse(addDays(p.end, -1)) : start;
      const a = start.toLocaleDateString('en-GB', day);
      const b = last.toLocaleDateString('en-GB', day);
      return a === b ? `${a} · All day` : `${a} – ${b}`;
    }
    const a = `${start.toLocaleDateString('en-GB', day)}, ${start.toLocaleTimeString('en-GB', time)}`;
    if (!p.end) return a;
    const end = parse(p.end);
    return end.toDateString() === start.toDateString()
      ? `${a} – ${end.toLocaleTimeString('en-GB', time)}`
      : `${a} – ${end.toLocaleDateString('en-GB', day)}, ${end.toLocaleTimeString('en-GB', time)}`;
  }
}
