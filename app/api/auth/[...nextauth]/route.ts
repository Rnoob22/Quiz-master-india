import NextAuth, { NextAuthOptions, Session, User as NextAuthUser } from "next-auth";
import { JWT } from "next-auth/jwt";
import { Account, Profile } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { DEVICE_FP_COOKIE } from "@/lib/deviceFingerprint";

interface AppJWT extends JWT {
  id?: string;
  picture?: string | null;
}

interface AppSession extends Session {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

// Returned (as a redirect URL) by the signIn callback when the device
// fingerprint of the incoming login does not match the fingerprint that was
// locked to the account on first sign-in. Keeping the constant exported in
// case other modules want to reference the same error code.
export const MULTI_DEVICE_ERROR = "MULTIPLE_DEVICE_LOGIN";
const MULTI_DEVICE_REDIRECT = `/login?error=${MULTI_DEVICE_ERROR}`;

const readDeviceFingerprintCookie = (): string | null => {
  try {
    const fp = cookies().get(DEVICE_FP_COOKIE)?.value;
    if (!fp) return null;
    // Defensive trim/length cap to match DB column safety.
    return fp.slice(0, 256).trim() || null;
  } catch {
    return null;
  }
};

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({
      user,
      profile,
    }: {
      user: NextAuthUser;
      account: Account | null;
      profile?: Profile;
    }): Promise<boolean | string> {
      if (!user?.email) return false;

      try {
        const incomingFp = readDeviceFingerprintCookie();

        const existing = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, deviceFingerprint: true },
        });

        // === Multi-device login enforcement ===
        // If the account already has a locked-in device fingerprint and the
        // incoming fingerprint differs, reject the sign-in attempt and
        // surface a clear error code that the /login page renders.
        if (
          existing &&
          existing.deviceFingerprint &&
          incomingFp &&
          existing.deviceFingerprint !== incomingFp
        ) {
          console.warn(
            `[NextAuth signIn] BLOCKED multi-device login for ${user.email} ` +
              `(stored=${existing.deviceFingerprint.slice(0, 16)}..., ` +
              `incoming=${incomingFp.slice(0, 16)}...)`
          );
          return MULTI_DEVICE_REDIRECT;
        }

        // Edge case: account already has a stored fingerprint but the client
        // failed to deliver the cookie (e.g. third-party cookie blocking).
        // We treat this as a potential cross-device attempt and reject,
        // matching the PRD's strict "One Device, One Account" requirement.
        if (existing && existing.deviceFingerprint && !incomingFp) {
          console.warn(
            `[NextAuth signIn] BLOCKED login for ${user.email}: stored ` +
              `device fingerprint present but no cookie was provided.`
          );
          return MULTI_DEVICE_REDIRECT;
        }

        // Upsert the user record. On first ever sign-in (or for legacy
        // accounts that haven't been locked yet) we record the fingerprint
        // so it acts as the permanent device lock for the account.
        const shouldSetFingerprint =
          incomingFp && (!existing || !existing.deviceFingerprint);

        await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name ?? profile?.name ?? "Player",
            image: user.image ?? null,
            ...(shouldSetFingerprint
              ? { deviceFingerprint: incomingFp as string }
              : {}),
          },
          create: {
            email: user.email,
            name: user.name ?? profile?.name ?? "Player",
            image: user.image ?? null,
            deviceFingerprint: incomingFp ?? null,
          },
        });

        return true;
      } catch (err) {
        console.error("[NextAuth signIn] Failed to upsert user:", err);
        return false;
      }
    },

    async jwt({
      token,
      user,
    }: {
      token: JWT;
      user?: NextAuthUser;
      account?: Account | null;
      profile?: Profile;
    }): Promise<AppJWT> {
      const appToken = token as AppJWT;

      // On initial sign-in, fetch the DB user to attach the internal relational ID.
      if (user?.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email },
            select: { id: true, image: true },
          });
          if (dbUser) {
            appToken.id = dbUser.id;
            appToken.picture = dbUser.image ?? appToken.picture ?? null;
          }
        } catch (err) {
          console.error("[NextAuth jwt] Failed to load DB user:", err);
        }
      }

      // Fallback: ensure id is hydrated on subsequent JWT refreshes.
      if (!appToken.id && appToken.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: appToken.email as string },
            select: { id: true },
          });
          if (dbUser) appToken.id = dbUser.id;
        } catch (err) {
          console.error("[NextAuth jwt-refresh] Lookup failed:", err);
        }
      }

      return appToken;
    },

    async session({
      session,
      token,
    }: {
      session: Session;
      token: JWT;
    }): Promise<AppSession> {
      const appToken = token as AppJWT;
      const appSession = session as AppSession;

      appSession.user = {
        ...(session.user ?? {}),
        id: appToken.id ?? "",
        name: session.user?.name ?? null,
        email: session.user?.email ?? null,
        image: appToken.picture ?? session.user?.image ?? null,
      };

      return appSession;
    },
  },
  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
