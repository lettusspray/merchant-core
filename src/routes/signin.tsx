import { createFileRoute } from "@tanstack/react-router";

import { SignInPage } from "@/components/auth/signin-page";

export const Route = createFileRoute("/signin")({
  component: SignInPage,
});
