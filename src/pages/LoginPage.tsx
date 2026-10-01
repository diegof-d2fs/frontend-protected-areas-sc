import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/AuthContext"

const loginSchema = z.object({
  username: z.string().trim().min(1, "Informe o usuário."),
  password: z.string().min(1, "Informe a senha."),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  })

  // Já autenticado (ex.: voltou pra /login com sessão ainda válida): não mostra o formulário de novo.
  if (user) {
    return <Navigate to="/" replace />
  }

  const from = (location.state as { from?: Location })?.from?.pathname ?? "/"

  async function onSubmit(values: LoginFormValues) {
    try {
      const loggedIn = await login(values.username, values.password)
      const papel = loggedIn.role === "admin" ? "administrador" : "operador"
      toast.success(`Sessão iniciada como ${papel}.`)
      navigate(from, { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar.")
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>Acesse o formulário de cenários de cadastro.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <Field data-invalid={!!errors.username}>
                <FieldLabel htmlFor="username">Usuário</FieldLabel>
                <Input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  {...register("username")}
                />
                <FieldError errors={errors.username ? [errors.username] : undefined} />
              </Field>
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">Senha</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register("password")}
                />
                <FieldError errors={errors.password ? [errors.password] : undefined} />
              </Field>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                Entrar
              </Button>
              <FieldDescription>
                Peça a um administrador uma conta caso ainda não tenha usuário e senha.
              </FieldDescription>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
