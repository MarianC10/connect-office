import { authFetch } from "@/lib/api";

export type VisibleCheckInPerson = {
  user_id: string;
  display_name: string;
  is_friend: boolean;
  avatar_url: string;
};

export async function fetchVisibleCheckIns(
  locationId: string,
  date: string
): Promise<VisibleCheckInPerson[]> {
  const res = await authFetch(
    `/locations/${encodeURIComponent(locationId)}/check-ins/visible?date=${encodeURIComponent(date)}`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function checkInAtOffice(
  locationId: string,
  date: string
): Promise<void> {
  const res = await authFetch(
    `/locations/${encodeURIComponent(locationId)}/check-in?date=${encodeURIComponent(date)}`,
    { method: "POST" }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}
