import { authFetch, getAccessToken } from "@/lib/api";
import { API_BASE_URL } from "@/lib/env";

export type MeProfile = {
  id: string;
  email?: string;
  email_verified: boolean;
  role: "member" | "owner";
  display_name: string;
  is_public: boolean;
  avatar_url: string;
};

export type PublicProfile = {
  id: string;
  display_name: string;
  is_public: boolean;
  avatar_url: string;
};

export async function fetchMe(): Promise<MeProfile> {
  const res = await authFetch("/me");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return {
    ...data,
    role: data.role === "owner" ? "owner" : "member",
  };
}

export async function updateMe(body: {
  display_name?: string;
  is_public?: boolean;
}): Promise<MeProfile> {
  const res = await authFetch("/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function uploadAvatar(uri: string, mimeType = "image/jpeg"): Promise<MeProfile> {
  const token = await getAccessToken();
  const form = new FormData();
  form.append("avatar", {
    uri,
    name: "avatar.jpg",
    type: mimeType,
  } as unknown as Blob);

  const res = await fetch(`${API_BASE_URL}/me/avatar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function searchUsers(query: string): Promise<PublicProfile[]> {
  const res = await authFetch(`/users/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function lookupUserByEmail(email: string): Promise<PublicProfile> {
  const res = await authFetch("/users/lookup-by-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (res.status === 404) {
    throw new Error("User not found");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchUserProfile(userId: string): Promise<PublicProfile> {
  const res = await authFetch(`/users/${encodeURIComponent(userId)}`);
  if (res.status === 404) {
    throw new Error("User not found");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export type VisibleBookingPerson = {
  user_id: string;
  display_name: string;
  is_friend: boolean;
  avatar_url: string;
};

export async function fetchVisibleBookings(
  locationId: string,
  date: string
): Promise<VisibleBookingPerson[]> {
  const res = await authFetch(
    `/locations/${encodeURIComponent(locationId)}/bookings/visible?date=${encodeURIComponent(date)}`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}
