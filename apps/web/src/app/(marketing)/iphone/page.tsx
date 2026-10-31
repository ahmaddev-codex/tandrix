import type { Metadata } from "next";
import { CardTray, Closer, Feature, PageShell, cardShadow } from "@/components/page/Page";
import { Photo } from "@/components/scenes/Photo";
import { bookletPhoto, manualPhoto, partsPhoto, sensorPhoto } from "@/components/scenes/photos";

export const metadata: Metadata = {
  title: "Tandrix for iPhone",
  description:
    "Point your camera and ask what something is or where it goes. Build anything from its real manual, with every step checked.",
};

export default function IphonePage() {
  return (
    <PageShell
      pill={{ state: "looking", label: "Looking through your camera" }}
      title="Tandrix for iPhone"
      lead="For the things in front of you: the kit on the table, the appliance on the wall, the part in your hand. Point the camera, ask, and build it from the real manual."
    >
      <Feature
        id="point"
        title="Point the camera"
        lead="Hold your phone up to something and ask. Tandrix outlines what its answer is about and says it out loud."
        points={[
          {
            title: "“What is this?”",
            body: "It names the part and says what it's for.",
          },
          {
            title: "“Where does this go?”",
            body: "Inside a project, it answers for the step you're on, from the manual.",
          },
          {
            title: "Hands full",
            body: "Hold the mic and ask anything. The answer is spoken, so you don't have to put things down to read.",
          },
        ]}
        media={<Photo spec={manualPhoto} className={cardShadow} />}
      />

      <Feature
        id="manual"
        flip
        title="Built from the real manual"
        lead="Photograph the label or the box. Tandrix reads the make and model and finds the manufacturer's manual."
        points={[
          {
            title: "Steps that cite their page",
            body: "Every step shows the page and figure it came from. Steps without a source say so.",
          },
          {
            title: "No manual online?",
            body: "Add the PDF, or photograph the pages, and the steps come from those.",
          },
          {
            title: "Or start from a goal",
            body: "Say what you want to build. Tandrix writes the steps and marks each one as general practice.",
          },
        ]}
        media={<Photo spec={bookletPhoto} className={cardShadow} />}
      />

      <Feature
        id="checks"
        title="Checked as you go"
        lead="Tandrix doesn't take it on trust. It looks."
        points={[
          {
            title: "Parts check",
            body: "Lay the parts out and take one photo. It outlines what's there and holds any step whose part is missing.",
          },
          {
            title: "Step checks",
            body: "A photo when a step is done. It moves you on, or tells you exactly what looks wrong.",
          },
          {
            title: "Highlights on the photo",
            body: "Ask where a part is and it's outlined on your own photo, so you know which screw is which.",
          },
        ]}
        media={
          <>
            <Photo spec={partsPhoto} className={cardShadow} />
            <Photo spec={sensorPhoto} className={cardShadow} />
          </>
        }
      />

      <CardTray
        id="on-site"
        title="Made for where the work is"
        lead="Garages, plant rooms and kitchen floors, with gloves on and no signal."
        cards={[
          {
            icon: "power",
            title: "Safe steps first",
            body: "Steps with power, pressure, heat or moving parts wait until you confirm it's safe.",
          },
          {
            icon: "book",
            title: "Works offline",
            body: "Open a project once with signal and its manual and step pictures stay on your phone.",
          },
          {
            icon: "mic",
            title: "Hands-free",
            body: "Say next, repeat or ask a question. Tandrix answers out loud.",
          },
          {
            icon: "laptop",
            title: "Carry on at your desk",
            body: "Steps done on a computer go to your Mac, and the project follows you back.",
          },
        ]}
      />

      <Closer next={{ href: "/mac", label: "Tandrix for Mac" }} />
    </PageShell>
  );
}
