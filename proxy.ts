import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/hermes')) {
    return NextResponse.next();
  }

  // If Supabase isn't configured yet, let everything through so the app is at
  // least navigable in pre-setup dev. Login will fail with a clear error.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  let user: Awaited<ReturnType<typeof updateSession>>['user'] = null;
  let res: NextResponse;
  try {
    ({ user, res } = await updateSession(req));
  } catch {
    return NextResponse.next();
  }

  if (!user && pathname !== '/auth') {
    return NextResponse.redirect(new URL('/auth', req.url));
  }

  if (user && pathname === '/auth') {
    return NextResponse.redirect(new URL('/projects', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
