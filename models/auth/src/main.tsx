import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import RequireAuth from "./RequireAuth.tsx"
import SignIn from "./SignIn.tsx"
import Protected from "./Protected.tsx"
import UserInfo from "./UserInfo.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Protected />} />
          <Route path="/user-info" element={<UserInfo />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
