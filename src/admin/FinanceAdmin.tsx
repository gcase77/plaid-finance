import { Admin, CustomRoutes, Resource } from "react-admin";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CategoryIcon from "@mui/icons-material/Category";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SavingsIcon from "@mui/icons-material/Savings";
import { Route } from "react-router-dom";
import AuthPage from "../components/auth/AuthPage";
import SecurityPage from "../components/auth/SecurityPage";
import { LandingPage } from "../components/landing/LandingPage";
import { PrivacyPolicyPage, TermsPage } from "../components/legal/LegalDocumentPage";
import MainPage from "../components/main/MainPage";
import NotFoundPage from "../components/NotFoundPage";
import ToolsPage from "../components/tools/ToolsPage";
import { authProvider } from "./authProvider";
import { dataProvider } from "./dataProvider";
import { FinanceLayout } from "./Layout";
import {
  AccountList,
  BudgetRuleCreate,
  BudgetRuleEdit,
  BudgetRuleList,
  ItemList,
  TagCreate,
  TagList,
  TransactionList,
  TransactionShow
} from "./resources";

const AuthLoginPage = () => <AuthPage mode="signIn" />;

export default function FinanceAdmin() {
  return (
    <Admin
      title="Funds Up"
      dashboard={MainPage}
      dataProvider={dataProvider}
      authProvider={authProvider}
      layout={FinanceLayout}
      loginPage={AuthLoginPage}
      requireAuth
    >
      <Resource name="transactions" list={TransactionList} show={TransactionShow} icon={ReceiptLongIcon} />
      <Resource name="items" list={ItemList} icon={AccountBalanceIcon} />
      <Resource name="accounts" list={AccountList} icon={SavingsIcon} />
      <Resource name="tags" list={TagList} create={TagCreate} icon={CategoryIcon} />
      <Resource name="budget_rules" list={BudgetRuleList} create={BudgetRuleCreate} edit={BudgetRuleEdit} icon={AccountTreeIcon} options={{ label: "Budget Rules" }} />
      <CustomRoutes>
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/account" element={<SecurityPage />} />
        <Route path="/plaid-oauth-redirect" element={<MainPage />} />
      </CustomRoutes>
      <CustomRoutes noLayout>
        <Route path="/l" element={<LandingPage />} />
        <Route path="/l/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/auth" element={<AuthPage mode="signIn" />} />
        <Route path="/auth/sign-up" element={<AuthPage mode="signUp" />} />
        <Route path="/auth/forgot-password" element={<AuthPage mode="forgotPassword" />} />
        <Route path="/auth/reset-password" element={<AuthPage mode="resetPassword" />} />
        <Route path="*" element={<NotFoundPage />} />
      </CustomRoutes>
    </Admin>
  );
}
