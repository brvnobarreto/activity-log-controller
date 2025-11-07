import { SignupForm } from "../components/SignupForm"

export default function Registro() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-16">
      <div className="mx-auto w-full max-w-xl">
        <SignupForm className="shadow-xl" />
      </div>
    </div>
  )
}