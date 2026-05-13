import { getDisplayTagColor, getTextColorForBackground } from "../../utils/transactionUtils";
import type { Tag } from "../types";

export function TagBadge({ tag }: { tag: Tag }) {
  const color = getDisplayTagColor(tag.type, tag.color);
  return <span className="tag-badge" style={{ background: color, color: getTextColorForBackground(color) }}>{tag.name}</span>;
}
