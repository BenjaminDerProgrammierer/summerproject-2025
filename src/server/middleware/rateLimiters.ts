import { rateLimit } from 'express-rate-limit';

function publicEndpointLimiter(windowMs: number, limit: number, message: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message },
  });
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Too many failed login attempts. Try again later.' },
});

export const registrationLimiter = publicEndpointLimiter(
  60 * 60 * 1000,
  10,
  'Too many registration attempts. Try again later.',
);

export const setupLimiter = publicEndpointLimiter(
  15 * 60 * 1000,
  5,
  'Too many setup attempts. Try again later.',
);

export const signupKeyValidationLimiter = publicEndpointLimiter(
  15 * 60 * 1000,
  30,
  'Too many signup-key validation attempts. Try again later.',
);
