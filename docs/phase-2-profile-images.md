# Phase 2 profile-image milestone

Status: **Ready for review — parent source review, hosted Storage/API, actual image-form browser checks and final required executable suite passed**. Prepared 12 November 2026 on `feat/phase-2-profile-images`, stacked on the unmerged authentication milestone (PR #3), which itself depends on PR #2. Phase 2 remains In progress for the stated manual/visual/device limits. The owner alone merges `main`. No Phase 3 work is included.

## Image behavior and boundaries

Active brand and creator members may optionally save a profile photo or brand logo from their own saved profile. Text/link onboarding works without an image. The form accepts JPEG, PNG or WebP still images up to 5 MiB and 16 million pixels. Client-side size validation avoids sending oversized files from the normal form; the server independently checks the actual bytes.

The server checks file signatures, decodes through Sharp 0.35.5 with a 16-million-pixel bound, rejects animation/corruption, applies orientation, fits within 1024 × 1024 without enlargement, re-encodes WebP and strips metadata. Processing has a five-second timeout. Original filenames, EXIF/GPS metadata and input bytes are not stored by the application. Unsupported SVG, HTML, GIF and HEIC inputs are rejected rather than silently converted. A failed validation does not touch the existing image.

The Server Action body cap is 6 MB to allow a 5 MiB file plus multipart overhead. The image form uses labelled 16 px inputs, at least 44 px controls, inline size errors, pending feedback, explicit save/remove actions and an optional image preview. Selecting a file does not replace the current image. Uncertain network/provider outcomes ask the user to refresh before retrying rather than claiming success or guaranteed rollback.

## Private storage and replacement

The CLI generated `supabase/migrations/20261112040650_phase_2_profile_images.sql`. Parent review preceded its application to the dedicated development project; the migration ledger matches that version and post-application security advisors returned no findings.

The private `profile-images` bucket is limited to 5 MiB and `image/webp` uploads. Its Storage object policies permit only an active brand/creator to select, insert, update or delete the exact path `<internal-user-UUID>/profile.webp`. They derive identity from the real Clerk JWT subject and current controlled membership record, not user-editable metadata. Other users, administrators, uninvited identities and suspended memberships receive no access through these policies. Existing platform Storage schema/grants and other buckets are not replaced.

One fixed object per member bounds storage and avoids orphaned versions or a second database pointer. Replacement uses the normal user-scoped Storage upsert API; removal deletes that object through the Storage API. No privileged key or local durable file is used. Concurrent avatar changes follow the last successful storage operation; avatars have no agreement/history semantics. App uploads use cache control zero; authenticated delivery uses private/no-store responses. Do not assume a successful upload instantly invalidates a file previously uploaded outside the application with a longer cache lifetime; hosted tests must verify current bytes before attributing an integrity failure to authorization.

## Delivery remains a security boundary

Storage bucket MIME restrictions do not validate image bytes: a direct owner Storage client can spoof a MIME label. Therefore the application never treats stored bytes as trusted just because they are named `.webp`. `/api/profile-image` checks real sign-in and current eligible membership, downloads only the caller's fixed object, then runs the same bounded decoding/re-encoding pipeline before returning WebP pixels. It responds with `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store, max-age=0` and a Cookie/Authorization `Vary` header. Missing/invalid images return no file bytes. Signed-out API calls receive 401; ineligible memberships receive 403.

The preview bypasses Next's shared image optimizer so the browser retains its authenticated cookie on this private route. No public object URLs or signed capabilities are issued by the application. Owners can still download or deliberately share their own bytes using their authorized direct Storage API; this does not make those bytes safe for the application to serve. Existing externally issued signed URLs, if an owner creates one, have their own expiry semantics; the application does not promise to revoke such capabilities on suspension.

Delivery checks current Storage metadata before downloading and sends a current-version cache nonce. The parent confirmed why this matters: removal left zero object rows and absent metadata, while a raw immediate SDK byte download could still return upstream-cached bytes. The application endpoint correctly returns 404 after removal; it does not treat cached byte availability as proof that the object still exists.

## Verification

### Resume and Clerk CSS compatibility

The owner resumed the saved checkpoint with “ok continue the work” on 12 November. Image-form, creator onboarding, suspension and fixture-cleanup checks are now completed as recorded below; the historical pause does not authorize Phase 3.

The runtime structural-CSS warning was traced to four redundant descendant selectors targeting Clerk's `.cl-*` classes. They were removed from global CSS; equivalent width bounds and account-trigger sizing remain in supported `appearance.elements` settings. A fresh browser tab reported zero `structural_css_pin_clerk_ui` warnings and the hydrated account trigger measured 44 × 44 px. No new UI package/version was introduced solely to silence a warning.

Clerk's current [customization guide](https://clerk.com/docs/guides/customizing-clerk/overview) supports `appearance.elements`. Its [component-versioning guide](https://clerk.com/docs/reference/components/versioning) recommends importing a pinned `@clerk/ui` implementation for advanced structural customization; that level of customization is unnecessary here. The [Core 3 upgrade guide](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3) removes the old `clerkUIVersion` props, so no deprecated version override was added. Installed SDK peer ranges accept the project's existing Next/React versions; there is no evidence of a framework-version mismatch.

### Check record

| Check                   | Evidence / status                                                                                                                                                                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local SQL/RLS           | Seven isolated PGlite tests cover private bucket limits, own insert/upsert, cross-user/admin/uninvited denial, fixed-path/ownership constraints, administrator exclusion, suspension and deletion. Actual hosted MIME/size cases also passed as recorded below.                                             |
| Actual image processing | Six Sharp tests cover JPEG/PNG/WebP output and metadata removal, orientation, malicious/forged/truncated formats, byte/pixel bounds, animation rejection and serve-time MIME-spoof defense.                                                                                                                 |
| Existing tests          | All 16 core identity/profile validation tests still pass. Total suite: **29 passing tests**, independently rerun by parent.                                                                                                                                                                                 |
| Source checks           | Final required suite passed: 29 tests, lint with zero warnings, formatting, generated route types/strict TypeScript and production build on Next 16.4.6 (11 static pages plus dynamic account/image routes).                                                                                                |
| Hosted Storage          | Reviewed migration applied; direct real-token own/cross-user/role/path/MIME/size and suspension cases passed. Detailed cases and cache/removal observations are recorded below.                                                                                                                             |
| Browser                 | Actual brand image-form cases passed with real Clerk cookies, including save/replace/invalid/oversize/remove and refresh persistence. Rendered controls have no overflow at all four viewport widths. Screenshot capture remains unavailable; physical-device and screenshot visual review are not claimed. |

### Hosted verification completed

- Nine initial Storage cases passed: own upload/info/download, fresh fixed-path replacement, active other-user read/write denial, denied cross-delete preserving owner bytes, administrator own-upload denial, alternate-path denial, MIME restriction, oversize rejection preserving existing bytes, and anonymous/public-URL denial. Removal was confirmed by zero object rows and absent metadata, not an immediate raw download.
- Five application-endpoint cases passed: explicit 401/403, metadata-based 404, sanitized WebP with private/no-store/nosniff headers, rejection of MIME-spoofed stored bytes, and removal returning 404.
- Resumed creator checks passed: an active creator uploaded/read its own fixed object, received application GET 200, removed it with metadata absence, and uploaded again. After trusted suspension, a fresh real Clerk token was denied metadata/read/write/delete and received application GET 403. Trusted SQL confirmed the existing object survived the denied delete. The earlier cross-user tests used active creator/admin identities, so their denials were not merely caused by suspension.
- Actual brand image-picker checks passed in the browser with real Clerk cookies at a 360 px viewport: selecting a 247-byte PNG and saving loaded an 80 × 60 private image; selecting a JPEG alone preserved the current image, then saving replaced it with a 60 × 80 WebP and refresh preserved it. A forged PNG containing HTML was rejected by the server while the saved preview remained. Selecting 5 MiB + 1 byte triggered native custom validity and blocked submit. Removal still worked with that invalid oversized selection via `formNoValidate`; the preview disappeared and refresh showed no image.
- Image-form rendered DOM checks at 360/390/768/1280 px found no horizontal overflow. The file input rendered at 16 px and 71 px high. These are real browser interaction/layout checks, not physical Android/iPhone or screenshot-based visual inspection.
- Creator onboarding/account checks and fixture teardown subsequently completed; final evidence is recorded below.

### Final browser, review and cleanup evidence

The parent completed a synthetic creator's first-run onboarding using real OTP sign-in after a scoped test-profile reset. A mismatched platform URL produced an accessible server error and preserved the draft; correcting it saved the profile/social link, reached the dashboard and persisted when reopening the form. No overflow was found at 360/390/768/1280 px or 844 × 390 landscape. Text fields were 16 px/50 px high, selects 48 px, details controls 44 px, save/add buttons 48 px and account controls 44 px. Tab navigation from the URL to optional details and Enter expansion worked. The creator removed its image in the browser and refresh showed no image.

Brand and creator sign-out then direct dashboard navigation returned to sign-in. Account management, profile/security, active-device controls and the fixture's Set password action were visible. No credential was created/reset and no account deletion occurred. Fresh signup and password-reset verification require owner credential handoff; those flows are not claimed tested.

All three exact synthetic development memberships are suspended, Clerk backend active sessions are zero, and test Storage objects are zero. Browser viewport override was reset. Fresh security advisors returned no findings. The parent completed final source/security review with no remaining code findings.

The installed Next 16 upgrade guide documents `data-scroll-behavior="smooth"` on `<html>` when global CSS enables smooth scrolling and route transitions should reset it. The root layout now supplies that attribute to address the observed warning; reduced-motion CSS remains intact.

Actual IAB interaction and rendered DOM evidence is recorded above. Screenshot capture failed through both available APIs; no screenshot visual inspection, physical Android/iPhone test, virtual-keyboard test or zoom verification is claimed. Those limits and fresh-signup/password-reset checks keep **Phase 2 In progress**, even when this image milestone is Ready for review.

Storage tests use only scoped synthetic development members/images. No real pilot invitations or production records are part of this milestone. Phase 2 stays In progress until its remaining authentication/recovery, mobile/device and storage checks are resolved or explicitly scoped by the owner.
