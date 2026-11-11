import { UserButton } from "@clerk/nextjs";

export function AccountMenu() {
  return (
    <UserButton
      appearance={{
        elements: {
          userButtonTrigger: { minWidth: "44px", minHeight: "44px" },
        },
      }}
    />
  );
}
