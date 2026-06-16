import { authFetch } from "@/lib/api";

export type AvailabilityStatus = "available" | "busy" | "full";

export type LocationAvailability = {
  location_id: string;
  booking_date: string;
  capacity: number;
  booked_count: number;
  status: AvailabilityStatus;
};

export type BookingLocation = {
  id: string;
  name: string;
  city: string;
  image_url?: string;
};

export type Booking = {
  id: string;
  booking_date: string;
  status: string;
  location: BookingLocation;
  created_at: string;
};

export class BookingConflictError extends Error {
  readonly reason: "already_booked" | "location_full" | "unknown";

  constructor(message: string, reason: BookingConflictError["reason"] = "unknown") {
    super(message);
    this.name = "BookingConflictError";
    this.reason = reason;
  }
}

const BOOKING_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayInBucharest(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getBookingWindowDateKeys(): string[] {
  const start = todayInBucharest();
  return Array.from({ length: 10 }, (_, index) => addDaysToDateKey(start, index));
}

export function formatBookingDateLabel(dateKey: string): string {
  if (!BOOKING_DATE_RE.test(dateKey)) {
    return dateKey;
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatBookingChipLabel(dateKey: string): string {
  if (!BOOKING_DATE_RE.test(dateKey)) {
    return dateKey;
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = date.toLocaleDateString("en-GB", { weekday: "short" });
  return `${weekday} ${day}`;
}

function conflictReasonFromMessage(message: string): BookingConflictError["reason"] {
  const lower = message.toLowerCase();
  if (lower.includes("already have a booking")) {
    return "already_booked";
  }
  if (lower.includes("fully booked")) {
    return "location_full";
  }
  return "unknown";
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  return text || `HTTP ${res.status}`;
}

export async function getLocationAvailability(
  locationId: string,
  date: string
): Promise<LocationAvailability> {
  const res = await authFetch(
    `/locations/${encodeURIComponent(locationId)}/availability?date=${encodeURIComponent(date)}`
  );
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function listBookings(): Promise<Booking[]> {
  const res = await authFetch("/bookings");
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function createBooking(input: {
  locationId: string;
  bookingDate: string;
}): Promise<Booking> {
  const res = await authFetch("/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location_id: input.locationId,
      booking_date: input.bookingDate,
    }),
  });
  if (res.status === 409) {
    const message = await readErrorMessage(res);
    throw new BookingConflictError(message, conflictReasonFromMessage(message));
  }
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const res = await authFetch(`/bookings/${encodeURIComponent(bookingId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
}
