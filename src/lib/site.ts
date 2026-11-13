export const site = {
  name: "CreatorConnect",
  description:
    "A shared space for Sri Lankan brands and creators to discover opportunities and agree on meaningful collaborations.",
} as const;

export const futureFeatures = {
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
