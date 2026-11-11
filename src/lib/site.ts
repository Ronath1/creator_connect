export const site = {
  name: "CreatorConnect",
  description:
    "A shared space for Sri Lankan brands and creators to discover opportunities and agree on meaningful collaborations.",
} as const;

export const futureFeatures = {
  "sign-in": {
    title: "Sign in",
    phase: 2,
    description:
      "Secure sign-in and invitation access are being prepared. There is no account access in this preview.",
  },
  onboarding: {
    title: "Your profile starts here",
    phase: 2,
    description:
      "Invited members will set up a brand or creator profile after secure sign-in is available.",
  },
  dashboard: {
    title: "A clear view of your next step",
    phase: 2,
    description:
      "Your personal workspace will be available after sign-in and onboarding. No account data is shown here.",
  },
  opportunities: {
    title: "Find your next collaboration",
    phase: 3,
    description:
      "Invited members will explore clear briefs from Sri Lankan brands. Opportunity discovery is not open yet.",
  },
  "my-opportunities": {
    title: "Bring your brief to life",
    phase: 3,
    description:
      "Brands will create opportunities and review applications here. Publishing is not available yet.",
  },
  applications: {
    title: "Keep track of your applications",
    phase: 3,
    description:
      "Creators will see their applications and selection updates here. Applications are not open yet.",
  },
  collaborations: {
    title: "One place for the work",
    phase: 4,
    description:
      "Participants will confirm terms, discuss work, submit content, and review delivery in their private workspace.",
  },
  notifications: {
    title: "The updates that matter",
    phase: 4,
    description:
      "Members will receive in-app updates about their own applications and collaborations. Notifications are not active yet.",
  },
  profile: {
    title: "Introduce your work",
    phase: 2,
    description:
      "Invited members will create and edit their profiles after onboarding is available.",
  },
  reports: {
    title: "Help with your collaboration",
    phase: 4,
    description:
      "Members will be able to report concerns and follow their support status. This preview cannot receive reports.",
  },
  admin: {
    title: "Pilot support workspace",
    phase: 4,
    description:
      "Assigned administrators will manage pilot support through authorized tools. No administration or member data is available here.",
  },
} as const;

export type FutureFeature = keyof typeof futureFeatures;
