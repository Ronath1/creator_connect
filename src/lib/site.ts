export const site = {
  name: "CreatorConnect",
  description:
    "A shared space for Sri Lankan brands and creators to discover opportunities and agree on meaningful collaborations.",
} as const;

export const futureFeatures = {
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
