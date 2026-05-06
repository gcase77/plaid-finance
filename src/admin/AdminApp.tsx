import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CategoryIcon from "@mui/icons-material/Category";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import RuleIcon from "@mui/icons-material/Rule";
import SecurityIcon from "@mui/icons-material/Security";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Admin,
  CustomRoutes,
  Layout,
  Menu,
  Resource,
  type LayoutProps
} from "react-admin";
import { Route } from "react-router-dom";
import AuthPage from "../components/auth/AuthPage";
import SecurityPage from "../components/auth/SecurityPage";
import { LandingPage } from "../components/landing/LandingPage";
import { PrivacyPolicyPage, TermsPage } from "../components/legal/LegalDocumentPage";
import MainPage from "../components/main/MainPage";
import NotFoundPage from "../components/NotFoundPage";
import ToolsPage from "../components/tools/ToolsPage";
import TransactionsPage from "../components/transactions/TransactionsPage";
import { authProvider } from "./authProvider";
import { dataProvider } from "./dataProvider";
import {
  AccountList,
  AccountShow,
  BudgetRuleCreate,
  BudgetRuleEdit,
  BudgetRuleList,
  ItemList,
  ItemShow,
  TagCreate,
  TagList,
  TransactionList,
  TransactionShow
} from "./resources";

const FundsUpMenu = () => (
  <Menu>
    <Menu.DashboardItem primaryText="Home" leftIcon={<DashboardIcon />} />
    <Menu.ResourceItem name="transactions" />
    <Menu.ResourceItem name="accounts" />
    <Menu.ResourceItem name="items" />
    <Menu.ResourceItem name="tags" />
    <Menu.ResourceItem name="budget_rules" />
    <Menu.Item to="/transactions-panel" primaryText="Classic transactions" leftIcon={<ReceiptLongIcon />} />
    <Menu.Item to="/tools" primaryText="Tools" leftIcon={<SettingsIcon />} />
    <Menu.Item to="/account" primaryText="Security" leftIcon={<SecurityIcon />} />
  </Menu>
);

const FundsUpLayout = (props: LayoutProps) => <Layout {...props} menu={FundsUpMenu} />;

const LoginPage = () => <AuthPage mode="signIn" />;

export default function AdminApp() {
  return (
    <Admin
      title="Funds Up"
      dashboard={MainPage}
      authProvider={authProvider}
      dataProvider={dataProvider}
      layout={FundsUpLayout}
      loginPage={LoginPage}
      requireAuth
    >
      <Resource
        name="transactions"
        icon={ReceiptLongIcon}
        list={TransactionList}
        show={TransactionShow}
        options={{ label: "Transactions" }}
      />
      <Resource
        name="accounts"
        icon={AccountBalanceIcon}
        list={AccountList}
        show={AccountShow}
        options={{ label: "Accounts" }}
      />
      <Resource
        name="items"
        icon={AccountTreeIcon}
        list={ItemList}
        show={ItemShow}
        options={{ label: "Institutions" }}
      />
      <Resource
        name="tags"
        icon={CategoryIcon}
        list={TagList}
        create={TagCreate}
        options={{ label: "Tags" }}
      />
      <Resource
        name="budget_rules"
        icon={RuleIcon}
        list={BudgetRuleList}
        create={BudgetRuleCreate}
        edit={BudgetRuleEdit}
        options={{ label: "Budget rules" }}
      />

      <CustomRoutes>
        <Route path="/transactions-panel" element={<TransactionsPage />} />
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
