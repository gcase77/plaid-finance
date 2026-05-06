import { Layout, Menu } from "react-admin";
import HomeIcon from "@mui/icons-material/Home";
import BuildIcon from "@mui/icons-material/Build";
import SecurityIcon from "@mui/icons-material/Security";

const FinanceMenu = () => (
  <Menu>
    <Menu.DashboardItem primaryText="Home" leftIcon={<HomeIcon />} />
    <Menu.ResourceItem name="transactions" />
    <Menu.ResourceItem name="items" />
    <Menu.ResourceItem name="accounts" />
    <Menu.ResourceItem name="tags" />
    <Menu.ResourceItem name="budget_rules" />
    <Menu.Item to="/tools" primaryText="Tools" leftIcon={<BuildIcon />} />
    <Menu.Item to="/account" primaryText="Security" leftIcon={<SecurityIcon />} />
  </Menu>
);

export const FinanceLayout = (props: Parameters<typeof Layout>[0]) => <Layout {...props} menu={FinanceMenu} />;
