import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import HomeRoute from "./components/HomeRoute";
import TransactionsRoute from "./components/TransactionsRoute";
import AuthPage from "./components/auth/AuthPage";
import RequireAuth from "./components/auth/RequireAuth";
import { AuthProvider } from "./contexts/AuthContext";
import { queryClient } from "./lib/queryClient";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage mode="signIn" />} />
            <Route path="/auth/sign-up" element={<AuthPage mode="signUp" />} />
            <Route path="/auth/forgot-password" element={<AuthPage mode="forgotPassword" />} />
            <Route path="/auth/reset-password" element={<AuthPage mode="resetPassword" />} />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<AppShell />}>
                <Route index element={<Navigate to="/home" replace />} />
                <Route path="home" element={<HomeRoute />} />
                <Route path="transactions" element={<TransactionsRoute />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
