// The header over a page's sky: the wordmark, the Product menu and the other pages, the theme switch
// and Download.
import { BrandWordmark } from "@tandrix/ui/web";
import { Cta } from "@/components/ui/Cta";
import { primary, product } from "@/content/site";
import { NavDropdown } from "./NavDropdown";
import { NavMenu } from "./NavMenu";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="relative z-[3] flex h-[72px] items-center justify-between gap-6 sm:h-[84px]">
      <BrandWordmark href="/" size="lg" className="text-white no-underline [&_*]:text-white" />
      <nav aria-label="Primary" className="hidden items-center gap-[clamp(20px,3vw,44px)] lg:flex">
        <NavDropdown label="Product" links={product} />
        {primary.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className="text-[15px] font-medium text-white no-underline opacity-90 hover:underline hover:underline-offset-[6px] hover:opacity-100"
          >
            {n.label}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-3 [&>:first-child]:text-white">
        <ThemeToggle />
        <span className="hidden sm:inline">
          <Cta href="/#get" tone="white" arrow={false}>
            Download
          </Cta>
        </span>
        <NavMenu />
      </div>
    </header>
  );
}
