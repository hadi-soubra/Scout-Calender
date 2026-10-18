import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Pin, PinInput } from '../models';

@Injectable({ providedIn: 'root' })
export class PinsService {
  private http = inject(HttpClient);

  list(start: string, end: string) {
    return firstValueFrom(this.http.get<Pin[]>('/api/events', { params: { start, end } }));
  }

  create(input: PinInput) {
    return firstValueFrom(this.http.post<Pin>('/api/events', input));
  }

  update(id: number, input: PinInput) {
    return firstValueFrom(this.http.put<Pin>(`/api/events/${id}`, input));
  }

  remove(id: number) {
    return firstValueFrom(this.http.delete(`/api/events/${id}`));
  }
}
