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
  ProposalsResponse,
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

/** Demande un code de réinitialisation (réponse générique, anti-énumération). */
export function forgotPassword(email: string) {
  return request<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** Réinitialise le mot de passe via le code reçu ; renvoie une session connectée. */
export function resetPassword(email: string, code: string, password: string) {
  return request<AuthResponse>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, password }),
  });
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

// --- Propositions d'activité ---

/** Propositions reçues (à valider) et émises (en attente / refusées). */
export function getProposals() {
  return request<ProposalsResponse>('/api/tasks/proposals');
}

/** Accepte une proposition reçue : elle devient une tâche commune. */
export function acceptProposal(id: string) {
  return request<CreateTaskResponse>(`/api/tasks/${id}/proposal/accept`, { method: 'POST' });
}

/** Refuse une proposition reçue. */
export function declineProposal(id: string) {
  return request<{ task: Task }>(`/api/tasks/${id}/proposal/decline`, { method: 'POST' });
}

/** Événements du calendrier sur une fenêtre [from, to] (ISO). */
export function getCalendar(from: string, to: string) {
  return request<{ events: CalendarEvent[] }>(
    `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );
}

/** URL d'abonnement ICS de l'utilisateur (créée à la volée si absente). */
export function getCalendarFeedUrl() {
  return request<{ url: string }>('/api/calendar/feed');
}

/** Régénère le jeton du flux ICS : l'ancien lien cesse de fonctionner. */
export function rotateCalendarFeed() {
  return request<{ url: string }>('/api/calendar/feed/rotate', { method: 'POST' });
}

/** Envoie le texte "dicté" à l'endpoint d'analyse IA (mocké côté backend). */
export function voiceAnalyse(text: string) {
  return request<VoiceAnalysis>('/api/tasks/voice-analyse', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}
