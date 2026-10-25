import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

/** Set once the welcome screen has been read; it isn't shown again on this device. */
export const WELCOME_SEEN = "tandrix.welcomed";

/** undefined while reading, then whether the welcome has been seen. */
export function useWelcomeSeen() {
  const [seen, setSeen] = useState<boolean>();
  useEffect(() => {
    SecureStore.getItemAsync(WELCOME_SEEN)
      .then((v) => setSeen(v === "1"))
      .catch(() => setSeen(false));
  }, []);
  return seen;
}
