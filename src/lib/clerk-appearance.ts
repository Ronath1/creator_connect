/** Shared sizing only; preserve Clerk's built-in authentication behavior. */
export const clerkAppearance = {
  elements: {
    rootBox: { width: "100%", maxWidth: "100%", minWidth: "0" },
    cardBox: { width: "100%", maxWidth: "100%", minWidth: "0" },
    card: {
      width: "100%",
      maxWidth: "100%",
      minWidth: "0",
      boxSizing: "border-box",
    },
    formFieldInput: { minHeight: "48px", fontSize: "16px" },
    formButtonPrimary: { minHeight: "44px" },
    socialButtonsBlockButton: { minHeight: "44px", minWidth: "0" },
    socialButtonsIconButton: { minWidth: "44px", minHeight: "44px" },
    socialButtonsBlockButtonText: { whiteSpace: "normal" },
  },
} as const;
