import { ThemeSwitcher } from "./theme-switcher";

export function Footer() {
  return (
    <footer className="mb-6 sm:mb-10 flex justify-between items-center">
      <p className="text-sm text-muted-foreground">
        BN 8524538 · ©{" "}
        {new Intl.DateTimeFormat("en-UK", { year: "numeric" }).format()}{" "}
        PrudentBird
      </p>
      <ThemeSwitcher />
    </footer>
  );
}
