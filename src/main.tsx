import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import RequireAuth from "./components/RequireAuth";
import SignIn from "./components/SignIn";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<AppShell />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
