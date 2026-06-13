import { logger } from "../logger";
import { plaid } from "./plaid";

export async function getInstitutionMetadata(institutionId: string | null | undefined) {
  if (!institutionId) return null;
  try {
    const req = { institution_id: institutionId, country_codes: ["US"], options: { include_optional_metadata: true } };
    const { data } = await plaid.institutionsGetById(req as any);
    logger.log("info", "plaid institutionsGetById", { input: req, output: data });
    return data.institution;
  } catch (e: any) {
    logger.log("error", "plaid institutionsGetById failed", { institutionId, err: e.response?.data || e.message });
    return null;
  }
}
