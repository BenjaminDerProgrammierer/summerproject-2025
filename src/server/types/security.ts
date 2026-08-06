export const USER_ROLES = ['user', 'writer', 'moderator', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface AuthTokenPayload {
  id: number;
  username: string;
  role: UserRole;
  authVersion: number;
  iat?: number;
  exp?: number;
}
