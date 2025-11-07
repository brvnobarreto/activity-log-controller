import { useNavigate, useLocation } from "react-router-dom"

import { LoginForm } from "../components/LoginForm"

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from?.pathname || "/"

  const handleSuccess = () => {
    navigate(from, { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-16">
      <div className="mx-auto w-full max-w-xl">
        <LoginForm className="shadow-xl" onSuccess={handleSuccess} onGoogleSuccess={handleSuccess} />
      </div>
    </div>
  )
}