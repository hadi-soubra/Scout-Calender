export interface User {
  id: number;
  email: string;
  unitName: string;
  color: string;
  isAdmin: boolean;
}

/** Dates are local strings: "YYYY-MM-DD" for all-day, "YYYY-MM-DDTHH:mm" otherwise.
 *  For all-day pins `end` is exclusive (the day after the last day), as FullCalendar expects. */
export interface Pin {
  id: number;
  userId: number;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  location: string;
  description: string;
  unitName: string;
  color: string;
}

export type PinInput = Pick<Pin, 'title' | 'start' | 'end' | 'allDay' | 'location' | 'description'>;
