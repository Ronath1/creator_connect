"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  applicationInput,
  colomboInstant,
  minorUnits,
  opportunityInput,
  readOpportunityForm,
  uuid,
  type OpportunityFormState,
} from "@/lib/marketplace";
import {
  marketplaceCommand,
  marketplaceContext,
} from "@/server/services/marketplace";

function refresh() {
  for (const path of [
    "/dashboard",
    "/opportunities",
    "/my-opportunities",
    "/applications",
  ])
    revalidatePath(path);
}
export async function saveOpportunity(
  previous: OpportunityFormState,
  form: FormData,
): Promise<OpportunityFormState> {
  const values = readOpportunityForm(form),
    errors: Record<string, string> = {};
  const fail = (message: string) => ({
    values,
    errors,
    message,
    attempt: Number.isSafeInteger(previous?.attempt) ? previous.attempt + 1 : 1,
  });
  try {
    const { member } = await marketplaceContext();
    if (member.role !== "brand")
      return fail("Only brands can manage opportunities.");
  } catch (error) {
    unstable_rethrow(error);
    return fail(
      "We couldn’t check your account access. Your draft is preserved; try again when your connection is ready.",
    );
  }
  const parsed = opportunityInput.safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues)
      errors[issue.path.join(".")] ??= issue.message;
    return fail("Check the highlighted fields. Your draft is preserved below.");
  }
  const id = String(form.get("id") ?? ""),
    intent = String(form.get("intent") ?? "");
  if (!uuid.safeParse(id).success || !["create", "edit"].includes(intent))
    return fail("This form is unavailable. Refresh and try again.");
  if (intent === "edit" && parsed.data.reason.length < 3) {
    errors.reason = "Explain the correction (at least 3 characters).";
    return fail("Add the reason for your correction.");
  }
  let saved: string;
  try {
    const { member } = await marketplaceContext();
    if (member.role !== "brand")
      return fail("Only brands can manage opportunities.");
    const { response } = await marketplaceCommand(intent, id, {
      title: parsed.data.title,
      brief: parsed.data.brief,
      category: parsed.data.category,
      platforms: parsed.data.platforms,
      deliverables: parsed.data.deliverables,
      budget_minor: minorUnits(parsed.data.budget),
      currency: "LKR",
      application_deadline: colomboInstant(parsed.data.application_deadline),
      delivery_deadline: colomboInstant(parsed.data.delivery_deadline),
      revision_allowance: parsed.data.revision_allowance,
      reason: parsed.data.reason,
      expected_version: Number(form.get("version")),
    });
    if (response.error)
      return fail(
        response.error.code === "PT409"
          ? "This brief changed. Open the latest version before saving again."
          : "We couldn’t save this opportunity. Check deadlines, your access and whether material terms are already fixed by an application.",
      );
    saved = response.data;
  } catch (error) {
    unstable_rethrow(error);
    return fail(
      "We couldn’t confirm the save. Your draft is preserved; refresh before retrying.",
    );
  }
  refresh();
  revalidatePath(`/opportunities/${saved}`);
  redirect(`/opportunities/${saved}`);
}
export type MarketActionState = {
  message: string;
  success: boolean;
  proposal?: string;
  work_urls?: string[];
};
export async function runMarketAction(
  _previous: MarketActionState,
  form: FormData,
): Promise<MarketActionState> {
  const action = String(form.get("action") ?? ""),
    id = String(form.get("id") ?? ""),
    app = String(form.get("application_id") ?? "");
  const proposal = String(form.get("proposal") ?? "");
  const work_urls = [0, 1, 2].map((i) =>
    String(form.get(`work_url.${i}`) ?? "").trim(),
  );
  const fail = (message: string) => ({
    message,
    success: false,
    proposal,
    work_urls,
  });
  try {
    await marketplaceContext();
  } catch (error) {
    unstable_rethrow(error);
    return fail("We couldn’t check your account access. Please try again.");
  }
  if (
    !uuid.safeParse(id).success ||
    ![
      "publish",
      "close",
      "reopen",
      "delete_draft",
      "apply",
      "withdraw",
      "reject",
      "select",
    ].includes(action)
  )
    return fail("This action is unavailable. Refresh the page.");
  const data: Record<string, string | number | string[]> = {
    expected_version: Number(form.get("version")),
  };
  if (["withdraw", "reject", "select"].includes(action)) {
    if (!uuid.safeParse(app).success) return fail("Application unavailable.");
    data.application_id = app;
  }
  if (action === "apply") {
    const parsed = applicationInput.safeParse({
      proposal,
      work_urls: work_urls.filter(Boolean),
    });
    if (!parsed.success)
      return fail(parsed.error.issues.map((i) => i.message).join(" "));
    Object.assign(data, parsed.data);
  }
  try {
    const { response } = await marketplaceCommand(action, id, data);
    if (response.error)
      return fail(
        response.error.code === "PT409"
          ? "This brief changed. Refresh before publishing."
          : response.error.code === "23505"
            ? "This application already exists or the hiring slot is already reserved. Refresh for the latest state."
            : "This action could not be completed. Your access, deadline or the record’s status may have changed. Refresh and check before retrying.",
      );
  } catch (error) {
    unstable_rethrow(error);
    return fail("We couldn’t confirm the change. Refresh before trying again.");
  }
  refresh();
  revalidatePath(`/opportunities/${id}`);
  if (action === "delete_draft") redirect("/my-opportunities");
  return {
    message:
      action === "select"
        ? "Creator selected. The slot is reserved; both participants still need to confirm terms before work begins."
        : "Saved. The latest status is shown on this page.",
    success: true,
  };
}
