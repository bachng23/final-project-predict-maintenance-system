import { LoginPage } from "@/components/pages/login-page";

export const metadata = { title: "Sign in — Marco.ai" };

export default function Page() {
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
      <LoginPage />
    </main>
  );
}
