import { env } from "~/env";
import { Home } from "~/components/home/home";

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: "Prudent Bird",
            url: env.BASE_URL,
            email: "me@prudentbird.com",
            jobTitle: "AI & Software Engineer",
            description:
              "AI & Software Engineer building innovative products from concept to reality.",
            sameAs: [
              "https://x.com/prudentbird",
              "https://github.com/prudentbird",
            ],
            contactPoint: {
              "@type": "ContactPoint",
              contactType: "professional",
              email: "me@prudentbird.com",
              url: env.BASE_URL,
            },
            knowsAbout: [
              "Software Engineering",
              "Artificial Intelligence",
              "Web Development",
              "Full Stack Development",
              "React",
              "Next.js",
              "TypeScript",
            ],
            worksFor: [
              {
                "@type": "Organization",
                name: "Ajared Research Inc",
                url: "https://ajared.ca",
              },
              {
                "@type": "Organization",
                name: "PrudentBird Services",
                url: env.BASE_URL,
              },
            ],
            alumniOf: {
              "@type": "EducationalOrganization",
              name: "National Institute of Technology, PH",
              url: "https://niit-ph.com",
            },
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": env.BASE_URL,
            },
            alternateName: "Daniel Wari",
            nationality: "Nigerian",
            gender: "Male",
            givenName: "Daniel",
            familyName: "Wari",
            knowsLanguage: ["English"],
            hasCredential: [
              {
                "@type": "EducationalOccupationalCredential",
                name: "HNG 11 Backend Finalist",
                url: "https://certgo.app/c-2e556964",
              },
              {
                "@type": "EducationalOccupationalCredential",
                name: "HNG 11 Frontend Finalist",
                url: "https://certgo.app/c-85aa914c",
              },
            ],
            image: `${env.BASE_URL}/pfp.png`,
          }).replace(/</g, "\\u003c"),
        }}
      />
      <Home />
    </>
  );
}
