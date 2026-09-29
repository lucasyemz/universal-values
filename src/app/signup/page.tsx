import { AccessShell } from "@/components/auth/access-shell";
import { AccessForm } from "@/components/auth/access-form";
import { SocialLogin } from "@/components/auth/social-login";
export const dynamic = "force-dynamic";
export default function SignupPage() {
  return <AccessShell title="Criar conta" description="Comece com sua conta Google, Apple, Microsoft ou seu e-mail."><SocialLogin /><AccessForm mode="signup" /></AccessShell>;
}
