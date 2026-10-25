import "@tandrix/ui/tokens.css";
import "@tandrix/ui/web/styles.css";
import "./fonts.css";
import "./panel.css";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "./lib/auth";
import { Home } from "./panel/Home";
import { SignIn } from "./panel/SignIn";

/** Light by default on the Mac; dark follows the system. */
function useSystemTheme() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => (document.documentElement.dataset.theme = media.matches ? "dark" : "light");
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
}

function Panel() {
  useSystemTheme();
  const { session } = useAuth();
  if (session === undefined) return null;
  return session ? <Home /> : <SignIn />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <Panel />
    </AuthProvider>
  </StrictMode>,
);
