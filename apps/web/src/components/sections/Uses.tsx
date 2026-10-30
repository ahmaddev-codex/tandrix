// Help with whatever's in front of you: the kinds of work, in a tray of cards.
import { Icon } from "@tandrix/ui/web";
import { Clip } from "@/components/ui/Clip";
import { Cta } from "@/components/ui/Cta";
import { uses } from "@/content/home";
import { cn } from "@/lib/cn";
import { CardIcon, Section, SectionHead, Tray } from "./Section";

const card =
  "flex min-h-[250px] flex-col items-start gap-2.5 rounded-[20px] bg-paper p-[22px] text-ink no-underline transition-[transform,box-shadow] duration-300 ease-out-soft hover:-translate-y-[3px] hover:shadow-soft [&_h3]:mt-auto [&_h3]:text-2xl [&_h3]:font-medium [&_h3]:tracking-[-0.03em] [&_p]:max-w-[34ch] [&_p]:text-[15.5px] [&_p]:leading-normal [&_p]:text-text-2";
const wide =
  "sm:col-span-2 grid min-h-[300px] items-stretch gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]";

function WideCard({
  icon,
  title,
  body,
  clip,
}: {
  icon: "home" | "hand";
  title: string;
  body: string;
  clip: string;
}) {
  return (
    <article className={cn(card, wide)}>
      <div className="flex flex-col items-start gap-2.5">
        <CardIcon>
          <Icon name={icon} size={20} />
        </CardIcon>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] bg-mist sm:aspect-auto">
        <Clip name={clip} className="absolute inset-0 size-full object-cover" />
      </div>
    </article>
  );
}

export function Uses() {
  return (
    <Section
      id="uses"
      labelledBy="uses-title"
      presence={{ state: "doing", label: "Tandrix is in control" }}
    >
      <SectionHead
        id="uses-title"
        title="Help with whatever's in front of you"
        lead="Everyday jobs, new apps and hands-on builds. Say the goal; Tandrix works out the steps and goes through them with you."
      >
        <Cta href="#get">Get Tandrix</Cta>
      </SectionHead>
      <Tray>
        <WideCard
          icon="home"
          title="Everyday life"
          body="Set up the new appliance, find what the blinking light means, put the furniture together."
          clip="laptop-home"
        />
        <WideCard
          icon="hand"
          title="Hands-on"
          body="Assembly, setup and maintenance from the real manual, with risky steps confirmed first."
          clip="working-on-electornics"
        />
        {uses.map((u) => (
          <article key={u.title} className={card}>
            <CardIcon>
              <Icon name={u.icon} size={20} />
            </CardIcon>
            <h3>{u.title}</h3>
            <p>{u.body}</p>
          </article>
        ))}
        <a
          href="/technical"
          className={cn(
            card,
            "bg-[#0b0b0c] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&_p]:text-white/[0.72]",
          )}
        >
          <CardIcon>
            <Icon name="gear" size={20} />
          </CardIcon>
          <h3>How Tandrix works</h3>
          <p>The layers it adds over your work, and how you stay in control.</p>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#8fbcff]">
            See inside <Icon name="arrowRight" size={16} />
          </span>
        </a>
      </Tray>
    </Section>
  );
}
