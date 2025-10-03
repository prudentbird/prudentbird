import { ThemeSwitcher } from "./theme-switcher";

export function Footer() {
  return (
    <footer className="py-6 border-t flex justify-between items-center">
      <div className="text-sm text-muted-foreground">
        <p>BN 8524538</p>
        <p>© 2025 PrudentBird</p>
      </div>
      <ThemeSwitcher />
    </footer>
  );
}
