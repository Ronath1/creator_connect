"use client";

import { useActionState, useState, type InputHTMLAttributes } from "react";
import { saveOpportunity } from "@/app/(member)/marketplace-actions";
import {
  categories,
  platforms,
  type OpportunityValues,
} from "@/lib/marketplace";

export function OpportunityForm({
  id,
  version,
  values,
  editing,
  materialLocked,
}: {
  id: string;
  version: number;
  values: OpportunityValues;
  editing: boolean;
  materialLocked: boolean;
}) {
  const [state, action, pending] = useActionState(saveOpportunity, {
    attempt: 0,
    values,
    errors: {},
    message: "",
  });
  const [count, setCount] = useState(values.deliverables.length);
  const [category, setCategory] = useState(values.category);
  const error = (name: string) =>
    state.errors[name] ? (
      <p className="field-error" id={`${name.replaceAll(".", "-")}-error`}>
        {state.errors[name]}
      </p>
    ) : null;
  const attrs = (name: string) => ({
    "aria-invalid": Boolean(state.errors[name]),
    "aria-describedby": state.errors[name]
      ? `${name.replaceAll(".", "-")}-error`
      : undefined,
  });
  function field(
    name: string,
    label: string,
    value: string,
    props: InputHTMLAttributes<HTMLInputElement> = {},
  ) {
    return (
      <div className="field">
        <label htmlFor={name}>{label} *</label>
        <input
          id={name}
          name={name}
          defaultValue={value}
          required
          {...props}
          {...attrs(name)}
        />
        {error(name)}
      </div>
    );
  }
  return (
    <form
      action={action}
      className="profile-form"
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="intent" value={editing ? "edit" : "create"} />
      {state.message ? (
        <div role="alert" className="form-summary">
          <strong>{state.message}</strong>
          <ul>
            {Object.entries(state.errors).map(([key, message]) => (
              <li key={key}>
                <a href={`#${key.replaceAll(".", "-")}`}>{message}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="form-help">
        All dates use Sri Lanka time (Asia/Colombo, UTC+05:30). Budgets are
        proposed compensation only. No money is collected or paid through this
        pilot.
      </p>
      {field("title", "Opportunity title", state.values.title, {
        minLength: 5,
        maxLength: 140,
      })}
      <div className="field">
        <label htmlFor="brief">Promotion brief *</label>
        <textarea
          id="brief"
          name="brief"
          rows={6}
          required
          minLength={30}
          maxLength={6000}
          defaultValue={state.values.brief}
          {...attrs("brief")}
        />
        {error("brief")}
      </div>
      {materialLocked ? (
        <p className="notice">
          Applications exist. Only non-material title/brief corrections are
          allowed. To change compensation, deliverables, dates, category,
          platforms or revisions, close this opportunity and create a
          replacement.
        </p>
      ) : null}
      {materialLocked ? (
        <>
          {(
            [
              "category",
              "budget",
              "application_deadline",
              "delivery_deadline",
              "revision_allowance",
            ] as const
          ).map((name) => (
            <input key={name} type="hidden" name={name} value={values[name]} />
          ))}
          {values.platforms.map((value) => (
            <input key={value} type="hidden" name="platforms" value={value} />
          ))}
          {values.deliverables.map((item, i) =>
            Object.entries(item).map(([key, value]) => (
              <input
                key={`${i}.${key}`}
                type="hidden"
                name={`deliverables.${i}.${key}`}
                value={value}
              />
            )),
          )}
        </>
      ) : null}
      <fieldset className="market-material" disabled={materialLocked}>
        <legend>
          {materialLocked ? "Fixed opportunity terms" : "Opportunity terms"}
        </legend>
        <div className="field">
          <label htmlFor="category">Category *</label>
          <select
            key={state.attempt}
            id="category"
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
            {...attrs("category")}
          >
            <option value="">Choose a category</option>
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          {error("category")}
        </div>
        <fieldset className="field" id="platforms">
          <legend>Social platforms *</legend>
          <div className="category-options">
            {platforms.map((value) => (
              <label key={value}>
                <input
                  type="checkbox"
                  name="platforms"
                  value={value}
                  defaultChecked={state.values.platforms.includes(value)}
                />
                {value}
              </label>
            ))}
          </div>
          {error("platforms")}
        </fieldset>
        {field("budget", "Proposed budget (LKR)", state.values.budget, {
          inputMode: "decimal",
          maxLength: 14,
        })}
        {field(
          "application_deadline",
          "Application deadline — Sri Lanka time",
          state.values.application_deadline,
          { type: "datetime-local" },
        )}
        {field(
          "delivery_deadline",
          "Delivery deadline — Sri Lanka time",
          state.values.delivery_deadline,
          { type: "datetime-local" },
        )}
        {field(
          "revision_allowance",
          "Revision rounds per deliverable",
          state.values.revision_allowance,
          { type: "number", min: 0, max: 5 },
        )}
        <fieldset className="field">
          <legend>Deliverables *</legend>
          <p className="form-help">
            One to ten items. Describe the output and what the brand will review
            for acceptance.
          </p>
          {Array.from({ length: count }, (_, i) => {
            const item = state.values.deliverables[i] ?? {
              format: "",
              quantity: "1",
              acceptance: "",
            };
            return (
              <fieldset className="social-row" key={i}>
                <legend>Deliverable {i + 1}</legend>
                <div className="field">
                  <label htmlFor={`deliverables-${i}-format`}>Format *</label>
                  <input
                    id={`deliverables-${i}-format`}
                    name={`deliverables.${i}.format`}
                    defaultValue={item.format}
                    minLength={2}
                    maxLength={100}
                    required
                    {...attrs(`deliverables.${i}.format`)}
                  />
                  {error(`deliverables.${i}.format`)}
                </div>
                <div className="field">
                  <label htmlFor={`deliverables-${i}-quantity`}>
                    Quantity *
                  </label>
                  <input
                    id={`deliverables-${i}-quantity`}
                    name={`deliverables.${i}.quantity`}
                    type="number"
                    min={1}
                    max={99}
                    required
                    defaultValue={item.quantity}
                    {...attrs(`deliverables.${i}.quantity`)}
                  />
                  {error(`deliverables.${i}.quantity`)}
                </div>
                <div className="field">
                  <label htmlFor={`deliverables-${i}-acceptance`}>
                    Acceptance description *
                  </label>
                  <textarea
                    id={`deliverables-${i}-acceptance`}
                    name={`deliverables.${i}.acceptance`}
                    rows={3}
                    required
                    minLength={5}
                    maxLength={1000}
                    defaultValue={item.acceptance}
                    {...attrs(`deliverables.${i}.acceptance`)}
                  />
                  {error(`deliverables.${i}.acceptance`)}
                </div>
              </fieldset>
            );
          })}
          <div className="market-actions">
            {count < 10 && !materialLocked ? (
              <button
                className="action action-secondary"
                type="button"
                onClick={() => setCount(count + 1)}
              >
                Add deliverable
              </button>
            ) : null}
            {count > 1 && !materialLocked ? (
              <button
                className="action action-secondary"
                type="button"
                onClick={() => setCount(count - 1)}
              >
                Remove last deliverable
              </button>
            ) : null}
          </div>
        </fieldset>
      </fieldset>
      {editing
        ? field("reason", "Reason for correction", state.values.reason, {
            minLength: 3,
            maxLength: 500,
          })
        : null}
      <button className="action action-primary" disabled={pending}>
        {pending ? "Saving…" : editing ? "Save correction" : "Save draft"}
      </button>
    </form>
  );
}
