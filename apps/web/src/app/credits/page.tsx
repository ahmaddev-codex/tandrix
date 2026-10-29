// Photo credits for the Tandrix site. Same facts as public/photos/CREDITS.md,
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
    file: "sky-close.jpg",
    maker: "Lance Vanlewen",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: "White Cumulus Clouds against Blue Sky (4)",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:White_Cumulus_Clouds_against_Blue_Sky_(4).jpg",
  },
  {
    file: "tools-flatlay.jpg",
    maker: "Wilfredor",
    licence: "CC0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0",
    source: "Tools 66",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Tools_66.jpg",
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
          <h1 className="heading-32">Photo credits</h1>
          <p className={styles.lead}>
            Photos on the Tandrix website, their makers and licences. Everything else on the site is
            drawn in code.
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
            Photos are resized and compressed for the web. The sky photos are tinted on the page,
            and the outlines drawn over the tools are Tandrix&apos;s.
          </p>
        </main>
      </ScrollReveals>
    </div>
  );
}
