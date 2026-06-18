import { AppState, type AppStateStatus } from "react-native";

import { API_BASE_URL } from "@/lib/env";
import { getAccessToken } from "@/lib/api";
import type { ChatMessage, Conversation } from "@/lib/chat";
import type { Friend, FriendRequest } from "@/lib/friends";
import { SOCIAL_ENABLED } from "@/lib/social-config";

export type ChatWSEvent =
  | {
      type: "message.new";
      conversation_id: string;
      message: ChatMessage;
    }
  | {
      type: "friend_request.new";
      request: FriendRequest;
    }
  | {
      type: "friend_request.accepted";
      friend: Friend;
    };

type Listener = (event: ChatWSEvent) => void;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let intentionalClose = false;
const listeners = new Set<Listener>();
let appStateSubscription: { remove: () => void } | null = null;

function wsURL(token: string): string {
  const base = API_BASE_URL.replace(/^http/, "ws");
  return `${base}/chat/ws?token=${encodeURIComponent(token)}`;
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (intentionalClose || !SOCIAL_ENABLED) return;
  clearReconnectTimer();
  const delay = Math.min(1000 * 2 ** reconnectAttempt, 30000);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    void connectChatWS();
  }, delay);
}

function handleMessage(data: string) {
  try {
    const event = JSON.parse(data) as ChatWSEvent;
    if (!event?.type) return;
    listeners.forEach((listener) => listener(event));
  } catch {
    // ignore malformed payloads
  }
}

export function subscribeChatWS(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function connectChatWS(): Promise<void> {
  if (!SOCIAL_ENABLED) return;
  if (socket?.readyState === WebSocket.OPEN) return;
  if (socket?.readyState === WebSocket.CONNECTING) return;

  intentionalClose = false;
  clearReconnectTimer();

  let token: string;
  try {
    token = await getAccessToken();
  } catch {
    return;
  }

  if (socket) {
    socket.close();
    socket = null;
  }

  const ws = new WebSocket(wsURL(token));
  socket = ws;

  ws.onopen = () => {
    reconnectAttempt = 0;
  };

  ws.onmessage = (evt) => {
    if (typeof evt.data === "string") {
      handleMessage(evt.data);
    }
  };

  ws.onclose = () => {
    if (socket === ws) socket = null;
    if (!intentionalClose) scheduleReconnect();
  };

  ws.onerror = () => {
    ws.close();
  };
}

export function disconnectChatWS() {
  intentionalClose = true;
  clearReconnectTimer();
  reconnectAttempt = 0;
  if (socket) {
    socket.close();
    socket = null;
  }
}

export function sendChatMessageWS(conversationId: string, body: string) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(
    JSON.stringify({
      type: "message.send",
      conversation_id: conversationId,
      body,
    })
  );
  return true;
}

export function ensureChatWSLifecycle() {
  if (!SOCIAL_ENABLED) return () => {};
  if (!appStateSubscription) {
    void connectChatWS();
    appStateSubscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          void connectChatWS();
        }
      }
    );
  }
  return () => {
    appStateSubscription?.remove();
    appStateSubscription = null;
    disconnectChatWS();
  };
}

export type { Conversation };
