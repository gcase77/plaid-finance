import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Refine } from "@refinedev/core";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./app/AppRoutes";
import { refineResources } from "./app/resources";
import { AuthSessionProvider } from "./providers/AuthSessionProvider";
import { authProvider } from "./providers/authProvider";
import { dataProvider } from "./providers/dataProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Refine
        authProvider={authProvider}
        dataProvider={dataProvider}
        resources={refineResources}
        options={{
          reactQuery: {
            clientConfig: {
              defaultOptions: {
                queries: {
                  refetchOnWindowFocus: false,
                  refetchOnReconnect: false
                }
              }
            }
          },
          syncWithLocation: true
        }}
      >
        <AuthSessionProvider>
          <AppRoutes />
        </AuthSessionProvider>
      </Refine>
    </BrowserRouter>
  </StrictMode>
);
