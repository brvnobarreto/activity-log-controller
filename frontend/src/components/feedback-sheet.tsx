/**
 * Sheet reutilizável para supervisores enviarem feedbacks aos fiscais.
 *
 * - Abre via evento global "open-feedback-sheet" emitido pela tela de atividades.
 * - Recebe id da atividade e email do fiscal para atrelar o feedback corretamente.
 * - Se nenhum contexto for informado, bloqueia o envio e orienta o usuário.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/Auth/context/AuthContext"
import { getSessionToken } from "@/Auth/utils/sessionStorage"
import { getStoredUser } from "@/Auth/utils/sessionStorage"
import { buildApiUrl, resolveApiBaseUrl } from "@/lib/api"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

function normalizeRoleValue(value: unknown): string[] {
  if (!value) return []
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    return normalized.length ? [normalized] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeRoleValue(item))
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) => normalizeRoleValue(item))
  }
  return []
}

function userHasRole(
  user: { role?: unknown; perfil?: { role?: unknown } | null; profile?: { role?: unknown } | null; roles?: unknown } | null | undefined,
  role: string,
) {
  const target = role.trim().toLowerCase()
  if (!target.length) return false

  const roleValues = [
    ...normalizeRoleValue(user?.role),
    ...normalizeRoleValue(user?.perfil?.role),
    ...normalizeRoleValue(user?.profile?.role),
    ...normalizeRoleValue(user?.roles),
  ]

  return roleValues.some((value) => value.includes(target))
}

type FeedbackActivityDetail = {
  id?: string | null
  createdBy?: string | null
  nome?: string | null
}

type FeedbackStatus =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string }

type FeedbackSheetProps = {
  showTrigger?: boolean
}

export function FeedbackSheet({ showTrigger = true }: FeedbackSheetProps) {
  const { sessionUser } = useAuth()
  const storedUser = useMemo(
    () =>
      sessionUser ||
      getStoredUser<{
        name?: string
        email?: string
        role?: unknown
        perfil?: { role?: unknown } | null
        profile?: { role?: unknown } | null
        roles?: unknown
      }>(),
    [sessionUser],
  )
  const isSupervisor = userHasRole(storedUser, "supervisor")

  const apiBaseUrl = resolveApiBaseUrl()

  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [status, setStatus] = useState<FeedbackStatus>({ type: "idle" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activityId, setActivityId] = useState<string | null>(null)
  const [activityAuthorEmail, setActivityAuthorEmail] = useState<string | null>(null)
  const [activityAuthorName, setActivityAuthorName] = useState<string | null>(null)
  const [targetEmail, setTargetEmail] = useState<string | null>(null)

  const authorEmail = storedUser?.email ?? "—"
  const authorName = useMemo(() => {
    if (storedUser?.name && storedUser.name.trim().length > 0) {
      return storedUser.name.trim()
    }
    return undefined
  }, [storedUser?.name])

  const resetForm = useCallback(() => {
    setSubject("")
    setContent("")
    setStatus({ type: "idle" })
    setIsSubmitting(false)
    setActivityId(null)
    setActivityAuthorEmail(null)
    setActivityAuthorName(null)
    setTargetEmail(null)
  }, [])

  useEffect(() => {
    function handleExternalOpen(event: Event) {
      const customEvent = event as CustomEvent<{ activity?: FeedbackActivityDetail }>
      const createdBy = customEvent.detail?.activity?.createdBy
      const authorNameFromActivity = customEvent.detail?.activity?.nome
      const activityIdentifier = customEvent.detail?.activity?.id

      if (typeof createdBy === "string" && createdBy.trim().length > 0) {
        const trimmed = createdBy.trim()
        setActivityAuthorEmail(trimmed)
        setTargetEmail(trimmed.toLowerCase())
      } else {
        setActivityAuthorEmail(null)
        setTargetEmail(null)
      }

      if (typeof authorNameFromActivity === "string" && authorNameFromActivity.trim().length > 0) {
        setActivityAuthorName(authorNameFromActivity.trim())
      } else {
        setActivityAuthorName(null)
      }

      if (typeof activityIdentifier === "string" && activityIdentifier.trim().length > 0) {
        setActivityId(activityIdentifier.trim())
      } else {
        setActivityId(null)
      }

      setOpen(true)
    }

    window.addEventListener("open-feedback-sheet", handleExternalOpen)
    return () => {
      window.removeEventListener("open-feedback-sheet", handleExternalOpen)
    }
  }, [])

  const effectiveEmail = activityAuthorEmail ?? authorEmail
  const effectiveName = activityAuthorName ?? authorName

  const handleSubmit = useCallback(async () => {
    if (!isSupervisor) {
      setStatus({ type: "error", message: "Somente supervisores podem enviar feedbacks." })
      return
    }

    const token = getSessionToken()
    if (!token) {
      setStatus({ type: "error", message: "Sessão expirada. Faça login novamente." })
      return
    }

    if (!activityId || !activityId.trim().length || !targetEmail || !targetEmail.trim().length) {
      setStatus({
        type: "error",
        message: "Abra o sheet a partir da atividade para enviar o feedback ao fiscal responsável.",
      })
      return
    }

    const trimmedActivityId = activityId.trim()
    const trimmedTargetEmail = targetEmail.trim().toLowerCase()

    const trimmedContent = content.trim()
    if (!trimmedContent) {
      setStatus({ type: "error", message: "Escreva o feedback antes de enviar." })
      return
    }

    setIsSubmitting(true)
    setStatus({ type: "idle" })

    try {
      // Mantém compatibilidade com o backend que espera HTML para renderizar no modal do fiscal.
      const htmlContent = trimmedContent
        .split("\n")
        .map((line) => line.trim())
        .map((line) => (line.length ? `<p>${line}</p>` : "<p><br /></p>"))
        .join("")

      const { data } = await axios.post(
        buildApiUrl("/api/feedbacks", apiBaseUrl),
        {
          subject: subject.trim() || undefined,
          contentHtml: htmlContent,
          contentText: trimmedContent,
          activityId: trimmedActivityId,
          targetEmail: trimmedTargetEmail,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const feedbackSubject = data?.feedback?.subject
      setStatus({
        type: "success",
        message: feedbackSubject
          ? `Feedback "${feedbackSubject}" registrado e disponível para os fiscais.`
          : "Feedback registrado e disponível para os fiscais.",
      })
      setSubject("")
      setContent("")
    } catch (error) {
      console.error("Erro ao enviar feedback:", error)
      setStatus({
        type: "error",
        message: "Não foi possível enviar o feedback. Tente novamente ou procure o suporte.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [activityId, apiBaseUrl, content, isSupervisor, subject, targetEmail])

  if (!isSupervisor) {
    return null
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          resetForm()
        }
      }}
    >
      {showTrigger && (
        <SheetTrigger asChild>
          <Button variant="outline" className="whitespace-nowrap">
            Feedback
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="flex w-full flex-col gap-6 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Enviar feedback</SheetTitle>
          <SheetDescription>
            O conteúdo ficará vinculado ao seu email institucional e será exibido para os fiscais no menu de ações das
            atividades.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
          <div className="grid gap-2">
            <Label htmlFor="feedback-target">Fiscal responsável</Label>
            <Input
              id="feedback-target"
              value={effectiveName ? `${effectiveName} (${effectiveEmail})` : effectiveEmail}
              readOnly
              className="cursor-not-allowed bg-muted/60 text-sm"
            />
            {!activityId && (
              <p className="text-xs text-destructive">
                Abra o envio de feedback a partir da atividade desejada.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feedback-subject">Assunto</Label>
            <Input
              id="feedback-subject"
              placeholder="Ex: Atualização das atividades da semana"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feedback-content">Mensagem</Label>
            <textarea
              id="feedback-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Escreva o feedback com o resumo das principais observações..."
              className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <SheetFooter className="flex flex-col gap-3 pt-4 mt-2 sm:flex-col">
          <div
            className={cn(
              "flex items-start gap-2 text-sm",
              status.type === "error" && "text-destructive",
              status.type === "success" && "text-emerald-600 dark:text-emerald-400",
              status.type === "idle" && "text-muted-foreground",
            )}
          >
            {status.type === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            {status.type === "error" && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              {status.type === "idle" && "Revise o conteúdo antes de enviar."}
              {status.type === "success" && status.message}
              {status.type === "error" && status.message}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>
              Limpar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !activityId || !targetEmail}>
              {isSubmitting ? "Enviando..." : "Enviar feedback"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

