import test from "node:test";
import assert from "node:assert/strict";
import {
  portfolioContent,
  portfolioDraft,
  portfolioSlug,
  portfolioUrl,
  readPortfolioForm,
} from "../src/lib/portfolio.ts";
const content = () => ({
  display_name: " Public Name ",
  headline: " Thoughtful work ",
  about: " A public introduction to my curated work. ",
  works: [
    {
      title: " Example work ",
      description: " Optional context ",
      url: " https://example.com/work ",
    },
  ],
});
test("publication validates HTTPS, bounds and allowlist; draft permits incomplete content", () => {
  const parsed = portfolioContent.parse(content());
  assert.equal(parsed.display_name, "Public Name");
  assert.equal(parsed.works[0].url, "https://example.com/work");
  assert.equal(
    portfolioDraft.safeParse({
      display_name: "",
      headline: "",
      about: "",
      works: [],
    }).success,
    true,
  );
  assert.equal(
    portfolioContent.safeParse({
      display_name: "",
      headline: "",
      about: "",
      works: [],
    }).success,
    false,
  );
  assert.equal(
    portfolioContent.safeParse({ ...content(), email: "private@example.test" })
      .success,
    false,
  );
  assert.equal(
    portfolioContent.safeParse({
      ...content(),
      works: Array(7).fill(content().works[0]),
    }).success,
    false,
  );
});
test("shared URL and address grammar rejects dangerous or unsupported forms", () => {
  for (const url of [
    "http://example.com",
    "//example.com",
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "https://example.com\\evil",
    "https://example.com:65536",
    "https://example.com:0",
    "https://example.com/%0a",
    "https://example.com/%7F",
    "https://example.com/has space",
  ])
    assert.equal(portfolioUrl(url), false, url);
  assert.equal(
    portfolioUrl("https://example.com:65535/path?q=work#part"),
    true,
  );
  for (const slug of ["ab", "Capital", "-edge", "edge-", "a".repeat(41)])
    assert.equal(portfolioSlug.safeParse(slug).success, false);
  assert.equal(portfolioSlug.safeParse("my-curated-work").success, true);
});
test("form read retains visible blank middle rows and rejects excess instead of truncating six", () => {
  const form = new FormData();
  form.set("slug", "work-page");
  form.set("display_name", "Chosen public name");
  form.set("headline", "Some public work");
  form.set("about", "An introduction long enough to share publicly.");
  for (let i = 0; i < 7; i++) {
    form.set(`works.${i}.title`, i === 1 ? "" : `Work ${i}`);
    form.set(`works.${i}.description`, "");
    form.set(`works.${i}.url`, `https://example.com/${i}`);
  }
  const values = readPortfolioForm(form);
  assert.equal(values.works.length, 7);
  assert.equal(values.works[1].title, "");
  const { slug, ...fields } = values;
  assert.equal(slug, "work-page");
  assert.equal(portfolioContent.safeParse(fields).success, false);
  form.set("about", "x".repeat(4000));
  assert.equal(readPortfolioForm(form).about.length, 2001);
});
