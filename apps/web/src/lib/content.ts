export const profile = {
  realName: "Daniel Wari",
  role: "AI & Software Engineer",
  email: "me@prudentbird.com",
  bio: "Over the years, I've taken ideas from simple concepts to functional products that users find genuinely useful in their day to day lives.",
  affiliations: [
    { name: "Ajared Research Inc", href: "https://ajared.ca" },
    { name: "PrudentBird Services", href: "https://prudentbird.com" },
  ],
  business: { label: "BN 8524538" },
};

export const links = [
  { label: "GitHub", href: "https://github.com/prudentbird", external: true },
  { label: "Twitter", href: "https://x.com/prudentbird", external: true },
  { label: "Resume", href: "/cv.pdf", external: true },
] as const;

export const NEW_TAB_HINT_ID = "new-tab-hint";

export function externalProps(external: boolean) {
  return external
    ? {
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-describedby": NEW_TAB_HINT_ID,
      }
    : {};
}
