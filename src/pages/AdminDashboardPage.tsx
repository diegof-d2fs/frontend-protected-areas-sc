import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRound, UserCheck, UserX } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiUserRepository } from "@/lib/admin/ApiUserRepository"
import type { ManagedAccount } from "@/lib/admin/types"

const createAccountSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome."),
  username: z.string().trim().min(1, "Informe o usuário."),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
  role: z.enum(["admin", "operador"]),
})

type CreateAccountValues = z.infer<typeof createAccountSchema>

const ACCOUNTS_QUERY_KEY = ["accounts"]

export function AdminDashboardPage() {
  const queryClient = useQueryClient()
  const { data: accounts } = useQuery({
    queryKey: ACCOUNTS_QUERY_KEY,
    queryFn: () => apiUserRepository.list(),
  })

  function invalidateAccounts() {
    return queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY })
  }

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateAccountValues>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { nome: "", username: "", password: "", role: "operador" },
  })

  const createMutation = useMutation({
    mutationFn: (values: CreateAccountValues) => apiUserRepository.create(values),
    onSuccess: async (account) => {
      toast.success(`Conta de ${account.nome} criada.`)
      reset({ nome: "", username: "", password: "", role: "operador" })
      await invalidateAccounts()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a conta.")
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (account: ManagedAccount) => apiUserRepository.setActive(account.id, !account.ativo),
    onSuccess: async (_result, account) => {
      toast.success(
        account.ativo ? `Conta de ${account.nome} desativada.` : `Conta de ${account.nome} reativada.`,
      )
      await invalidateAccounts()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar a conta.")
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (account: ManagedAccount) => apiUserRepository.resetPassword(account.id),
    onSuccess: (_result, account) => {
      toast.success(`Senha de ${account.username} redefinida.`)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível redefinir a senha.",
      )
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Administração</h1>
        <p className="text-sm text-muted-foreground">
          Crie e gerencie as contas que acessam o cadastro geoespacial.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova conta</CardTitle>
          <CardDescription>Operadores e administradores acessam os mesmos cenários.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} noValidate>
            <FieldGroup className="sm:flex-row sm:items-end sm:gap-3">
              <Field>
                <FieldLabel htmlFor="nome">Nome</FieldLabel>
                <Input id="nome" {...register("nome")} />
                <FieldError errors={errors.nome ? [errors.nome] : undefined} />
              </Field>
              <Field>
                <FieldLabel htmlFor="username">Usuário</FieldLabel>
                <Input id="username" {...register("username")} />
                <FieldError errors={errors.username ? [errors.username] : undefined} />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Senha inicial</FieldLabel>
                <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
                <FieldError errors={errors.password ? [errors.password] : undefined} />
              </Field>
              <Field>
                <FieldLabel htmlFor="role">Papel</FieldLabel>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operador">Operador</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
                Criar conta
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contas</CardTitle>
          <CardDescription>Lista de quem tem acesso ao cadastro geoespacial.</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts === undefined ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{account.nome}</TableCell>
                    <TableCell className="font-mono text-xs">{account.username}</TableCell>
                    <TableCell>
                      <Badge variant={account.role === "admin" ? "default" : "secondary"}>
                        {account.role === "admin" ? "Administrador" : "Operador"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.ativo ? "secondary" : "outline"}>
                        {account.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Redefinir senha de ${account.nome}`}
                        onClick={() => resetPasswordMutation.mutate(account)}
                      >
                        <KeyRound className="size-4" />
                      </Button>
                      {account.ativo ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Desativar conta de ${account.nome}`}
                            >
                              <UserX className="size-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Desativar conta</DialogTitle>
                              <DialogDescription>
                                A conta de {account.nome} perde acesso ao cadastro geoespacial até
                                ser reativada. O histórico do que essa conta já fez continua
                                registrado.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button type="button" variant="outline">
                                  Cancelar
                                </Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  onClick={() => toggleActiveMutation.mutate(account)}
                                >
                                  Desativar
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Reativar conta de ${account.nome}`}
                          onClick={() => toggleActiveMutation.mutate(account)}
                        >
                          <UserCheck className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
