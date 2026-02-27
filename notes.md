# plaid-finance


| File                                                        | Supabase client methods                                                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [src/hooks/useAuth.ts](src/hooks/useAuth.ts)                | `createClient()`, `auth.onAuthStateChange()`, `auth.getSession()`, `auth.signInWithPassword()`, `auth.signUp()`, `auth.signOut()` |
| [server/middleware/auth.ts](server/middleware/auth.ts)      | `createClient()`, `auth.getUser(token)`                                                                                           |


---

# supabase-auth-template


| File                                                                              | Supabase client methods                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------ |
| [lib/supabase/client.ts](tests/supabase-auth-template/lib/supabase/client.ts)     | `createBrowserClient`                            |
| [lib/supabase/server.ts](tests/supabase-auth-template/lib/supabase/server.ts)     | `createServerClient`                             |
| [lib/supabase/proxy.ts](tests/supabase-auth-template/lib/supabase/proxy.ts)       | `createServerClient`, `auth.getClaims()`         |
| [components/auth-button.tsx](tests/supabase-auth-template/components/auth-button.tsx) | `createClient()`, `auth.getClaims()`             |
| [components/login-form.tsx](tests/supabase-auth-template/components/login-form.tsx) | `createClient()`, `auth.signInWithPassword()`    |
| [components/logout-button.tsx](tests/supabase-auth-template/components/logout-button.tsx) | `createClient()`, `auth.signOut()`               |
| [components/sign-up-form.tsx](tests/supabase-auth-template/components/sign-up-form.tsx) | `createClient()`, `auth.signUp()`                |
| [components/forgot-password-form.tsx](tests/supabase-auth-template/components/forgot-password-form.tsx) | `createClient()`, `auth.resetPasswordForEmail()` |
| [components/update-password-form.tsx](tests/supabase-auth-template/components/update-password-form.tsx) | `createClient()`, `auth.updateUser()`            |
| [app/auth/confirm/route.ts](tests/supabase-auth-template/app/auth/confirm/route.ts) | `createClient()`, `auth.verifyOtp()`             |
| [app/protected/page.tsx](tests/supabase-auth-template/app/protected/page.tsx)     | `createClient()`, `auth.getClaims()`             |


---

# models/auth


| File                                                                 | Supabase client methods     |
| -------------------------------------------------------------------- | --------------------------- |
| [src/AppShell.tsx](tests/models/auth/src/AppShell.tsx)               | `createClient()`            |
| [src/ProtectedRoute.tsx](tests/models/auth/src/ProtectedRoute.tsx)  | `auth.getSession()`         |
| [src/LoginPage.tsx](tests/models/auth/src/LoginPage.tsx)            | `auth.signInWithPassword()` |


---

# password-based-auth-react


| File                                                                                     | Supabase client methods                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [src/lib/client.ts](tests/password-based-auth-react/src/lib/client.ts)                   | `createClient` (from `@supabase/supabase-js`)    |
| [src/components/login-form.tsx](tests/password-based-auth-react/src/components/login-form.tsx) | `createClient()`, `auth.signInWithPassword()`    |
| [src/components/sign-up-form.tsx](tests/password-based-auth-react/src/components/sign-up-form.tsx) | `createClient()`, `auth.signUp()`                |
| [src/components/forgot-password-form.tsx](tests/password-based-auth-react/src/components/forgot-password-form.tsx) | `createClient()`, `auth.resetPasswordForEmail()` |
| [src/components/update-password-form.tsx](tests/password-based-auth-react/src/components/update-password-form.tsx) | `createClient()`, `auth.updateUser()`            |


---

# social-auth-react


| File                                                                     | Supabase client methods                       |
| ------------------------------------------------------------------------ | --------------------------------------------- |
| [src/lib/client.ts](tests/social-auth-react/src/lib/client.ts)           | `createClient` (from `@supabase/supabase-js`) |
| [src/components/login-form.tsx](tests/social-auth-react/src/components/login-form.tsx) | `createClient()`, `auth.signInWithOAuth()`    |



# Goal 2-20
Secure an entire webpage behind a supabase auth gateway. If a user is logged in, they have full access. If not, they are stopped at the sign in gateway. 