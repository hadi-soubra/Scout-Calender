import { Component, computed, input, output } from '@angular/core';
import { Pin } from '../models';
import { addDays, toDay } from '../dates';

interface Group {
  day: string;
  num: number;
  weekday: string;
  isToday: boolean;
  isPast: boolean;
  pins: Pin[];
}

@Component({
  selector: 'app-pin-list',
  templateUrl: './pin-list.html',
  styleUrl: './pin-list.scss',
})
export class PinListComponent {
  readonly title = input('');
  readonly pins = input<Pin[]>([]);
  readonly open = output<Pin>();

  /** Pins grouped under their start day, in date order. */
  readonly groups = computed<Group[]>(() => {
    const byDay = new Map<string, Pin[]>();
    for (const p of [...this.pins()].sort((a, b) => a.start.localeCompare(b.start))) {
      const day = p.start.slice(0, 10);
      byDay.set(day, [...(byDay.get(day) ?? []), p]);
    }
    const today = toDay(new Date());
    return [...byDay].map(([day, pins]) => ({
      day,
      num: Number(day.slice(8, 10)),
      weekday: new Date(`${day}T00:00`).toLocaleDateString('en-GB', { weekday: 'short' }),
      isToday: day === today,
      isPast: pins.every((p) => (p.end ?? addDays(p.start.slice(0, 10), 1)) <= today),
      pins,
    }));
  });

  time(p: Pin) {
    const hm = (s: string) => s.slice(11, 16);
    const short = (s: string) =>
      new Date(`${s.slice(0, 10)}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    if (p.allDay) {
      const last = p.end ? addDays(p.end, -1) : p.start;
      return last === p.start ? 'All day' : `Until ${short(last)}`;
    }
    if (!p.end) return hm(p.start);
    return p.end.slice(0, 10) === p.start.slice(0, 10)
      ? `${hm(p.start)} – ${hm(p.end)}`
      : `${hm(p.start)} – ${short(p.end)}, ${hm(p.end)}`;
  }
}
