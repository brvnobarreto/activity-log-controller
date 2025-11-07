import * as React from "react"
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithPopup, updateProfile } from "firebase/auth"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { auth, googleProvider } from "@/lib/firebase"

interface SignupFormProps extends React.ComponentProps<typeof Card> {
  onGoogleSignInSuccess?: () => void
}

export function SignupForm({ onGoogleSignInSuccess, ...props }: SignupFormProps) {
  const [fullName, setFullName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setFeedback(null)

    if (password !== confirmPassword) {
      setError("As senhas precisam ser iguais.")
      return
    }

    if (password.length < 8) {
      setError("A senha deve conter pelo menos 8 caracteres.")
      return
    }

    setLoading(true)

    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(credential.user, { displayName: fullName.trim() })
      await sendEmailVerification(credential.user)

      setFeedback("Conta criada! Verifique seu email para ativar o acesso.")
      setFullName("")
      setEmail("")
      setPassword("")
      setConfirmPassword("")
    } catch (signupError: any) {
      console.error("Erro ao criar usuário:", signupError)
      if (signupError.code === "auth/email-already-in-use") {
        setError("Este email já está em uso. Tente fazer login ou redefinir a senha.")
      } else if (signupError.code === "auth/invalid-email") {
        setError("Email inválido.")
      } else if (signupError.code === "auth/weak-password") {
        setError("A senha é muito fraca.")
      } else {
        setError("Não foi possível criar a conta. Tente novamente.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setError(null)
    setFeedback(null)
    setLoading(true)

    try {
      const credential = await signInWithPopup(auth, googleProvider)
      const idToken = await credential.user.getIdToken()

      await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })

      setFeedback("Login com Google realizado com sucesso!")
      onGoogleSignInSuccess?.()
    } catch (googleError: any) {
      console.error("Erro no login com Google:", googleError)
      setError("Não foi possível entrar com o Google. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Crie sua conta</CardTitle>
        <CardDescription>Informe seus dados para começar a usar o sistema.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Nome completo</FieldLabel>
              <Input
                id="name"
                type="text"
                placeholder="Maria Silva"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <FieldDescription>Usaremos este email para comunicação e login.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <FieldDescription>Precisa ter pelo menos 8 caracteres.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="confirm-password">Confirmar senha</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
              <FieldDescription>Repita a senha para evitar erros de digitação.</FieldDescription>
            </Field>

            {feedback ? (
              <Field>
                <FieldDescription className="rounded-md bg-muted px-4 py-3 text-sm text-emerald-600">
                  {feedback}
                </FieldDescription>
              </Field>
            ) : null}

            {error ? (
              <Field>
                <FieldDescription className="rounded-md bg-muted px-4 py-3 text-sm text-destructive">
                  {error}
                </FieldDescription>
              </Field>
            ) : null}

            <FieldGroup className="pt-2">
              <Field className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Salvando..." : "Criar conta"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignup}
                  disabled={loading}
                  className="flex-1"
                >
                  Entrar com Google
                </Button>
              </Field>

              <FieldDescription className="text-center">
                Já possui cadastro? <a className="underline" href="/login">Acesse sua conta</a>
              </FieldDescription>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

