export function validateHermesKey(req: Request): boolean {
  const provided = req.headers.get('x-hermes-key');
  const expected = process.env.HERMES_API_KEY;
  if (!provided || !expected) return false;
  return provided === expected;
}

export function hermesUnauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}
