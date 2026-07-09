/** Types partagés du frontend (miroir de l'API backend). */

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type EnvironmentType = 'PRIVATE' | 'SHARED';

/** Les 3 espaces de l'application. */
export type Space = 'mine' | 'ours' | 'partner';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  startDatetime: string | null;
  endDatetime: string | null;
  isAllDay: boolean;
  assignedTo: string | null;
  assignee?: { id: string; name: string } | null;
}

export interface VoiceAnalysis {
  title: string;
  environment_type: EnvironmentType;
  due_date: string | null;
  due_datetime: string | null;
  is_all_day: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  coupleId: string;
}

export interface Partner {
  id: string;
  name: string;
}

/** Réponse commune de /login, /signup et /me. */
export interface AuthSession {
  user: AuthUser;
  partner: Partner | null;
  couple: { inviteCode: string | null };
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  /** Fourni pour rejoindre le couple d'un partenaire existant. */
  invite_code?: string;
}

/** Événement du calendrier (miroir de l'API /calendar). */
export type CalendarEvent =
  | {
      id: string;
      visibility: 'mine' | 'ours';
      title: string;
      status: TaskStatus;
      description: string | null;
      start: string;
      end: string | null;
      isAllDay: boolean;
    }
  | {
      id: string;
      visibility: 'partner_busy';
      start: string;
      end: string | null;
      isAllDay: boolean;
    };

export interface CreateTaskPayload {
  title: string;
  description?: string;
  environment_type: EnvironmentType;
  assign_to_partner?: boolean;
  start_datetime?: string | null;
  end_datetime?: string | null;
  is_all_day?: boolean;
}

export interface CreateTaskResponse {
  task: Task;
  has_conflict: boolean;
  message?: string;
}

/** Champs modifiables d'une tâche (tous optionnels). */
export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  start_datetime?: string | null;
  end_datetime?: string | null;
  is_all_day?: boolean;
}
