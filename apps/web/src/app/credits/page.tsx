// Photo and video credits for the Tandrix site. Same facts as public/photos/CREDITS.md,
// rendered as a page instead of a raw markdown file.
import { ScrollReveals } from "../../components/motion/ScrollReveals";
import styles from "./credits.module.css";
const credits: Array<{
  file: string;
  maker: string;
  licence: string;
  licenceUrl: string;
  source: string;
  sourceUrl: string;
}> = [
  {
    file: "sky-bright.jpg",
    maker: "W.carter",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "Summer clouds over Tuntorp 3",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Summer_clouds_over_Tuntorp_3.jpg",
  },
  {
    file: "sky-fluffy.jpg",
    maker: "Lee Ann Ratledge",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0",
    source: "Cumulus Humilis Clouds, Tennessee, USA",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Cumulus_Humilis_Clouds_-_Tennessee,_USA_-_July_7,_2014.jpg",
  },
  {
    file: "tools-flatlay.jpg",
    maker: "Wilfredor",
    licence: "CC0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0",
    source: "Tools 66",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Tools_66.jpg",
  },
  {
    file: "videos/sky-clouds.mp4",
    maker: "Mixkit",
    licence: "Mixkit Stock Video Free License",
    licenceUrl: "https://mixkit.co/license/#videoFree",
    source: "Clouds in a blue sky",
    sourceUrl:
      "https://mixkit.co/free-stock-video/white-clouds-moving-across-a-clear-blue-sky-quickly-51105/",
  },
  {
    file: "videos/laptop-desk.mp4",
    maker: "Mixkit",
    licence: "Mixkit Stock Video Free License",
    licenceUrl: "https://mixkit.co/license/#videoFree",
    source: "Working on a laptop",
    sourceUrl: "https://mixkit.co/free-stock-video/man-working-on-his-laptop-308/",
  },
  {
    file: "videos/laptop-pair.mp4",
    maker: "Mixkit",
    licence: "Mixkit Stock Video Free License",
    licenceUrl: "https://mixkit.co/license/#videoFree",
    source: "Two people at a laptop",
    sourceUrl: "https://mixkit.co/free-stock-video/hands-of-a-girl-working-on-a-computer-4938/",
  },
  {
    file: "videos/laptop-woman.mp4",
    maker: "Mixkit",
    licence: "Mixkit Stock Video Free License",
    licenceUrl: "https://mixkit.co/license/#videoFree",
    source: "Woman working at a laptop",
    sourceUrl:
      "https://mixkit.co/free-stock-video/young-very-frustrated-woman-in-front-of-her-computer-25575/",
  },
  {
    file: "videos/phone-coffee.mp4",
    maker: "Mixkit",
    licence: "Mixkit Stock Video Free License",
    licenceUrl: "https://mixkit.co/license/#videoFree",
    source: "Phone beside a coffee",
    sourceUrl:
      "https://mixkit.co/free-stock-video/person-on-social-media-while-serving-coffee-4919/",
  },
  {
    file: "videos/workshop.mp4",
    maker: "Mixkit",
    licence: "Mixkit Stock Video Free License",
    licenceUrl: "https://mixkit.co/license/#videoFree",
    source: "Craftsman in a workshop",
    sourceUrl: "https://mixkit.co/free-stock-video/a-carpenter-cleaning-his-tools-773/",
  },
  {
    file: "videos/woodwork.mp4",
    maker: "Mixkit",
    licence: "Mixkit Stock Video Free License",
    licenceUrl: "https://mixkit.co/license/#videoFree",
    source: "Woodworking at a bench",
    sourceUrl:
      "https://mixkit.co/free-stock-video/expert-carpenter-prepares-to-work-on-a-project-in-his-44861/",
  },
  {
    file: "videos/laptop-home.mp4",
    maker: "Mixkit",
    licence: "Mixkit Stock Video Free License",
    licenceUrl: "https://mixkit.co/license/#videoFree",
    source: "Laptop at home",
    sourceUrl: "https://mixkit.co/free-stock-video/woman-researching-on-the-computer-4713/",
  },
];

export default function Credits() {
  return (
    <div className={styles.page}>
      <ScrollReveals>
        <main className={styles.inner}>
          <p className={styles.back}>
            <a href="/">← Tandrix</a>
          </p>
          <h1 className="heading-32">Photo and video credits</h1>
          <p className={styles.lead}>
            Photos and video on the Tandrix website, their makers and licences. App screens, the
            manual page and the pointer are drawn in code.
          </p>
          <h2 className="heading-24" data-reveal>
            Photos
          </h2>
          <div className={styles.card} data-reveal>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Maker</th>
                  <th>Licence</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {credits.map((c) => (
                  <tr key={c.file}>
                    <td>{c.file}</td>
                    <td>{c.maker}</td>
                    <td>
                      <a href={c.licenceUrl} target="_blank" rel="noreferrer">
                        {c.licence}
                      </a>
                    </td>
                    <td>
                      <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                        {c.source}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            Photos and video are resized and compressed for the web, and the skies are tinted on the
            page. The outlines drawn over the tools are the ones Tandrix&apos;s part finder drew.
          </p>
        </main>
      </ScrollReveals>
    </div>
  );
}
