import {
  Create,
  Datagrid,
  DateField,
  DateInput,
  DeleteButton,
  Edit,
  EditButton,
  List,
  NumberField,
  NumberInput,
  SelectInput,
  Show,
  SimpleForm,
  SimpleShowLayout,
  TextField,
  TextInput,
  TopToolbar,
  useNotify,
  useRefresh
} from "react-admin";
import { Button } from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import { buildAuthHeaders } from "../lib/auth";
import { supabase } from "../lib/supabase";

const currency = { style: "currency", currency: "USD" } as const;
const tagTypes = [
  { id: "income_bucket_1", name: "Income Bucket 1" },
  { id: "income_bucket_2", name: "Income Bucket 2" },
  { id: "spending_bucket_1", name: "Spending Bucket 1" },
  { id: "spending_bucket_2", name: "Spending Bucket 2" },
  { id: "meta", name: "Meta" }
];
const budgetTypes = [
  { id: "flat_rate", name: "Flat Rate" },
  { id: "percent_of_income", name: "Percent Of Income" }
];
const ruleSourceTypes = [
  { id: "tag", name: "Tag" },
  { id: "detected_category", name: "Detected Category" }
];
const calendarWindows = [
  { id: "week", name: "Week" },
  { id: "month", name: "Month" }
];
const rolloverOptions = [
  { id: "none", name: "None" },
  { id: "surplus", name: "Surplus" },
  { id: "deficit", name: "Deficit" },
  { id: "both", name: "Both" }
];

const SyncTransactionsButton = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const sync = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/transactions/sync", {
        method: "POST",
        headers: buildAuthHeaders(data.session?.access_token ?? null)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Sync failed (${response.status})`);
      notify(`${payload.modified || 0} modified, ${payload.added || 0} added, ${payload.removed || 0} removed`, { type: "success" });
      refresh();
    } catch (error) {
      notify((error as Error).message, { type: "error" });
    }
  };
  return <Button startIcon={<SyncIcon />} onClick={sync}>Sync</Button>;
};

const TransactionActions = () => (
  <TopToolbar>
    <SyncTransactionsButton />
  </TopToolbar>
);

export const TransactionList = () => (
  <List actions={<TransactionActions />} perPage={25} sort={{ field: "date", order: "DESC" }}>
    <Datagrid bulkActionButtons={false} rowClick="show">
      <TextField source="name" />
      <TextField source="merchant_name" />
      <NumberField source="amount" options={currency} />
      <DateField source="date" />
      <TextField source="category" />
      <TextField source="account_id" />
      <TextField source="pending" />
      <TextField source="removed" />
    </Datagrid>
  </List>
);

export const TransactionShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <TextField source="transaction_id" />
      <TextField source="name" />
      <TextField source="merchant_name" />
      <NumberField source="amount" options={currency} />
      <DateField source="date" />
      <TextField source="category" />
      <TextField source="account_id" />
      <TextField source="iso_currency_code" />
      <TextField source="pending" />
      <TextField source="removed" />
    </SimpleShowLayout>
  </Show>
);

export const ItemList = () => (
  <List perPage={25}>
    <Datagrid bulkActionButtons={false}>
      <TextField source="institution_name" />
      <TextField source="id" />
      <DeleteButton mutationMode="pessimistic" />
    </Datagrid>
  </List>
);

export const AccountList = () => (
  <List perPage={25}>
    <Datagrid bulkActionButtons={false}>
      <TextField source="name" />
      <TextField source="official_name" />
      <TextField source="institution_name" />
      <TextField source="item_id" />
      <TextField source="type" />
      <TextField source="subtype" />
    </Datagrid>
  </List>
);

export const TagList = () => (
  <List perPage={25}>
    <Datagrid bulkActionButtons={false}>
      <TextField source="name" />
      <TextField source="type" />
      <TextField source="color" />
      <DeleteButton mutationMode="pessimistic" />
    </Datagrid>
  </List>
);

export const TagCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="name" required />
      <SelectInput source="type" choices={tagTypes} required />
      <TextInput source="color" />
    </SimpleForm>
  </Create>
);

export const BudgetRuleList = () => (
  <List perPage={25}>
    <Datagrid bulkActionButtons={false}>
      <TextField source="name" />
      <TextField source="tag_id" />
      <TextField source="type" />
      <NumberField source="flat_amount" options={currency} />
      <NumberField source="percent" />
      <DateField source="start_date" />
      <TextField source="calendar_window" />
      <EditButton />
      <DeleteButton mutationMode="pessimistic" />
    </Datagrid>
  </List>
);

export const BudgetRuleCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="name" required />
      <SelectInput source="rule_source_type" choices={ruleSourceTypes} defaultValue="tag" required />
      <TextInput source="tag_id" />
      <TextInput source="detected_category" />
      <DateInput source="start_date" required />
      <SelectInput source="type" choices={budgetTypes} required />
      <NumberInput source="flat_amount" />
      <NumberInput source="percent" />
      <SelectInput source="calendar_window" choices={calendarWindows} defaultValue="month" required />
      <SelectInput source="rollover_options" choices={rolloverOptions} defaultValue="none" required />
    </SimpleForm>
  </Create>
);

export const BudgetRuleEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="name" />
      <SelectInput source="rule_source_type" choices={ruleSourceTypes} />
      <TextInput source="tag_id" />
      <TextInput source="detected_category" />
      <DateInput source="start_date" />
      <SelectInput source="type" choices={budgetTypes} />
      <NumberInput source="flat_amount" />
      <NumberInput source="percent" />
      <SelectInput source="calendar_window" choices={calendarWindows} />
      <SelectInput source="rollover_options" choices={rolloverOptions} />
    </SimpleForm>
  </Edit>
);
