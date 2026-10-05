export const MAIL_TAG_IDS = [
  "follow-up",
  "waiting",
  "finance",
  "legal",
  "technology",
  "personal",
] as const;

export type MailTag = (typeof MAIL_TAG_IDS)[number];

export const MAIL_TAG_OPTIONS: ReadonlyArray<{ id: MailTag; label: string; flag: string }> = [
  { id: "follow-up", label: "Follow Up", flag: "R3almFollowUp" },
  { id: "waiting", label: "Waiting", flag: "R3almWaiting" },
  { id: "finance", label: "Finance", flag: "R3almFinance" },
  { id: "legal", label: "Legal", flag: "R3almLegal" },
  { id: "technology", label: "Technology", flag: "R3almTechnology" },
  { id: "personal", label: "Personal", flag: "R3almPersonal" },
];

const byId = new Map(MAIL_TAG_OPTIONS.map((tag) => [tag.id, tag]));
const byFlag = new Map(MAIL_TAG_OPTIONS.map((tag) => [tag.flag.toLowerCase(), tag.id]));

export function mailTagFlag(tag: MailTag): string {
  const option = byId.get(tag);
  if (!option) throw new Error("Invalid mail tag");
  return option.flag;
}

export function mailTagLabel(tag: MailTag): string {
  return byId.get(tag)?.label || tag;
}

export function mailTagsFromFlags(flags: readonly string[]): MailTag[] {
  const tags: MailTag[] = [];
  const seen = new Set<MailTag>();
  for (const flag of flags) {
    const tag = byFlag.get(flag.toLowerCase());
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}
