"use client";

import { useActionState, useState } from "react";
import {
  categories,
  platforms,
  type OnboardingState,
  type OnboardingValues,
} from "@/lib/onboarding";
import { saveOnboarding } from "@/app/(member)/onboarding/actions";

const emptyValues: OnboardingValues = {
  display_name: "",
  description: "",
  location: "",
  categories: [],
  website: "",
  links: [],
};

export function OnboardingForm({
  role,
  initialValues,
}: {
  role: "brand" | "influencer";
  initialValues: OnboardingValues | null;
}) {
  const initial: OnboardingState = {
    attempt: 0,
    message: "",
    errors: {},
    values: initialValues ?? emptyValues,
  };
  const [state, action, pending] = useActionState(saveOnboarding, initial);
  const [linkCount, setLinkCount] = useState(
    Math.max(initial.values.links.length, 1),
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    platforms.map(
      (platform, index) => initial.values.links[index]?.platform ?? platform,
    ),
  );
  const errorFor = (key: string) =>
    state.errors[key] ? (
      <p id={`${key.replaceAll(".", "-")}-error`} className="field-error">
        {state.errors[key]}
      </p>
    ) : null;
  const accessibility = (key: string) => ({
    "aria-invalid": Boolean(state.errors[key]),
    "aria-describedby": state.errors[key]
      ? `${key.replaceAll(".", "-")}-error`
      : undefined,
  });
  return (
    <form
      action={action}
      className="profile-form"
      onReset={(event) => event.preventDefault()}
    >
      {state.message ? (
        <div className="form-summary" role="alert">
          <strong>{state.message}</strong>
          {Object.keys(state.errors).length ? (
            <ul>
              {Object.entries(state.errors).map(([key, message]) => (
                <li key={key}>
                  <a href={`#${key.replaceAll(".", "-")}`}>{message}</a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <p className="form-help">
        Required fields are marked *. Your account role is approved by the pilot
        team and cannot be changed here.
      </p>
      <div className="field">
        <label htmlFor="display_name">
          {role === "brand" ? "Brand name" : "Display name"} *
        </label>
        <input
          id="display_name"
          name="display_name"
          autoComplete={role === "brand" ? "organization" : "nickname"}
          required
          minLength={2}
          maxLength={100}
          defaultValue={state.values.display_name}
          {...accessibility("display_name")}
        />
        {errorFor("display_name")}
      </div>
      <div className="field">
        <label htmlFor="description">
          {role === "brand" ? "About your brand" : "Your bio"} *
        </label>
        <p className="form-help">
          20–2,000 characters. Tell potential collaborators what you do.
        </p>
        <textarea
          id="description"
          name="description"
          required
          minLength={20}
          maxLength={2000}
          rows={5}
          defaultValue={state.values.description}
          {...accessibility("description")}
        />
        {errorFor("description")}
      </div>
      <div className="field">
        <label htmlFor="location">City or district in Sri Lanka *</label>
        <input
          id="location"
          name="location"
          autoComplete="address-level2"
          required
          minLength={2}
          maxLength={100}
          defaultValue={state.values.location}
          {...accessibility("location")}
        />
        {errorFor("location")}
      </div>
      <fieldset id="categories" className="field">
        <legend>Categories *</legend>
        <p className="form-help">Choose one to five.</p>
        <div className="category-options">
          {categories.map((category) => (
            <label key={category}>
              <input
                name="categories"
                type="checkbox"
                value={category}
                defaultChecked={state.values.categories.includes(category)}
              />
              {category}
            </label>
          ))}
        </div>
        {errorFor("categories")}
      </fieldset>
      {role === "brand" ? (
        <div className="field">
          <label htmlFor="website">
            Brand website <span>(optional)</span>
          </label>
          <input
            id="website"
            name="website"
            type="url"
            inputMode="url"
            autoComplete="url"
            maxLength={2048}
            placeholder="https://"
            defaultValue={state.values.website}
            {...accessibility("website")}
          />
          {errorFor("website")}
        </div>
      ) : (
        <fieldset id="links" className="social-fields">
          <legend>Your social profiles *</legend>
          <p className="form-help">
            Add at least one profile. Links and counts are self-reported, not
            verified.
          </p>
          {errorFor("links")}
          {Array.from({ length: linkCount }, (_, index) => {
            const link = state.values.links[index];
            return (
              <fieldset key={index} className="social-row">
                <legend>Profile {index + 1}</legend>
                <div className="field">
                  <label htmlFor={`links-${index}-platform`}>Platform *</label>
                  <select
                    key={`${state.attempt}.${index}`}
                    id={`links-${index}-platform`}
                    name={`platform_${index}`}
                    value={selectedPlatforms[index]}
                    onChange={(event) =>
                      setSelectedPlatforms((current) =>
                        current.map((platform, row) =>
                          row === index ? event.target.value : platform,
                        ),
                      )
                    }
                    {...accessibility(`links.${index}.platform`)}
                  >
                    {platforms.map((platform) => (
                      <option key={platform}>{platform}</option>
                    ))}
                  </select>
                  {errorFor(`links.${index}.platform`)}
                </div>
                <div className="field">
                  <label htmlFor={`links-${index}-url`}>Profile URL *</label>
                  <input
                    id={`links-${index}-url`}
                    name={`url_${index}`}
                    type="url"
                    inputMode="url"
                    maxLength={2048}
                    placeholder="https://"
                    required
                    defaultValue={link?.url ?? ""}
                    {...accessibility(`links.${index}.url`)}
                  />
                  {errorFor(`links.${index}.url`)}
                </div>
                <details
                  open={
                    Boolean(
                      state.errors[`links.${index}.follower_count`] ||
                      state.errors[`links.${index}.metrics_as_of`],
                    ) || undefined
                  }
                >
                  <summary>Optional self-reported follower count</summary>
                  <div className="field">
                    <label htmlFor={`links-${index}-follower_count`}>
                      Follower count
                    </label>
                    <input
                      id={`links-${index}-follower_count`}
                      name={`count_${index}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="10000000000"
                      step="1"
                      defaultValue={link?.follower_count ?? ""}
                      {...accessibility(`links.${index}.follower_count`)}
                    />
                    {errorFor(`links.${index}.follower_count`)}
                  </div>
                  <div className="field">
                    <label htmlFor={`links-${index}-metrics_as_of`}>
                      Count as of
                    </label>
                    <input
                      id={`links-${index}-metrics_as_of`}
                      name={`date_${index}`}
                      type="date"
                      defaultValue={link?.metrics_as_of ?? ""}
                      {...accessibility(`links.${index}.metrics_as_of`)}
                    />
                    {errorFor(`links.${index}.metrics_as_of`)}
                  </div>
                </details>
              </fieldset>
            );
          })}
          <div className="form-row-actions">
            {linkCount < 5 ? (
              <button
                type="button"
                className="action action-secondary"
                onClick={() => setLinkCount((count) => count + 1)}
              >
                Add another profile
              </button>
            ) : null}
            {linkCount > 1 ? (
              <button
                type="button"
                className="text-link"
                onClick={() => setLinkCount((count) => count - 1)}
              >
                Remove last profile
              </button>
            ) : null}
          </div>
        </fieldset>
      )}
      <div className="notice">
        <strong>Your image can come next</strong>
        <p>
          Finish these details first. You can add an optional profile photo or
          brand logo from your saved profile afterwards.
        </p>
      </div>
      <button
        className="action action-primary"
        type="submit"
        disabled={pending}
      >
        {pending ? "Saving your profile…" : "Save and continue"}
      </button>
      <p role="status" className="form-help">
        {pending
          ? "Please wait. Keep this page open while your profile saves."
          : "Your profile is shared only as the private pilot makes member features available."}
      </p>
    </form>
  );
}
