import {
  Component, DestroyRef, ElementRef, afterNextRender, effect, inject, output, signal, viewChild,
} from '@angular/core';
import { Calendar, EventApi, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { AuthService } from '../services/auth.service';
import { PinsService } from '../services/pins.service';
import { Pin, PinInput } from '../models';
import { tint, toDateTime, toDay } from '../dates';

export interface MonthPins {
  title: string;
  pins: Pin[];
}

export interface NewRange {
  start: string;
  end: string | null;
  allDay: boolean;
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class CalendarComponent {
  private auth = inject(AuthService);
  private pins = inject(PinsService);
  private host = viewChild.required<ElementRef<HTMLElement>>('host');
  private calendar?: Calendar;

  readonly create = output<NewRange>();
  readonly open = output<Pin>();
  readonly error = output<string>();
  /** Pins in the visible month, for the list beside the calendar. */
  readonly loaded = output<MonthPins>();

  protected readonly title = signal('');

  constructor() {
    afterNextRender(() => {
      const narrow = window.innerWidth < 640;
      // Desktop fills the available height (see app.scss); smaller screens grow with content.
      const fill = () => window.innerWidth >= 900;
      this.calendar = new Calendar(this.host().nativeElement, {
        plugins: [dayGridPlugin, interactionPlugin],
        initialView: 'dayGridMonth',
        headerToolbar: false,
        firstDay: 1,
        height: fill() ? '100%' : 'auto',
        windowResize: () => this.calendar?.setOption('height', fill() ? '100%' : 'auto'),
        fixedWeekCount: false,
        dayHeaderFormat: { weekday: narrow ? 'narrow' : 'short' },
        // On phones the grid only shows colour bars; the list below has the details.
        dayMaxEvents: narrow ? false : true,
        eventDisplay: 'block',
        displayEventTime: false,
        selectable: true,
        longPressDelay: 300,
        datesSet: (info) => this.title.set(info.view.title),
        events: (info, success, failure) => this.load(info.start, info.end).then(success, failure),
        select: (sel) => {
          this.calendar?.unselect();
          if (!this.auth.user()) return;
          this.create.emit({
            start: sel.allDay ? toDay(sel.start) : toDateTime(sel.start),
            end: sel.allDay ? toDay(sel.end) : toDateTime(sel.end),
            allDay: sel.allDay,
          });
        },
        // Phones draw pins as solid colour bars, so keep the full unit colour at hand.
        eventDidMount: (info) => info.el.style.setProperty('--unit', info.event.extendedProps['pin'].color),
        eventClick: (click) => this.open.emit(click.event.extendedProps['pin']),
        eventDrop: (change) => this.move(change.event, change.revert),
        eventResize: (change) => this.move(change.event, change.revert),
      });
      this.calendar.render();
    });

    // Reload whenever the signed-in unit changes.
    effect(() => {
      this.auth.user();
      this.refetch();
    });

    inject(DestroyRef).onDestroy(() => this.calendar?.destroy());
  }

  refetch() {
    this.calendar?.refetchEvents();
  }

  protected prev() {
    this.calendar?.prev();
  }

  protected next() {
    this.calendar?.next();
  }

  private async load(start: Date, end: Date): Promise<EventInput[]> {
    // Nothing is fetched until someone signs in, so the blurred view never leaks data.
    if (!this.auth.user()) {
      this.loaded.emit({ title: this.calendar?.view.title ?? '', pins: [] });
      return [];
    }
    const list = await this.pins.list(toDay(start), toDay(end));
    this.emitMonth(list);
    return list.map((p) => ({
      id: String(p.id),
      title: p.title,
      start: p.start,
      end: p.end ?? undefined,
      allDay: p.allDay,
      backgroundColor: tint(p.color, 0.75),
      borderColor: 'transparent',
      textColor: 'var(--ink)',
      editable: this.auth.canEdit(p.userId),
      extendedProps: { pin: p },
    }));
  }

  private emitMonth(list: Pin[]) {
    const view = this.calendar!.view;
    const from = toDay(view.currentStart);
    const to = toDay(view.currentEnd);
    const pins = list.filter((p) => p.start < to && (p.end ?? p.start) >= from);
    this.loaded.emit({ title: view.title, pins });
  }

  private async move(ev: EventApi, revert: () => void) {
    const pin: Pin = ev.extendedProps['pin'];
    const fmt = (d: Date) => (ev.allDay ? toDay(d) : toDateTime(d));
    const input: PinInput = {
      title: pin.title,
      location: pin.location,
      description: pin.description,
      allDay: ev.allDay,
      start: fmt(ev.start!),
      end: ev.end ? fmt(ev.end) : null,
    };
    try {
      await this.pins.update(pin.id, input);
      this.refetch();
    } catch {
      revert();
      this.error.emit('Could not move that pin.');
    }
  }
}
