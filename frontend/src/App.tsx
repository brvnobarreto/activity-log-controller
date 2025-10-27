import { createBrowserRouter } from "react-router-dom"
import AppLayout from "./AppLayout"
import Dashboard from "./Telas/Dashboard"
import Funcionario from "./Telas/Funcionario"
import Relatorios from "./Telas/Relatorios"
import Campus from "./Telas/Campus"
import Registro from "./Auth/Telas/Registro"
import Login from "./Auth/Telas/Login"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "funcionario", element: <Funcionario /> },
      { path: "relatorios", element: <Relatorios /> },
      { path: "campus", element: <Campus /> },
    ],
  },
  { path: "/login", element: <Login /> },
  { path: "/registro", element: <Registro /> },
]);