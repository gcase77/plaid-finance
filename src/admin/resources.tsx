import {
  BooleanField,
  Button,
  Create,
  Datagrid,
  DateField,
  DateInput,
  DeleteButton,
  Edit,
  EditButton,
  FunctionField,
  List,
  NumberField,
  NumberInput,
  SelectInput,
  Show,
  ShowButton,
  SimpleForm,
  SimpleShowLayout,
  TextField,
  TextInput,
  TopToolbar,
  useNotify,
  useRefresh
} from "react-admin";
import { apiAction } from "./dataProvider";

const tagTypes = [
  { id: "income_bucket_1", name: "Income bucket 1" },
  { id: "income_bucket_2", name: "Income bucket 2" },
  { id: "spending_bucket_1", name: "Spending bucket 1" },
  { id: "spending_bucket_2", name: "Spending bucket 2" },
  { id: "meta", name: "Meta" }
];

const tagColors = [
  "#e63946", "#ff6b35", "#ffbe0b", "#2a9d8f", "#00a6fb", "#4361ee",
  "#7209b7", "#b5179e", "#f15bb5", "#8ac926", "#198754", "#6c757d"
].map((color) => ({ id: color, name: color }));

const budgetRuleTypes = [
  { id: "flat_rate", name: "Flat rate" },
  { id: "percent_of_income", name: "Percent of income" }
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

const TransactionActions = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const sync = async () => {
    try {
      const result = await apiAction<{ added?: number; modified?: number; removed?: number }>("transactions/sync", { method: "POST" });
      notify(`${result.modified || 0} modified, ${result.added || 0} added, ${result.removed || 0} removed`, { type: "success" });
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Transaction sync failed", { type: "error" });
    }
  };

  return (
    <TopToolbar>
      <Button label="Sync transactions" onClick={sync} />
    </TopToolbar>
  );
};

export const ItemList = () => (
  <List perPage={25} sort={{ field: "institution_name", order: "ASC" }}>
    <Datagrid rowClick="show" bulkActionButtons={false}>
      <TextField source="id" />
      <TextField source="institution_name" label="Institution" />
      <DateField source="created_at" showTime />
      <ShowButton />
      <DeleteButton mutationMode="pessimistic" />
    </Datagrid>
  </List>
);

export const ItemShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <TextField source="institution_name" />
      <DateField source="created_at" showTime />
    </SimpleShowLayout>
  </Show>
);

export const AccountList = () => (
  <List perPage={25} sort={{ field: "name", order: "ASC" }}>
    <Datagrid rowClick="show" bulkActionButtons={false}>
      <TextField source="name" />
      <TextField source="official_name" />
      <TextField source="institution_name" />
      <TextField source="type" />
      <TextField source="subtype" />
      <TextField source="mask" />
      <ShowButton />
    </Datagrid>
  </List>
);

export const AccountShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <TextField source="name" />
      <TextField source="official_name" />
      <TextField source="institution_name" />
      <TextField source="type" />
      <TextField source="subtype" />
      <TextField source="mask" />
      <TextField source="holder_category" />
    </SimpleShowLayout>
  </Show>
);

export const TransactionList = () => (
  <List actions={<TransactionActions />} perPage={25} sort={{ field: "datetime", order: "DESC" }}>
    <Datagrid rowClick="show" bulkActionButtons={false}>
      <DateField source="datetime" showTime />
      <TextField source="name" />
      <TextField source="merchant_name" />
      <TextField source="account_name" />
      <TextField source="institution_name" />
      <NumberField source="amount" />
      <TextField source="iso_currency_code" />
      <BooleanField source="pending" />
      <ShowButton />
    </Datagrid>
  </List>
);

export const TransactionShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="transaction_id" />
      <TextField source="name" />
      <TextField source="original_description" />
      <TextField source="merchant_name" />
      <NumberField source="amount" />
      <TextField source="iso_currency_code" />
      <DateField source="datetime" showTime />
      <DateField source="authorized_datetime" showTime />
      <BooleanField source="pending" />
      <BooleanField source="is_removed" />
      <TextField source="account_name" />
      <TextField source="institution_name" />
      <FunctionField label="Category" render={(record) => record?.personal_finance_category?.primary ?? ""} />
    </SimpleShowLayout>
  </Show>
);

export const TagList = () => (
  <List perPage={25} sort={{ field: "name", order: "ASC" }}>
    <Datagrid rowClick={false} bulkActionButtons={false}>
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
      <SelectInput source="color" choices={tagColors} />
    </SimpleForm>
  </Create>
);

export const BudgetRuleList = () => (
  <List perPage={25} sort={{ field: "name", order: "ASC" }}>
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      <TextField source="name" />
      <TextField source="rule_source_type" />
      <NumberField source="tag_id" />
      <TextField source="detected_category" />
      <TextField source="type" />
      <NumberField source="flat_amount" />
      <NumberField source="percent" />
      <TextField source="calendar_window" />
      <TextField source="rollover_options" />
      <EditButton />
      <DeleteButton mutationMode="pessimistic" />
    </Datagrid>
  </List>
);

export const BudgetRuleEdit = () => (
  <Edit mutationMode="pessimistic">
    <SimpleForm>
      <TextInput source="name" required />
      <DateInput source="start_date" required />
      <SelectInput source="type" choices={budgetRuleTypes} required />
      <NumberInput source="flat_amount" />
      <NumberInput source="percent" />
      <SelectInput source="calendar_window" choices={calendarWindows} required />
      <SelectInput source="rollover_options" choices={rolloverOptions} required />
    </SimpleForm>
  </Edit>
);

export const BudgetRuleCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="name" required />
      <NumberInput source="tag_id" />
      <TextInput source="detected_category" />
      <DateInput source="start_date" required />
      <SelectInput source="type" choices={budgetRuleTypes} required />
      <NumberInput source="flat_amount" />
      <NumberInput source="percent" />
      <SelectInput source="calendar_window" choices={calendarWindows} defaultValue="month" required />
      <SelectInput source="rollover_options" choices={rolloverOptions} defaultValue="none" required />
    </SimpleForm>
  </Create>
);
