import { createBrowserRouter } from "react-router-dom"
import AppLayout from "./AppLayout"
import Dashboard from "./Telas/Dashboard"
import Funcionario from "./Telas/Funcionario"
import Relatorios from "./Telas/Relatorios"
import Campus from "./Telas/Campus"
import Fiscal from "./Telas/Fiscal"
import Registro from "./Auth/Telas/Registro"
import Login from "./Auth/Telas/Login"
import { ProtectedRoute } from "./Auth/components/ProtectedRoute"

export const router = createBrowserRouter([
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <Dashboard /> },
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/fiscal", element: <Fiscal /> },
          { path: "/funcionario", element: <Funcionario /> },
          { path: "/relatorios", element: <Relatorios /> },
          { path: "/campus", element: <Campus /> },
        ],
      },
    ],
  },
  { path: "/login", element: <Login /> },
  { path: "/registro", element: <Registro /> },
]);