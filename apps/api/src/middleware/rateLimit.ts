import rateLimit from "express-rate-limit";

const respondTooMany = (message: string) => (_req: unknown, res: import("express").Response) => {
  res.status(429).json({ error: { code: "TOO_MANY_REQUESTS", message } });
};

// Rate limits exist to slow down credential stuffing / abuse in real traffic, not to
// throttle the test suite's own login calls. Skip them under NODE_ENV=test; they stay
// fully active in development and production.
const skipInTest = () => process.env.NODE_ENV === "test";

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: respondTooMany("Too many login attempts. Try again in a few minutes."),
});

export const registerCompanyRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: respondTooMany("Too many sign-up attempts from this address. Try again later."),
});

export const forgotPasswordRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: respondTooMany("Too many password reset requests. Try again later."),
});
