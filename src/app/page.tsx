import { env } from "~/env";
import { Hero } from "~/components/hero";
import { Stats } from "~/components/stats";
import { Footer } from "~/components/footer";
import { Projects } from "~/components/projects";

export default function Home() {
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
            email: "prudentbird@gmail.com",
            jobTitle: "AI & Software Engineer",
            description:
              "AI & Software Engineer building innovative products from concept to reality.",
            sameAs: [
              "https://x.com/prudentbird",
              "https://github.com/prudentbird",
            ],
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
                url: "https://ajared.ng",
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
              url: "https://niitph.com",
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
      <main className="flex flex-col gap-10 sm:gap-16 min-h-screen w-full max-w-3xl mx-auto px-6 mt-20 md:mt-32">
        <Hero />
        <Stats />
        <Projects />
        <Footer />
      </main>
    </>
  );
}
