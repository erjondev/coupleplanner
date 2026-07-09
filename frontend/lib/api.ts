/**
 * Client API minimaliste.
 * L'URL du backend se configure via la variable EXPO_PUBLIC_API_URL
 * (ex: EXPO_PUBLIC_API_URL=http://192.168.1.10:3000 pour un test sur mobile).
 */
import {
  AuthSession,
  CalendarEvent,
  CreateTaskPayload,
  CreateTaskResponse,
  SignupPayload,
  Space,
  Task,
  TaskStatus,
  UpdateTaskPayload,
  VoiceAnalysis,
} from '../types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `Erreur HTTP ${res.status}`);
  }
  return body as T;
}

// --- Auth ---

type AuthResponse = AuthSession & { token: string };

export function login(email: string, password: string) {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function signup(payload: SignupPayload) {
  return request<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Profil courant à partir du token (pour restaurer une session). */
export function getMe() {
  return request<AuthSession>('/api/auth/me');
}

// --- Tâches ---

export function getTasks(space: Space) {
  return request<{ tasks: Task[] }>(`/api/tasks?space=${space}`);
}

export function createTask(payload: CreateTaskPayload) {
  return request<CreateTaskResponse>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateTaskStatus(id: string, status: TaskStatus) {
  return request<{ task: Task }>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/** Mise à jour partielle d'une tâche (titre, description, statut...). */
export function updateTask(id: string, payload: UpdateTaskPayload) {
  return request<CreateTaskResponse>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** Suppression d'une tâche. */
export function deleteTask(id: string) {
  return request<void>(`/api/tasks/${id}`, { method: 'DELETE' });
}

/** Événements du calendrier sur une fenêtre [from, to] (ISO). */
export function getCalendar(from: string, to: string) {
  return request<{ events: CalendarEvent[] }>(
    `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );
}

/** Envoie le texte "dicté" à l'endpoint d'analyse IA (mocké côté backend). */
export function voiceAnalyse(text: string) {
  return request<VoiceAnalysis>('/api/tasks/voice-analyse', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}
