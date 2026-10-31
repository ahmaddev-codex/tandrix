// Get Tandrix: the Mac, the iPhone and the shared report.
import { Icon } from "@tandrix/ui/web";
import { Cta } from "@/components/ui/Cta";
import { EarlyAccess } from "@/components/widgets/EarlyAccess";
import { platforms } from "@/content/home";
import { EARLY_ACCESS } from "@/lib/downloads";
import { Section, SectionHead, Soft, Tray } from "./Section";

export function GetTandrix() {
  return (
    <Section
      id="get"
      labelledBy="get-title"
      presence={{ state: "listening", label: "Ready when you are" }}
    >
      <SectionHead
        id="get-title"
        title={
          <>
            One assistant,
            <Soft> on every screen you work on</Soft>
          </>
        }
        lead="Start on one, finish on the other. Your Mac points and does; your iPhone sees the world with you."
      />
      {EARLY_ACCESS ? <EarlyAccess /> : null}
      <Tray three>
        {platforms.map((p) => (
          <article
            key={p.name}
            className="grid content-start gap-[18px] rounded-[20px] bg-paper p-6"
          >
            <h3 className="flex items-center gap-2.5 text-lg font-medium">
              <Icon name={p.icon} size={20} weight="fill" className="flex-none text-highlight" />
              <span>{p.name}</span>
            </h3>
            <p className="max-w-[34ch] text-base leading-normal text-text-2">{p.lead}</p>
            <p className="text-[clamp(36px,3.6vw,48px)] leading-none font-normal tracking-[-0.04em]">
              {p.big}
            </p>
            <ul className="mt-1 mb-2 grid list-none gap-3 p-0 text-[15px]">
              {p.items.map((it) => (
                <li key={it} className="flex items-center gap-2.5">
                  <Icon
                    name="sealCheck"
                    size={20}
                    weight="fill"
                    className="flex-none text-highlight"
                  />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
            <Cta href={p.cta.href} arrow={false} block external={p.cta.external}>
              {p.cta.label}
            </Cta>
          </article>
        ))}
      </Tray>
    </Section>
  );
}
