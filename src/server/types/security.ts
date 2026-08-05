export const USER_ROLES = ['user', 'writer', 'moderator', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface AuthTokenPayload {
  id: number;
  username: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
