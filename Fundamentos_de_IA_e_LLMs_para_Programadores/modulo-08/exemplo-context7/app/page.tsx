"use client";

import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";
import GithubButton from "../components/GithubButton";

export default function Page() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await authClient.getSession();
      if (mounted) setSession(data ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="w-full max-w-md p-8 bg-white rounded shadow">
      <h1 className="text-2xl font-semibold mb-4">Hello World</h1>
      <p className="mb-6">
        {session?.user
          ? `Logado como ${session.user.email ?? session.user.name}`
          : "Você não está logado"}
      </p>
      {session?.user ? (
        <button
          onClick={() => authClient.signOut()}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Sair
        </button>
      ) : (
        <GithubButton
          onClick={async () => {
            await authClient.signIn.social({ provider: "github", callbackURL: "/" });
          }}
        />
      )}
    </div>
  );
}
