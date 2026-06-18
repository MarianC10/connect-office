import { authFetch } from "@/lib/api";

export type FriendRequest = {
  id: string;
  from_user_id: string;
  from_email?: string;
  display_name: string;
  avatar_url: string;
  created_at: string;
};

export type OutgoingFriendRequest = {
  id: string;
  to_user_id: string;
  to_email?: string;
  display_name: string;
  avatar_url: string;
  created_at: string;
};

export type Friend = {
  id: string;
  display_name: string;
  is_public: boolean;
  avatar_url: string;
};

export class FriendRequestConflictError extends Error {
  constructor(message = "Friend request already pending or already friends") {
    super(message);
    this.name = "FriendRequestConflictError";
  }
}

export async function sendFriendRequest(body: {
  user_id?: string;
  email?: string;
}): Promise<FriendRequest> {
  const res = await authFetch("/friends/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    const text = await res.text();
    throw new FriendRequestConflictError(text || undefined);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchInbox(): Promise<FriendRequest[]> {
  const res = await authFetch("/friends/requests/inbox");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchOutgoing(): Promise<OutgoingFriendRequest[]> {
  const res = await authFetch("/friends/requests/outgoing");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function cancelOutgoingRequest(requestId: string): Promise<void> {
  const res = await authFetch(
    `/friends/requests/${encodeURIComponent(requestId)}/cancel`,
    { method: "POST" }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}

export async function acceptRequest(requestId: string): Promise<void> {
  const res = await authFetch(`/friends/requests/${encodeURIComponent(requestId)}/accept`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}

export async function declineRequest(requestId: string): Promise<void> {
  const res = await authFetch(`/friends/requests/${encodeURIComponent(requestId)}/decline`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}

export async function listFriends(): Promise<Friend[]> {
  const res = await authFetch("/friends");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function unfriend(userId: string): Promise<void> {
  const res = await authFetch(`/friends/user/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}
