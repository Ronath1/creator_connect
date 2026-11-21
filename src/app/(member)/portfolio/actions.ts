"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { creatorPortfolioContext } from "@/server/services/portfolio";
import {
  portfolioContent,
  portfolioDraft,
  portfolioOwner,
  portfolioSlug,
  portfolioValues,
  readPortfolioForm,
  type PortfolioOwner,
  type PortfolioValues,
} from "@/lib/portfolio";

export type PortfolioState = PortfolioOwner & {
  values: PortfolioValues;
  errors: Record<string, string>;
  message: string;
  attempt: number;
};
export async function savePortfolio(
  previous: PortfolioState,
  form: FormData,
): Promise<PortfolioState> {
  const { client } = await creatorPortfolioContext();
  const values = readPortfolioForm(form);
  const attempt = Number.isSafeInteger(previous?.attempt)
    ? previous.attempt + 1
    : 1;
  // Prior metadata is only a validated UI fallback during read failure. Current
  // identity comes from creatorPortfolioContext and every mutation rechecks DB.
  const prior = portfolioOwner.safeParse({
    slug: previous?.slug,
    revision: previous?.revision,
    slug_locked: previous?.slug_locked,
    published: previous?.published,
    published_content: previous?.published_content,
    draft: previous?.draft,
  });
  let owner: PortfolioOwner = prior.success
    ? prior.data
    : {
        slug: "",
        revision: 0,
        slug_locked: false,
        published: false,
        published_content: null,
        draft: { display_name: "", headline: "", about: "", works: [] },
      };
  const failure = (
    message: string,
    errors: Record<string, string> = {},
  ): PortfolioState => ({ ...owner, values, errors, message, attempt });
  try {
    const { data: currentData, error: currentError } = await client
      .rpc("creator_portfolio_editor")
      .abortSignal(AbortSignal.timeout(15_000));
    if (currentError)
      return failure(
        "We couldn’t load the current publication. Refresh before retrying; your entered draft is preserved.",
      );
    owner = portfolioOwner.parse(currentData);
  } catch (error) {
    unstable_rethrow(error);
    return failure(
      "We couldn’t load the current publication. Refresh before retrying; your entered draft is preserved.",
    );
  }
  const intent = z
    .enum(["save", "publish", "unpublish"])
    .safeParse(form.get("intent"));
  const revision = z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().nonnegative())
    .safeParse(form.get("revision"));
  if (!intent.success || !revision.success)
    return failure(
      "Refresh before trying this action again. Your draft is preserved.",
    );
  let payload = {};
  if (intent.data !== "unpublish") {
    const slug = portfolioSlug.safeParse(values.slug);
    const { slug: _slug, ...content } = values;
    void _slug;
    const parsed = (
      intent.data === "publish" ? portfolioContent : portfolioDraft
    ).safeParse(content);
    const errors: Record<string, string> = {};
    if (!slug.success) errors.slug = slug.error.issues[0].message;
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        errors[issue.path.join(".")] = issue.message;
    if (intent.data === "publish" && form.get("consent") !== "yes")
      errors.consent =
        "Actively confirm that you want these fields and work links shared publicly.";
    if (Object.keys(errors).length || !parsed.success || !slug.success)
      return failure(
        "Review the fields below. Your draft is preserved; nothing was published.",
        errors,
      );
    payload = { slug: slug.data, content: parsed.data };
  }
  try {
    const { data, error } = await client
      .rpc("creator_portfolio_command", {
        p_action: intent.data,
        p_expected_revision: revision.data,
        p_data: payload,
        p_consent: form.get("consent") === "yes",
      })
      .abortSignal(AbortSignal.timeout(15_000));
    if (error)
      return failure(
        error.code === "PT409"
          ? "The portfolio changed or that address is unavailable. Check the saved version and address before retrying; your entered draft is preserved."
          : "We couldn’t confirm this change. Refresh to check the current publication before retrying. Your entered draft is preserved.",
      );
    const saved = portfolioOwner.parse(data);
    revalidatePath("/portfolio");
    revalidatePath("/portfolio/preview");
    if (saved.slug) revalidatePath(`/creators/${saved.slug}`);
    return {
      ...saved,
      values: intent.data === "unpublish" ? values : portfolioValues(saved),
      errors: {},
      attempt,
      message:
        intent.data === "publish"
          ? "Published. Your public page now shows this saved version."
          : intent.data === "unpublish"
            ? "Unpublished. New requests to the public page are unavailable. Your saved draft and permanent address remain."
            : "Draft saved. Your public page has not changed.",
    };
  } catch (error) {
    unstable_rethrow(error);
    return failure(
      "We couldn’t confirm this change. Refresh to check the current publication before retrying. Your entered draft is preserved.",
    );
  }
}
