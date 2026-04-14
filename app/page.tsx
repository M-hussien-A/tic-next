"use client";

import { useState } from "react";
import LoginForm from "@/components/LoginForm";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  // Token stays in memory only — never written to localStorage / disk.
  const [session, setSession] = useState<{
    token: string;
    username: string;
  } | null>(null);

  if (!session) {
    return (
      <LoginForm
        onSuccess={(token, username) => setSession({ token, username })}
      />
    );
  }

  return (
    <Dashboard
      token={session.token}
      username={session.username}
      onSignOut={() => setSession(null)}
    />
  );
}
