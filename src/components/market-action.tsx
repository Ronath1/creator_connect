"use client";
import { useActionState } from "react";
import { runMarketAction } from "@/app/(member)/marketplace-actions";

export function MarketAction({
  id,
  action,
  label,
  applicationId,
  version = 0,
}: {
  id: string;
  action: string;
  label: string;
  applicationId?: string;
  version?: number;
}) {
  const [state, submit, pending] = useActionState(runMarketAction, {
    message: "",
    success: false,
  });
  return (
    <form action={submit} className="market-action">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="version" value={version} />
      {applicationId ? (
        <input type="hidden" name="application_id" value={applicationId} />
      ) : null}
      <button className="action action-secondary" disabled={pending}>
        {pending ? "Saving…" : label}
      </button>
      {state.message ? (
        <p
          role={state.success ? "status" : "alert"}
          className={state.success ? "form-help" : "field-error"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
export function ApplicationForm({ id }: { id: string }) {
  const [state, submit, pending] = useActionState(runMarketAction, {
    message: "",
    success: false,
    proposal: "",
    work_urls: ["", "", ""],
  });
  return (
    <form action={submit} className="profile-form">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value="apply" />
      {state.message ? (
        <div className="form-summary" role={state.success ? "status" : "alert"}>
          {state.message}
        </div>
      ) : null}
      <p className="form-help">
        One application per opportunity. Withdrawing is final; you cannot apply
        again. Selection reserves a slot and does not mean an agreement or
        payment.
      </p>
      <div className="field">
        <label htmlFor="proposal">Why are you a good fit? *</label>
        <textarea
          name="proposal"
          id="proposal"
          required
          rows={5}
          minLength={20}
          maxLength={3000}
          defaultValue={state.proposal}
        />
      </div>
      {[0, 1, 2].map((i) => (
        <div className="field" key={i}>
          <label htmlFor={`work_url-${i}`}>
            Relevant work URL {i + 1} (optional)
          </label>
          <input
            type="url"
            id={`work_url-${i}`}
            name={`work_url.${i}`}
            maxLength={2048}
            defaultValue={state.work_urls?.[i]}
            placeholder="https://"
          />
        </div>
      ))}
      <button
        className="action action-primary"
        disabled={pending || state.success}
      >
        {pending ? "Sending…" : "Send application"}
      </button>
    </form>
  );
}
