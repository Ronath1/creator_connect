import { z } from "zod";

export const categories = [
  "Beauty",
  "Fashion",
  "Food & drink",
  "Lifestyle",
  "Travel",
  "Technology",
  "Fitness",
  "Other",
] as const;
export const platforms = [
  "Instagram",
  "YouTube",
  "TikTok",
  "Facebook",
  "X",
] as const;
const hosts: Record<(typeof platforms)[number], string[]> = {
  Instagram: ["instagram.com", "www.instagram.com"],
  YouTube: ["youtube.com", "www.youtube.com", "m.youtube.com"],
  TikTok: ["tiktok.com", "www.tiktok.com"],
  Facebook: ["facebook.com", "www.facebook.com", "m.facebook.com"],
  X: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
};

function httpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

const socialLink = z
  .object({
    platform: z.enum(platforms),
    url: z
      .string()
      .trim()
      .max(2048)
      .refine(httpsUrl, "Enter a complete HTTPS profile URL."),
    follower_count: z.number().int().min(0).max(10_000_000_000).nullable(),
    metrics_as_of: z.string().nullable(),
  })
  .superRefine((value, context) => {
    if (httpsUrl(value.url)) {
      const url = new URL(value.url);
      if (
        !hosts[value.platform].includes(url.host.toLowerCase()) ||
        url.pathname === "/"
      )
        context.addIssue({
          code: "custom",
          path: ["url"],
          message: "Use a profile URL on the selected platform.",
        });
    }
    if (value.follower_count !== null && !value.metrics_as_of)
      context.addIssue({
        code: "custom",
        path: ["metrics_as_of"],
        message: "Add the date for this self-reported count.",
      });
    if (
      value.metrics_as_of &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value.metrics_as_of) ||
        !Number.isFinite(Date.parse(value.metrics_as_of)) ||
        new Date(value.metrics_as_of).toISOString().slice(0, 10) !==
          value.metrics_as_of ||
        value.metrics_as_of > new Date().toISOString().slice(0, 10))
    )
      context.addIssue({
        code: "custom",
        path: ["metrics_as_of"],
        message: "Use a valid date today or earlier.",
      });
  });

const base = {
  display_name: z
    .string()
    .trim()
    .min(2, "Enter at least 2 characters.")
    .max(100, "Use 100 characters or fewer."),
  description: z
    .string()
    .trim()
    .min(20, "Tell us a little more: at least 20 characters.")
    .max(2000, "Use 2,000 characters or fewer."),
  location: z
    .string()
    .trim()
    .min(2, "Enter your Sri Lankan city or district.")
    .max(100),
  categories: z
    .array(z.enum(categories))
    .min(1, "Choose at least one category.")
    .max(5, "Choose up to five categories."),
};

export const brandOnboarding = z.object({
  ...base,
  website: z
    .string()
    .trim()
    .max(2048)
    .refine(
      (value) => !value || httpsUrl(value),
      "Use an HTTPS website URL or leave this blank.",
    ),
});
export const influencerOnboarding = z
  .object({
    ...base,
    links: z
      .array(socialLink)
      .min(1, "Add at least one social profile.")
      .max(5),
  })
  .superRefine((value, context) => {
    if (
      new Set(value.links.map((link) => link.platform)).size !==
      value.links.length
    )
      context.addIssue({
        code: "custom",
        path: ["links"],
        message: "Add one profile per platform.",
      });
  });

export type SocialLink = z.infer<typeof socialLink>;
export type OnboardingValues = {
  display_name: string;
  description: string;
  location: string;
  categories: string[];
  website: string;
  links: SocialLink[];
};
export type OnboardingState = {
  message: string;
  errors: Record<string, string>;
  values: OnboardingValues;
};

/** Deliberate field allowlist: role, identity and membership never come from forms. */
export function readOnboardingForm(form: FormData): OnboardingValues {
  const string = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.slice(0, 4096) : "";
  };
  const links: SocialLink[] = [];
  for (let index = 0; index < 5; index++) {
    const platform = string(`platform_${index}`);
    const url = string(`url_${index}`);
    const count = string(`count_${index}`);
    const date = string(`date_${index}`);
    if (form.has(`platform_${index}`))
      links.push({
        platform: platform as SocialLink["platform"],
        url,
        follower_count: count.trim() === "" ? null : Number(count),
        metrics_as_of: date || null,
      });
  }
  return {
    display_name: string("display_name"),
    description: string("description"),
    location: string("location"),
    categories: form
      .getAll("categories")
      .filter((value): value is string => typeof value === "string")
      .slice(0, 6),
    website: string("website"),
    links,
  };
}
