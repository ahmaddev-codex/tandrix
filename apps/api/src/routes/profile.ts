// GET /profile and PUT /profile: what Tandrix calls this user. Asked once during
// setup, editable later in settings; the name reaches the model rarely by prompt rule.
import { ProfileResponse, UpdateProfileRequest } from "@tandrix/contracts";
import { Hono } from "hono";
import type { z } from "zod";
import type { AuthEnv } from "../auth";
import { invalid } from "../errors";
import type { ProfilesRepo } from "../repos/profiles";

const issues = (e: z.ZodError) =>
  e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);

export function profileRoutes(profiles: ProfilesRepo, now: () => number = Date.now) {
  return new Hono<AuthEnv>()
    .get("/", async (c) => {
      const got = await profiles.get(c.get("user").id);
      return c.json(ProfileResponse.parse(got));
    })
    .put("/", async (c) => {
      const parsed = UpdateProfileRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      await profiles.set(c.get("user").id, parsed.data.displayName, new Date(now()).toISOString());
      const got = await profiles.get(c.get("user").id);
      return c.json(ProfileResponse.parse(got));
    });
}
