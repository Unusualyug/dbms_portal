function authCookieOptions() {
  const sameSite = process.env.COOKIE_SAME_SITE || 'lax';
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite,
    path: '/',
    maxAge: 4 * 60 * 60 * 1000,
  };
}

module.exports = { authCookieOptions };
