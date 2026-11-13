import { z } from "zod";
import { categories, platforms } from "./onboarding.ts";

export { categories, platforms };
export const uuid = z.string().uuid();
export const deliverable = z.object({
  format: z.string().trim().min(2).max(100),
  quantity: z.coerce.number().int().min(1).max(99),
  acceptance: z.string().trim().min(5).max(1000),
});
export function minorUnits(value: string): number | null {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return amount > 0 && amount <= 100_000_000_000 ? amount : null;
}
/** datetime-local is explicitly Sri Lanka time, irrespective of runtime timezone. */
export function colomboInstant(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+05:30`);
  if (!Number.isFinite(date.getTime())) return null;
  const roundtrip = new Date(date.getTime() + 330 * 60_000)
    .toISOString()
    .slice(0, 16);
  return roundtrip === value ? date.toISOString() : null;
}
export function colomboInput(value: string) {
  return new Date(new Date(value).getTime() + 330 * 60_000)
    .toISOString()
    .slice(0, 16);
}
export const opportunityInput = z
  .object({
    title: z.string().trim().min(5).max(140),
    brief: z.string().trim().min(30).max(6000),
    category: z.enum(categories),
    platforms: z.array(z.enum(platforms)).min(1).max(5),
    deliverables: z.array(deliverable).min(1).max(10),
    budget: z
      .string()
      .refine(
        (value) => minorUnits(value) !== null,
        "Enter a positive LKR amount with at most two decimal places.",
      ),
    application_deadline: z
      .string()
      .refine(
        (value) => colomboInstant(value) !== null,
        "Enter a valid Sri Lanka date and time.",
      ),
    delivery_deadline: z
      .string()
      .refine(
        (value) => colomboInstant(value) !== null,
        "Enter a valid Sri Lanka date and time.",
      ),
    revision_allowance: z.coerce.number().int().min(0).max(5),
    reason: z.string().trim().max(500),
  })
  .superRefine((value, ctx) => {
    const application = colomboInstant(value.application_deadline),
      delivery = colomboInstant(value.delivery_deadline);
    if (application && delivery && delivery <= application)
      ctx.addIssue({
        code: "custom",
        path: ["delivery_deadline"],
        message: "Delivery must follow the application deadline.",
      });
  });
export type OpportunityValues = {
  title: string;
  brief: string;
  category: string;
  platforms: string[];
  deliverables: { format: string; quantity: string; acceptance: string }[];
  budget: string;
  application_deadline: string;
  delivery_deadline: string;
  revision_allowance: string;
  reason: string;
};
export function readOpportunityForm(form: FormData): OpportunityValues {
  const text = (name: string) => String(form.get(name) ?? "");
  const rows = [];
  for (let i = 0; i < 10; i++)
    if (form.has(`deliverables.${i}.format`))
      rows.push({
        format: text(`deliverables.${i}.format`),
        quantity: text(`deliverables.${i}.quantity`),
        acceptance: text(`deliverables.${i}.acceptance`),
      });
  return {
    title: text("title"),
    brief: text("brief"),
    category: text("category"),
    platforms: form.getAll("platforms").map(String),
    deliverables: rows,
    budget: text("budget"),
    application_deadline: text("application_deadline"),
    delivery_deadline: text("delivery_deadline"),
    revision_allowance: text("revision_allowance"),
    reason: text("reason"),
  };
}
export const emptyOpportunity: OpportunityValues = {
  title: "",
  brief: "",
  category: "",
  platforms: [],
  deliverables: [{ format: "", quantity: "1", acceptance: "" }],
  budget: "",
  application_deadline: "",
  delivery_deadline: "",
  revision_allowance: "1",
  reason: "",
};
export type OpportunityFormState = {
  attempt: number;
  values: OpportunityValues;
  errors: Record<string, string>;
  message: string;
};
const https = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Use a complete HTTPS URL.");
export const applicationInput = z.object({
  proposal: z.string().trim().min(20).max(3000),
  work_urls: z.array(https).max(3),
});
export const opportunityRecord = z.object({
  id: uuid,
  brand_id: uuid,
  title: z.string(),
  brief: z.string(),
  category: z.string(),
  platforms: z.array(z.string()),
  deliverables: z.array(deliverable),
  budget_minor: z.number().int(),
  currency: z.literal("LKR"),
  application_deadline: z.string(),
  delivery_deadline: z.string(),
  revision_allowance: z.number().int(),
  status: z.enum(["draft", "open", "closed"]),
  close_reason: z.string().nullable(),
  selection_until: z.string().nullable(),
  published_at: z.string().nullable(),
  hidden_at: z.string().nullable(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  brand_name: z.string().optional(),
});
export type Opportunity = z.infer<typeof opportunityRecord>;
export const memberProfile = z.object({
  id: uuid,
  role: z.enum(["brand", "influencer"]),
  display_name: z.string(),
  description: z.string(),
  location: z.string(),
  categories: z.array(z.string()),
  website: z.string().nullable(),
  links: z.array(
    z.object({
      platform: z.string(),
      url: z.string(),
      follower_count: z.number().nullable(),
      metrics_as_of: z.string().nullable(),
    }),
  ),
});
export type MemberProfile = z.infer<typeof memberProfile>;
export const applicationRecord = z.object({
  id: uuid,
  opportunity_id: uuid,
  influencer_id: uuid,
  proposal: z.string(),
  work_urls: z.array(z.string()),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  profile: memberProfile.nullable().optional(),
  opportunity: opportunityRecord.optional(),
});
export const detailRecord = z.object({
  opportunity: opportunityRecord,
  brand: memberProfile.nullable(),
  applications: z.array(applicationRecord),
  application_count: z.number(),
  collaboration: z
    .object({
      id: uuid,
      status: z.string(),
      agreement_expires_at: z.string(),
      activated_at: z.string().nullable(),
    })
    .nullable(),
  history: z.array(
    z.object({
      version: z.number(),
      reason: z.string(),
      snapshot: opportunityRecord,
      created_at: z.string(),
    }),
  ),
});
export function money(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
  }).format(amount / 100);
}
export function deadline(value: string) {
  return (
    new Intl.DateTimeFormat("en-LK", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Colombo",
    }).format(new Date(value)) + " (Sri Lanka)"
  );
}
export function opportunityValues(o: Opportunity): OpportunityValues {
  return {
    title: o.title,
    brief: o.brief,
    category: o.category,
    platforms: o.platforms,
    deliverables: o.deliverables.map((d) => ({
      ...d,
      quantity: String(d.quantity),
    })),
    budget: (o.budget_minor / 100).toFixed(2),
    application_deadline: colomboInput(o.application_deadline),
    delivery_deadline: colomboInput(o.delivery_deadline),
    revision_allowance: String(o.revision_allowance),
    reason: "",
  };
}
