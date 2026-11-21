import { z } from "zod";

export const portfolioSlug = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/,
    "Use 3–40 lowercase letters, digits or hyphens, starting and ending with a letter or digit.",
  );
/** Same deliberately bounded HTTPS grammar as the database; no external fetch. */
export function portfolioUrl(value: string): boolean {
  if (
    !/^https:\/\/[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?(:[0-9]{1,5})?([/?#][^\s\\]*)?$/.test(
      value,
    ) ||
    /%(0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)
  )
    return false;
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      (!url.port || (Number(url.port) >= 1 && Number(url.port) <= 65535))
    );
  } catch {
    return false;
  }
}
const workDraft = z
  .object({
    title: z.string().trim().max(100),
    description: z.string().trim().max(300),
    url: z
      .string()
      .trim()
      .max(2048)
      .refine(
        (value) => value === "" || portfolioUrl(value),
        "Use an HTTPS URL without credentials, spaces or encoded control characters.",
      ),
  })
  .strict();
export const portfolioDraft = z
  .object({
    display_name: z.string().trim().max(80),
    headline: z.string().trim().max(140),
    about: z.string().trim().max(2000),
    works: z.array(workDraft).max(6),
  })
  .strict();
export const portfolioContent = portfolioDraft.extend({
  display_name: z
    .string()
    .trim()
    .min(2, "Choose a public name (2–80 characters).")
    .max(80),
  headline: z
    .string()
    .trim()
    .min(5, "Add a headline (5–140 characters).")
    .max(140),
  about: z
    .string()
    .trim()
    .min(20, "Add an introduction (20–2000 characters).")
    .max(2000),
  works: z
    .array(
      workDraft.extend({
        title: z
          .string()
          .trim()
          .min(2, "Add a work title (2–100 characters).")
          .max(100),
        url: z
          .string()
          .trim()
          .min(1, "Add an HTTPS work link.")
          .max(2048)
          .refine(portfolioUrl, "Use a valid HTTPS work link."),
      }),
    )
    .min(1, "Add at least one work link before publishing.")
    .max(6),
});
export const portfolioOwner = z
  .object({
    slug: z.union([z.literal(""), portfolioSlug]),
    revision: z.number().int().nonnegative(),
    slug_locked: z.boolean(),
    published: z.boolean(),
    published_content: portfolioContent.nullable(),
    draft: portfolioDraft,
  })
  .strict();
export type PortfolioContent = z.infer<typeof portfolioDraft>;
export type PortfolioOwner = z.infer<typeof portfolioOwner>;
export type PortfolioValues = PortfolioContent & { slug: string };
export function portfolioValues(owner: PortfolioOwner): PortfolioValues {
  return { slug: owner.slug, ...owner.draft };
}
export function readPortfolioForm(form: FormData): PortfolioValues {
  const text = (name: string, limit: number) => {
    const value = form.get(name);
    return typeof value === "string" ? value.slice(0, limit + 1) : "";
  };
  const works = [];
  // Seventh row is an overflow sentinel, never silently discard a forged row.
  for (let i = 0; i < 7; i++)
    if (form.has(`works.${i}.title`) || form.has(`works.${i}.url`)) {
      works.push({
        title: text(`works.${i}.title`, 100),
        description: text(`works.${i}.description`, 300),
        url: text(`works.${i}.url`, 2048),
      });
    }
  return {
    slug: text("slug", 40),
    display_name: text("display_name", 80),
    headline: text("headline", 140),
    about: text("about", 2000),
    works,
  };
}
