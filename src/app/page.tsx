import { Hero } from "~/components/hero";
import { Stats } from "~/components/stats";
import { Footer } from "~/components/footer";
import { Projects } from "~/components/projects";

export default function Home() {
  return (
    <main className="flex flex-col gap-10 sm:gap-16 min-h-screen w-full max-w-3xl mx-auto px-6 my-20 md:my-30">
      <Hero />
      <Stats />
      <Projects />
      <Footer />
    </main>
  );
}
