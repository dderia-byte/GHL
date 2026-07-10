/**
 * Single source of truth for Evantix brand identity, copy and color tokens.
 * Edit this file to re-skin or re-word the advert without touching scene code.
 */

export const brand = {
  name: "Evantix Group",
  shortName: "evantix",
  tagline: "Recruit. Automate. Grow.",
  positioning:
    "CRM and automation systems built for modern care and recruitment businesses.",
  website: "evantixgroup.com",
  cta: "Book Your Free Strategy Call",
  logoPath: "assets/evantix-logo.png",
};

export const colors = {
  white: "#FFFFFF",
  surface: "#F5F7FB",
  surfaceAlt: "#EEF2FA",
  border: "#E2E7F3",

  navy900: "#0B1030",
  navy800: "#121A3D",
  navy700: "#1B2650",
  ink: "#0F1530",
  muted: "#5B6685",
  mutedLight: "#8A93B0",

  blue400: "#4C8DFF",
  blue500: "#2E6BFF",
  blue600: "#1F4FE0",

  cyan300: "#7DF1E8",
  cyan400: "#3FDFD1",
  cyan500: "#17C4B6",

  pink: "#EC4899",

  success: "#12B76A",
  successBg: "#E7F9EF",
  warning: "#F79009",
  warningBg: "#FFF6E5",
  danger: "#F04438",
  dangerBg: "#FDEBEA",

  gradientPrimary: "linear-gradient(120deg, #2E6BFF 0%, #17C4B6 100%)",
  gradientSoft: "linear-gradient(160deg, #EEF4FF 0%, #EAFBF8 100%)",
  gradientDark: "linear-gradient(160deg, #0B1030 0%, #16204A 100%)",
};

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
};

/** Reusable demo copy shown across scenes (clearly illustrative, not real customer data). */
export const demoData = {
  candidate: {
    name: "Sarah Johnson",
    role: "Senior Care Assistant",
    location: "Manchester, UK",
    experience: "4 years",
    availability: "Full-time",
    score: 92,
  },
  client: {
    name: "Meadowfield Care Group",
    vacancies: 6,
    priority: "High",
    owner: "James Patel",
  },
  metrics: {
    applications: 1248,
    responseTimeMinutes: 4,
    interviewsBooked: 328,
    hired: 86,
    openVacancies: 24,
    conversionRate: 27,
    tasksCompleted: 512,
    hoursSaved: 640,
  },
};
