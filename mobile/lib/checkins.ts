import { authFetch } from "@/lib/api";

export type CheckInRecord = {
  id: string;
  location_id: string;
  location_name?: string;
  visit_date: string;
  checked_in_at: string;
  checked_out_at?: string | null;
  status: string;
  entrance_consumed: boolean;
};

export type MyCheckIns = {
  active?: CheckInRecord | null;
  history: CheckInRecord[];
};

export class CheckInConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckInConflictError";
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  return text.trim() || `HTTP ${res.status}`;
}

export async function fetchMyCheckIns(): Promise<MyCheckIns> {
  const res = await authFetch("/check-ins/me");
  if (res.status === 404) {
    return { history: [] };
  }
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  const data = (await res.json()) as MyCheckIns;
  return {
    active: data.active ?? null,
    history: data.history ?? [],
  };
}

export async function createCheckIn(
  locationId: string,
  coords?: { latitude: number; longitude: number }
): Promise<CheckInRecord> {
  const body =
    coords != null
      ? { latitude: coords.latitude, longitude: coords.longitude }
      : {};
  const res = await authFetch(`/locations/${encodeURIComponent(locationId)}/check-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    throw new CheckInConflictError(await readErrorMessage(res));
  }
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function checkOut(checkInId: string): Promise<CheckInRecord> {
  const res = await authFetch(
    `/check-ins/${encodeURIComponent(checkInId)}/check-out`,
    { method: "POST" }
  );
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export function formatWorkingHoursSummary(office: {
  weekday_open?: string;
  weekday_close?: string;
  weekend_open?: string;
  weekend_close?: string;
}): string {
  const wdOpen = office.weekday_open ?? "09:00";
  const wdClose = office.weekday_close ?? "18:00";
  const weOpen = office.weekend_open ?? "10:00";
  const weClose = office.weekend_close ?? "16:00";
  const norm = (t: string) => t.trim().slice(0, 5);
  const is24h = (open: string, close: string) =>
    norm(open) === "00:00" && (norm(close) === "00:00" || norm(close) === "24:00");
  if (
    is24h(wdOpen, wdClose) &&
    is24h(weOpen, weClose)
  ) {
    return "Open 24/7";
  }
  return `Mon–Fri ${wdOpen}–${wdClose}, Sat–Sun ${weOpen}–${weClose}`;
}
