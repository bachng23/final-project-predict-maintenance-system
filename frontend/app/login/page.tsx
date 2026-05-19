"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginPage } from "@/components/pages/login-page";
import { hasToken, login } from "@/lib/auth";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    if (hasToken()) {
      router.replace("/");
      router.refresh();
    }
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--color-canvas-fog)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <LoginPage
        onSubmit={async (username, password) => {
          await login(username, password);
          router.replace("/");
          router.refresh();
        }}
      />
    </main>
  );
}
