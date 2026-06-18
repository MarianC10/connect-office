import { authFetch } from "@/lib/api";

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type LastMessagePreview = {
  id: string;
  body: string;
  created_at: string;
};

export type ConversationFriend = {
  id: string;
  display_name: string;
  avatar_url: string;
};

export type Conversation = {
  id: string;
  friend: ConversationFriend;
  last_message: LastMessagePreview | null;
};

export async function listConversations(): Promise<Conversation[]> {
  const res = await authFetch("/conversations");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getConversationWithFriend(
  friendUserId: string
): Promise<Conversation> {
  const res = await authFetch(
    `/conversations/with/${encodeURIComponent(friendUserId)}`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchMessages(
  conversationId: string,
  opts?: { before?: string; limit?: number }
): Promise<ChatMessage[]> {
  const params = new URLSearchParams();
  if (opts?.before) params.set("before", opts.before);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const res = await authFetch(
    `/conversations/${encodeURIComponent(conversationId)}/messages${qs ? `?${qs}` : ""}`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function sendMessage(
  conversationId: string,
  body: string
): Promise<ChatMessage> {
  const res = await authFetch(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}
