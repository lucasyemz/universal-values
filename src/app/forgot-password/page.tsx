import { AccessShell } from "@/components/auth/access-shell";
import { AccessForm } from "@/components/auth/access-form";
export const dynamic = "force-dynamic";
export default function ForgotPasswordPage() {
  return <AccessShell title="Recuperar acesso" description="Receba um link único ou um código por e-mail para criar uma nova senha."><AccessForm mode="forgot" /></AccessShell>;
}
