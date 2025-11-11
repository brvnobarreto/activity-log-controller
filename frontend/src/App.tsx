import { createBrowserRouter, Navigate } from "react-router-dom"
import AppLayout from "./AppLayout"
import Dashboard from "./Telas/Dashboard"
import Funcionario from "./Telas/Funcionario"
import Relatorios from "./Telas/Relatorios"
import Campus from "./Telas/Campus"
import Registro from "./Auth/Telas/Registro"
import Login from "./Auth/Telas/Login"
import { ProtectedRoute } from "./Auth/components/ProtectedRoute"

export const router = createBrowserRouter(
  [
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <AppLayout />,
          children: [
            { path: "/", element: <Dashboard /> },
            { path: "/dashboard", element: <Dashboard /> },
            // Deep links para Atividades
            { path: "/atividades", element: <Dashboard /> },
            { path: "/atividades/nova", element: <Dashboard /> },
            { path: "/funcionario", element: <Funcionario /> },
            { path: "/relatorios", element: <Relatorios /> },
            { path: "/campus", element: <Campus /> },
            // Catch-all: redireciona rotas não encontradas para o dashboard
            { path: "*", element: <Navigate to="/dashboard" replace /> },
          ],
        },
      ],
    },
    { path: "/login", element: <Login /> },
    { path: "/registro", element: <Registro /> },
    // Catch-all para rotas públicas não encontradas
    { path: "*", element: <Navigate to="/login" replace /> },
  ],
  {
    // Garante consistência entre DEV e PROD quando o app é servido em subcaminhos
    basename: import.meta.env.BASE_URL,
  }
);