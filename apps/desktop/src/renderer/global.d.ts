import type { TandrixBridge } from "../shared/bridge";

declare global {
  interface Window {
    tandrix: TandrixBridge;
  }
  interface ImportMetaEnv {
    readonly TANDRIX_ENV: string;
    readonly VITE_API_URL: string;
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  }
}
