import { LoginForm } from "../components/LoginForm"

export default function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-16">
      <div className="mx-auto w-full max-w-xl">
        <LoginForm className="shadow-xl" />
      </div>
    </div>
  )
}