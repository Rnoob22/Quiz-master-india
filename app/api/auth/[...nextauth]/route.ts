import NextAuth, { NextAuthOptions, Session, User as NextAuthUser } from "next-auth";
import { JWT } from "next-auth/jwt";
import { Account, Profile } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import prisma from "@/lib/db";

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
      account,
      profile,
    }: {
      user: NextAuthUser;
      account: Account | null;
      profile?: Profile;
    }): Promise<boolean> {
      if (!user?.email) return false;
      try {
        await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name ?? profile?.name ?? "Player",
            image: user.image ?? null,
          },
          create: {
            email: user.email,
            name: user.name ?? profile?.name ?? "Player",
            image: user.image ?? null,
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
      account,
      profile,
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
