import { adgangsplatformen, callbacks } from "@dbcdk/login-nextjs";
import { NextAuth } from "@dbcdk/login-nextjs";
import { getServerSideConfig } from "../../../config/server";

const { clientId, clientSecret } = getServerSideConfig();

const options = {
  providers: [
    adgangsplatformen({
      clientId,
      clientSecret,
    }),
  ],
  callbacks: {
    ...callbacks,
  },
};
export const GET = NextAuth(options);
