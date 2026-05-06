import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./AppRoutes";
import { resources } from "./resources";
import { AppAuthProvider } from "../providers/AuthProvider";
import { Refine } from "../providers/RefineProvider";
import { queryClient } from "../lib/queryClient";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppAuthProvider>
        <Refine resources={resources}>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </Refine>
      </AppAuthProvider>
    </QueryClientProvider>
  );
}
