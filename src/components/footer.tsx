import { ThemeSwitcher } from "./theme-switcher";

export function Footer() {
  return (
    <footer className="pt-10 sm:pt-16 border-t flex flex-col gap-5 sm:gap-10 items-center">
      <div className="text-center text-sm text-muted-foreground">
        <p>BN 8524538</p>
        <p>© 2025 PrudentBird Services</p>
      </div>
      <ThemeSwitcher />
    </footer>
  );
}
