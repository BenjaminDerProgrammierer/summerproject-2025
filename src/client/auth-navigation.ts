import type { LocationQuery, RouteLocationRaw } from 'vue-router';

export function loginRoute(redirect: string): RouteLocationRaw {
  return { name: 'login', query: { redirect } };
}

export function redirectAfterLogin(query: LocationQuery): string {
  const value = Array.isArray(query.redirect) ? query.redirect[0] : query.redirect;
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/';
}
