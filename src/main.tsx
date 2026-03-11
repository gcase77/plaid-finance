import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import AuthPage from "./components/auth/AuthPage";
import RequireAuth from "./components/auth/RequireAuth";
import MainPage from "./components/main/MainPage";
import ToolsPage from "./components/tools/ToolsPage";
import TransactionsPage from "./components/transactions/TransactionsPage";
import { queryClient } from "./lib/queryClient";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage mode="signIn" />} />
          <Route path="/auth/sign-up" element={<AuthPage mode="signUp" />} />
          <Route path="/auth/forgot-password" element={<AuthPage mode="forgotPassword" />} />
          <Route path="/auth/reset-password" element={<AuthPage mode="resetPassword" />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<MainPage />} />
              <Route path="/main" element={<Navigate to="/" replace />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/tools" element={<ToolsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
