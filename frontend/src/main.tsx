import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "leaflet/dist/leaflet.css"
import { RouterProvider } from "react-router-dom"
import { router } from "./App.tsx"
import { AuthProvider } from "./Auth/context/AuthContext"
import { ActivityProvider } from "./context/ActivityContext"

if (import.meta.env.PROD) {
  document.title = "ALC"
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ActivityProvider>
      <RouterProvider router={router} />
      </ActivityProvider>
    </AuthProvider>
  </StrictMode>,
)
