import * as React from "react"
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
} from "firebase/auth"
import axios from "axios"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { auth, googleProvider } from "@/lib/firebase"
import { saveSession } from "../utils/sessionStorage"

interface LoginFormProps extends React.ComponentProps<"div"> {
  onSuccess?: () => void
  onGoogleSuccess?: () => void
}

export function LoginForm({ className, onSuccess, onGoogleSuccess, ...props }: LoginFormProps) {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"

  const handleEmailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setFeedback(null)
    setLoading(true)

    try {
      // Passo 1: login no Firebase (gera idToken)
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
      const idToken = await credential.user.getIdToken()

      if (!credential.user.emailVerified) {
        setError("Confirme seu email antes de acessar a plataforma.")
        return
      }

      // Passo 2: informar o backend (gera sessão/token da API)
      const { data } = await axios.post(`${apiBaseUrl}/api/auth/login`, { idToken })

      saveSession({
        token: data.token,
        sessionId: data.sessionId,
        user: data.user,
      })

      setFeedback("Login realizado com sucesso!")
      onSuccess?.()
    } catch (loginError: any) {
      console.error("Erro ao fazer login:", loginError)
      if (loginError.code === "auth/invalid-credential" || loginError.code === "auth/wrong-password") {
        setError("Email ou senha inválidos.")
      } else if (loginError.code === "auth/user-not-found") {
        setError("Usuário não encontrado.")
      } else if (loginError.message) {
        setError(loginError.message)
      } else {
        setError("Erro ao tentar fazer login. Tente novamente.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setError(null)
    setFeedback(null)

    if (!email || !email.includes("@")) {
      setError("Informe um email válido para receber o link de recuperação.")
      return
    }

    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setFeedback("Enviamos um email com instruções para redefinir sua senha.")
    } catch (resetError: any) {
      console.error("Erro ao solicitar recuperação de senha:", resetError)
      setError("Não foi possível enviar o email de recuperação. Tente novamente mais tarde.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError(null)
    setFeedback(null)
    setLoading(true)

    try {
      const credential = await signInWithPopup(auth, googleProvider)
      const idToken = await credential.user.getIdToken()

      const { data } = await axios.post(`${apiBaseUrl}/api/auth/login`, { idToken })

      saveSession({
        token: data.token,
        sessionId: data.sessionId,
        user: data.user,
      })

      setFeedback("Login com Google realizado com sucesso!")
      onGoogleSuccess?.()
    } catch (googleError: any) {
      console.error("Erro no login com Google:", googleError)
      setError("Não foi possível entrar com o Google. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Acesse sua conta</CardTitle>
          <CardDescription>Informe email e senha para entrar.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@exemplo.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Senha</FieldLabel>
                  <button
                    type="button"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    onClick={handleForgotPassword}
                    disabled={loading}
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
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

              <Field className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="flex-1"
                >
                  Entrar com Google
                </Button>
              </Field>

              <FieldDescription className="text-center">
                Ainda não tem conta? <a href="/registro" className="underline">Crie agora</a>
              </FieldDescription>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

