"use client";
import {
  useActionState,
  useId,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
} from "react";
import { changeCollaboration } from "@/app/(member)/collaboration-actions";
import { colomboInput } from "@/lib/marketplace";
import {
  reportCategories,
  type AgreementTerms,
  type CollaborationFile,
  type CollaborationState,
} from "@/lib/collaboration";

function useForm(requestId: string) {
  return useActionState(changeCollaboration, {
    attempt: 0,
    success: false,
    message: "",
    values: {},
    multi: {},
    requestId,
  });
}
function Shell({
  state,
  action,
  children,
}: {
  state: CollaborationState;
  action: (form: FormData) => void;
  children: ReactNode;
}) {
  return (
    <form
      key={state.attempt}
      action={action}
      className="profile-form collaboration-form"
      onReset={(event) => event.preventDefault()}
    >
      {state.message ? (
        <p
          className={state.success ? "notice" : "form-summary"}
          role={state.success ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
      {children}
    </form>
  );
}
function Hidden({
  action,
  id,
  requestId,
  fields = {},
}: {
  action: string;
  id?: string;
  requestId: string;
  fields?: Record<string, string | number>;
}) {
  return (
    <>
      <input type="hidden" name="action" value={action} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <input type="hidden" name="request_id" value={requestId} />
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}
function Field({
  name,
  label,
  value = "",
  textarea = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  value?: string;
  textarea?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {props.required ? " *" : ""}
      </label>
      {textarea ? (
        <textarea
          id={id}
          name={name}
          defaultValue={value}
          required={props.required}
          maxLength={props.maxLength}
          minLength={props.minLength}
          rows={4}
        />
      ) : (
        <input id={id} name={name} defaultValue={value} {...props} />
      )}
    </div>
  );
}
function Files({
  files,
  name,
  selected = [],
}: {
  files: CollaborationFile[];
  name: string;
  selected?: string[];
}) {
  return files.length ? (
    <fieldset className="field">
      <legend>
        Choose scanned files (at most five per message/submission)
      </legend>
      {files.map((file) => (
        <label key={file.id}>
          <input
            type="checkbox"
            name={name}
            value={file.id}
            defaultChecked={selected.includes(file.id)}
          />
          {file.filename} · {Math.ceil((file.size_bytes ?? 0) / 1024)} KB
        </label>
      ))}
    </fieldset>
  ) : null;
}
export function ActionForm({
  id,
  action,
  label,
  requestId,
  fields = {},
  reason = false,
  decisions,
}: {
  id?: string;
  action: string;
  label: string;
  requestId: string;
  fields?: Record<string, string | number>;
  reason?: boolean;
  decisions?: { value: string; label: string }[];
}) {
  const [state, submit, pending] = useForm(requestId);
  return (
    <Shell state={state} action={submit}>
      <Hidden
        action={action}
        id={id}
        requestId={state.requestId}
        fields={fields}
      />
      {reason ? (
        <Field
          name="reason"
          label="Reason"
          value={state.values.reason}
          required
          minLength={3}
          maxLength={
            action.includes("member") ||
            [
              "claim",
              "release",
              "case_cancel",
              "hide_message",
              "moderate_opportunity",
            ].includes(action)
              ? 1000
              : 3000
          }
          textarea
        />
      ) : null}
      <div className="market-actions">
        {decisions ? (
          decisions.map((decision) => (
            <button
              className="action action-secondary"
              name="decision"
              value={decision.value}
              disabled={pending}
              key={decision.value}
            >
              {pending ? "Saving…" : decision.label}
            </button>
          ))
        ) : (
          <button className="action action-secondary" disabled={pending}>
            {pending ? "Saving…" : label}
          </button>
        )}
      </div>
    </Shell>
  );
}
export function AgreementForm({
  id,
  terms,
  version,
  requestId,
}: {
  id: string;
  terms: AgreementTerms;
  version: number;
  requestId: string;
}) {
  const [state, submit, pending] = useForm(requestId),
    [count, setCount] = useState(terms.deliverables.length);
  const value = (key: string, fallback: string) =>
    state.values[key] ?? fallback;
  return (
    <Shell state={state} action={submit}>
      <Hidden
        action="terms"
        id={id}
        requestId={state.requestId}
        fields={{ expected_version: version }}
      />
      <p className="form-help">
        A new version clears proposal confirmations. Accepted terms stay
        effective until both parties confirm an amendment. Dates use Sri Lanka
        time (Asia/Colombo, UTC+05:30). No money is collected or paid.
      </p>
      <Field
        name="title"
        label="Agreement title"
        value={value("title", terms.title)}
        minLength={5}
        maxLength={140}
        required
      />
      <Field
        name="budget"
        label="Proposed compensation (LKR)"
        value={value("budget", (terms.budget_minor / 100).toFixed(2))}
        inputMode="decimal"
        required
      />
      <Field
        name="delivery_deadline"
        label="Delivery deadline — Sri Lanka time"
        value={value(
          "delivery_deadline",
          colomboInput(terms.delivery_deadline),
        )}
        type="datetime-local"
        required
      />
      <Field
        name="revision_allowance"
        label="Revision rounds per item"
        value={value("revision_allowance", String(terms.revision_allowance))}
        type="number"
        min={0}
        max={5}
        required
      />
      <p className="form-help">
        Existing item identities preserve rounds already used. Removing an item
        retains its history. Add work or allowance only through a version both
        parties accept.
      </p>
      {Array.from({ length: count }, (_, i) => {
        const item = terms.deliverables[i];
        return (
          <fieldset className="social-row" key={i}>
            <legend>Deliverable {i + 1}</legend>
            <input type="hidden" name={`item_id.${i}`} value={item?.id ?? ""} />
            <Field
              name={`format.${i}`}
              label="Format"
              value={value(`format.${i}`, item?.format ?? "")}
              required
              minLength={2}
              maxLength={100}
            />
            <Field
              name={`quantity.${i}`}
              label="Quantity"
              value={value(`quantity.${i}`, String(item?.quantity ?? 1))}
              type="number"
              min={1}
              max={99}
              required
            />
            <Field
              name={`acceptance.${i}`}
              label="Acceptance description"
              value={value(`acceptance.${i}`, item?.acceptance ?? "")}
              textarea
              minLength={5}
              maxLength={1000}
              required
            />
          </fieldset>
        );
      })}
      <div className="market-actions">
        {count < 10 ? (
          <button
            type="button"
            className="action action-secondary"
            onClick={() => setCount((n) => n + 1)}
          >
            Add deliverable
          </button>
        ) : null}
        {count > 1 ? (
          <button
            type="button"
            className="action action-secondary"
            onClick={() => setCount((n) => n - 1)}
          >
            Remove last deliverable
          </button>
        ) : null}
      </div>
      <button className="action action-primary" disabled={pending}>
        {pending ? "Saving…" : "Propose new version"}
      </button>
    </Shell>
  );
}
export function MessageForm({
  id,
  files,
  requestId,
}: {
  id: string;
  files: CollaborationFile[];
  requestId: string;
}) {
  const [state, submit, pending] = useForm(requestId);
  return (
    <Shell state={state} action={submit}>
      <Hidden action="message" id={id} requestId={state.requestId} />
      <Field
        name="body"
        label="Message"
        value={state.values.body}
        textarea
        required
        maxLength={6000}
      />
      <Files files={files} name="files" selected={state.multi.files} />
      <p className="form-help">
        Sent messages are immutable. Send a new message to correct one.
      </p>
      <button className="action action-primary" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </button>
    </Shell>
  );
}
export function SubmissionForm({
  id,
  terms,
  version,
  files,
  requestId,
}: {
  id: string;
  terms: AgreementTerms;
  version: number;
  files: CollaborationFile[];
  requestId: string;
}) {
  const [state, submit, pending] = useForm(requestId);
  return (
    <Shell state={state} action={submit}>
      <Hidden
        action="submit"
        id={id}
        requestId={state.requestId}
        fields={{ version }}
      />
      <p className="form-help">
        Cover every current deliverable with HTTPS links or scanned files. At
        most five files across the complete submission. Previous evidence
        remains in history; late submissions show their timestamps.
      </p>
      {terms.deliverables.map((item, i) => (
        <fieldset className="social-row" key={item.id}>
          <legend>
            {item.quantity} × {item.format}
          </legend>
          <p>{item.acceptance}</p>
          <input type="hidden" name={`item_id.${i}`} value={item.id} />
          {[0, 1, 2].map((j) => (
            <Field
              key={j}
              name={`url.${i}.${j}`}
              label={`Evidence HTTPS URL ${j + 1} (optional)`}
              value={state.values[`url.${i}.${j}`]}
              type="url"
              maxLength={2048}
            />
          ))}
          <Files
            files={files}
            name={`item_files.${i}`}
            selected={state.multi[`item_files.${i}`]}
          />
          <Field
            name={`item_notes.${i}`}
            label="Item notes (optional)"
            value={state.values[`item_notes.${i}`]}
            textarea
            maxLength={3000}
          />
        </fieldset>
      ))}
      <Field
        name="notes"
        label="Submission notes (optional)"
        value={state.values.notes}
        textarea
        maxLength={6000}
      />
      <button className="action action-primary" disabled={pending}>
        {pending ? "Submitting…" : "Submit all deliverables"}
      </button>
    </Shell>
  );
}
export function ReviewForm({
  id,
  submissionId,
  terms,
  reviewed,
  requestId,
}: {
  id: string;
  submissionId: string;
  terms: AgreementTerms;
  reviewed: string[];
  requestId: string;
}) {
  const [state, submit, pending] = useForm(requestId);
  return (
    <Shell state={state} action={submit}>
      <Hidden
        action="review"
        id={id}
        requestId={state.requestId}
        fields={{ submission_id: submissionId }}
      />
      <p className="form-help">
        Approve each current item explicitly, or choose items needing a
        consolidated revision with specific feedback. Completion requires every
        item approved. No payment is triggered.
      </p>
      {terms.deliverables.map((item, i) =>
        reviewed.includes(item.id ?? "") ? (
          <p key={item.id}>{item.format}: already reviewed</p>
        ) : (
          <fieldset className="social-row" key={item.id}>
            <legend>
              {item.quantity} × {item.format}
            </legend>
            <input type="hidden" name={`item_id.${i}`} value={item.id} />
            <label>
              <input
                type="checkbox"
                name="selected_items"
                value={item.id}
                defaultChecked={state.multi.selected_items?.includes(
                  item.id ?? "",
                )}
              />
              Review this item
            </label>
            <Field
              name={`feedback.${i}`}
              label="Specific feedback (required for revision)"
              value={state.values[`feedback.${i}`]}
              textarea
              maxLength={3000}
            />
          </fieldset>
        ),
      )}
      <div className="market-actions">
        <button
          className="action action-primary"
          name="decision"
          value="approve"
          disabled={pending}
        >
          Approve selected items
        </button>
        <button
          className="action action-secondary"
          name="decision"
          value="revise"
          disabled={pending}
        >
          Request revision for selected items
        </button>
      </div>
    </Shell>
  );
}
export function ReportForm({
  relation,
  relatedId,
  requestId,
}: {
  relation: "collaboration_id" | "opportunity_id" | "member_id";
  relatedId: string;
  requestId: string;
}) {
  const [state, submit, pending] = useForm(requestId);
  const selectId = useId();
  return (
    <Shell state={state} action={submit}>
      <Hidden
        action="report"
        requestId={state.requestId}
        fields={{ relation, related_id: relatedId }}
      />
      <div className="field">
        <label htmlFor={selectId}>Concern category *</label>
        <select
          name="category"
          id={selectId}
          defaultValue={state.values.category ?? reportCategories[0]}
          required
        >
          {reportCategories.map((category) => (
            <option value={category} key={category}>
              {category.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <Field
        name="description"
        label="Explain the concern"
        value={state.values.description}
        textarea
        minLength={10}
        maxLength={6000}
        required
      />
      <p className="form-help">
        Only support staff assigned to investigate can access related private
        work. You can follow status and shareable outcomes in Your reports.
      </p>
      <button className="action action-secondary" disabled={pending}>
        {pending ? "Sending…" : "Send report"}
      </button>
    </Shell>
  );
}
export function MembershipForm({ requestId }: { requestId: string }) {
  const [state, submit, pending] = useForm(requestId);
  const selectId = useId();
  return (
    <Shell state={state} action={submit}>
      <Hidden action="member_grant" requestId={state.requestId} />
      <p className="form-help">
        Use only an approved existing account identifier supplied by the pilot
        owner. This grants membership; it sends no invitation. Roles cannot be
        switched and administrator grants remain owner-controlled.
      </p>
      <Field
        name="clerk_user_id"
        label="Approved Clerk account identifier"
        value={state.values.clerk_user_id}
        required
        maxLength={245}
      />
      <div className="field">
        <label htmlFor={selectId}>Fixed marketplace role *</label>
        <select
          name="role"
          id={selectId}
          defaultValue={state.values.role ?? "brand"}
        >
          <option value="brand">Brand</option>
          <option value="influencer">Creator</option>
        </select>
      </div>
      <Field
        name="reason"
        label="Recorded reason"
        value={state.values.reason}
        textarea
        minLength={3}
        maxLength={1000}
        required
      />
      <button className="action action-primary" disabled={pending}>
        {pending ? "Saving…" : "Grant approved membership"}
      </button>
    </Shell>
  );
}
export function ResolveReportForm({
  id,
  requestId,
}: {
  id: string;
  requestId: string;
}) {
  const [state, submit, pending] = useForm(requestId);
  const selectId = useId();
  return (
    <Shell state={state} action={submit}>
      <Hidden action="resolve" id={id} requestId={state.requestId} />
      <div className="field">
        <label htmlFor={selectId}>Resolution</label>
        <select
          name="status"
          id={selectId}
          defaultValue={state.values.status ?? "resolved"}
        >
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>
      <Field
        name="outcome"
        label="Outcome shared with the reporter"
        value={state.values.outcome}
        textarea
        minLength={3}
        maxLength={3000}
        required
      />
      <Field
        name="internal_notes"
        label="Internal support notes (private)"
        value={state.values.internal_notes}
        textarea
        maxLength={6000}
      />
      <Field
        name="reason"
        label="Recorded resolution reason"
        value={state.values.reason}
        textarea
        minLength={3}
        maxLength={1000}
        required
      />
      <button className="action action-primary" disabled={pending}>
        {pending ? "Saving…" : "Record resolution"}
      </button>
    </Shell>
  );
}
