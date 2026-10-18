import { HttpErrorResponse } from '@angular/common/http';

export function apiError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof HttpErrorResponse && typeof err.error?.error === 'string') return err.error.error;
  return fallback;
}
