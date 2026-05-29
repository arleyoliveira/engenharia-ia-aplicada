"use client";

import GithubButton from "../../components/GithubButton";
import { authClient } from "../../lib/auth-client";

export default function SignInPage() {
  return (
    <div className="w-full max-w-md p-8 bg-white rounded shadow">
      <h2 className="text-xl font-medium mb-4">Entrar</h2>
      <GithubButton
        onClick={async () => {
          await authClient.signIn.social({ provider: "github", callbackURL: "/" });
        }}
      />
    </div>
  );
}
