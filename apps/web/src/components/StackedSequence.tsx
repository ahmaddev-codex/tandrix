"use client";
// Scroll-driven stacked card sequence with a synchronized Three.js 3D hardware assembly canvas
// and GSAP ScrollTrigger card-stacking transitions.
import { colors, type ThemeName } from "@tandrix/ui";
import { CheckResult, Icon, StepCard, StepVisual } from "@tandrix/ui/web";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import styles from "./StackedSequence.module.css";

const intake: Array<{ title: string; note: string }> = [
  { title: "Read the label", note: "Raspberry Pi 5" },
  { title: "Get the manual", note: "Build kit, 22 pages" },
  { title: "Write the steps", note: "10 steps, 9 from the manual" },
  { title: "Check the parts", note: "Ethernet cable missing" },
];

const stageLabels = [
  "01 · Intake & parts scan",
  "02 · Cited manual procedure",
  "03 · Visual verification",
] as const;

function currentTheme(): ThemeName {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function StackedSequence() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRefs = useRef<Array<HTMLLIElement | null>>([]);
  const progressRef = useRef(0);
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const section = sectionRef.current;
    if (!section) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = cardRefs.current.filter((el): el is HTMLLIElement => el !== null);

    const ctx = gsap.context(() => {
      // Master ScrollTrigger driving the Three.js assembly progress and stage indicator
      ScrollTrigger.create({
        trigger: section,
        start: "top 65%",
        end: "bottom 35%",
        scrub: reducedMotion ? false : 0.5,
        onUpdate: (self) => {
          progressRef.current = self.progress;
          const idx = Math.min(2, Math.floor(self.progress * 3));
          setActiveStage((prev) => (prev === idx ? prev : idx));
        },
      });

      if (reducedMotion) return;

      // Stacked-card scale & depth recession as each subsequent card scrolls over the previous one
      cards.forEach((card, index) => {
        const inner = card.querySelector<HTMLElement>("[data-card-inner]");
        if (!inner) return;

        gsap.fromTo(
          inner,
          { y: 28, opacity: 0.92 },
          {
            y: 0,
            opacity: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: card,
              start: "top 88%",
              end: "top 35%",
              scrub: 0.4,
            },
          },
        );

        const nextCard = cards[index + 1];
        if (!nextCard) return;

        const targetScale = index === 0 ? 0.94 : 0.965;
        gsap.to(inner, {
          scale: targetScale,
          y: -14 * (cards.length - 1 - index),
          opacity: index === 0 ? 0.68 : 0.8,
          transformOrigin: "center top",
          ease: "none",
          scrollTrigger: {
            trigger: nextCard,
            start: "top 78%",
            end: "top 22%",
            scrub: 0.4,
          },
        });
      });
    }, section);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(4.8, 3.6, 5.4);
    camera.lookAt(0, 0.1, 0);

    const root = new THREE.Group();
    scene.add(root);

    const palette = colors[currentTheme()];

    // 1. Base PCB board wireframe + processor die
    const boardGeo = new THREE.BoxGeometry(3.1, 0.12, 2.1);
    const boardEdges = new THREE.EdgesGeometry(boardGeo);
    const boardMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(palette["gray-600"]),
      transparent: true,
      opacity: 0.65,
    });
    const boardWire = new THREE.LineSegments(boardEdges, boardMat);
    root.add(boardWire);

    const socGeo = new THREE.BoxGeometry(0.75, 0.08, 0.75);
    const socEdges = new THREE.EdgesGeometry(socGeo);
    const socMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(palette.highlight),
      transparent: true,
      opacity: 0.85,
    });
    const socWire = new THREE.LineSegments(socEdges, socMat);
    socWire.position.set(-0.2, 0.1, 0);
    root.add(socWire);

    // 2. Active Cooler assembly group (descends onto the board as scroll progresses)
    const coolerGroup = new THREE.Group();
    const sinkGeo = new THREE.BoxGeometry(1.35, 0.34, 1.35);
    const sinkEdges = new THREE.EdgesGeometry(sinkGeo);
    const sinkMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(palette.highlight),
      transparent: true,
      opacity: 0.9,
    });
    coolerGroup.add(new THREE.LineSegments(sinkEdges, sinkMat));

    const fanGeo = new THREE.RingGeometry(0.24, 0.52, 28);
    fanGeo.rotateX(-Math.PI / 2);
    const fanEdges = new THREE.EdgesGeometry(fanGeo);
    const fanRing = new THREE.LineSegments(fanEdges, sinkMat);
    fanRing.position.y = 0.18;
    coolerGroup.add(fanRing);

    // Mounting pins + guide lines
    const pinGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.55, 10);
    const pinEdges = new THREE.EdgesGeometry(pinGeo);
    const pinA = new THREE.LineSegments(pinEdges, sinkMat);
    pinA.position.set(-0.58, -0.18, -0.58);
    const pinB = new THREE.LineSegments(pinEdges, sinkMat);
    pinB.position.set(0.58, -0.18, 0.58);
    coolerGroup.add(pinA, pinB);

    coolerGroup.position.set(-0.2, 1.35, 0);
    root.add(coolerGroup);

    // 3. Verification pulse ring around the board
    const checkRingGeo = new THREE.RingGeometry(1.75, 1.82, 48);
    checkRingGeo.rotateX(-Math.PI / 2);
    const checkRingMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette["green-700"]),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const checkRing = new THREE.Mesh(checkRingGeo, checkRingMat);
    checkRing.position.y = -0.05;
    root.add(checkRing);

    // 4. Subtle 3D spatial reference grid points
    const ptsCount = 48;
    const ptsPositions = new Float32Array(ptsCount * 3);
    for (let i = 0; i < ptsCount; i++) {
      const angle = (i / ptsCount) * Math.PI * 2;
      const radius = 2.1 + (i % 3) * 0.35;
      ptsPositions[i * 3] = Math.cos(angle) * radius;
      ptsPositions[i * 3 + 1] = ((i % 5) - 2) * 0.25;
      ptsPositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const ptsGeo = new THREE.BufferGeometry();
    ptsGeo.setAttribute("position", new THREE.BufferAttribute(ptsPositions, 3));
    const ptsMat = new THREE.PointsMaterial({
      color: new THREE.Color(palette["gray-500"]),
      size: 0.045,
      transparent: true,
      opacity: 0.55,
    });
    const points = new THREE.Points(ptsGeo, ptsMat);
    root.add(points);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    const applyThemeColors = () => {
      const next = colors[currentTheme()];
      boardMat.color.set(next["gray-600"]);
      socMat.color.set(next.highlight);
      sinkMat.color.set(next.highlight);
      checkRingMat.color.set(next["green-700"]);
      ptsMat.color.set(next["gray-500"]);
    };

    const themeObserver = new MutationObserver(applyThemeColors);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rafId = 0;
    let visible = true;

    const renderFrame = (time: number) => {
      const p = progressRef.current;
      // Exploded at p=0 (y=1.35) -> seated flush at p>=0.72 (y=0.28)
      const seatProgress = Math.min(1, Math.max(0, (p - 0.1) / 0.62));
      coolerGroup.position.y = 1.35 - seatProgress * 1.07;

      // Rotate assembly smoothly with scroll + gentle idle drift
      const drift = reducedMotion ? 0 : time * 0.00025;
      root.rotation.y = -0.35 + p * 1.15 + drift;
      root.rotation.x = 0.08 - p * 0.06;
      fanRing.rotation.y = p * Math.PI * 3 + drift * 4;

      // Stage 3 verification ring glow
      const verifyAlpha = Math.min(1, Math.max(0, (p - 0.68) / 0.22));
      checkRingMat.opacity = verifyAlpha * 0.72;
      const ringScale = 0.92 + verifyAlpha * 0.12;
      checkRing.scale.set(ringScale, ringScale, ringScale);

      renderer.render(scene, camera);
      if (!reducedMotion && visible) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        if (visible && !reducedMotion) {
          window.cancelAnimationFrame(rafId);
          rafId = window.requestAnimationFrame(renderFrame);
        }
      },
      { threshold: 0.05 },
    );
    intersection.observe(section);

    renderFrame(0);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      themeObserver.disconnect();
      intersection.disconnect();
      boardGeo.dispose();
      boardEdges.dispose();
      boardMat.dispose();
      socGeo.dispose();
      socEdges.dispose();
      socMat.dispose();
      sinkGeo.dispose();
      sinkEdges.dispose();
      sinkMat.dispose();
      fanGeo.dispose();
      fanEdges.dispose();
      pinGeo.dispose();
      pinEdges.dispose();
      checkRingGeo.dispose();
      checkRingMat.dispose();
      ptsGeo.dispose();
      ptsMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={sectionRef} className={styles.wrapper}>
      <div className={styles.stageBackdrop} aria-hidden="true">
        <div className={styles.backdropBar}>
          <span className={styles.backdropTag}>{stageLabels[activeStage]}</span>
          <span className={styles.backdropHint}>Scroll to stack steps</span>
        </div>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>

      <ol className={styles.sequence} aria-label="How a project goes">
        <li
          ref={(el) => {
            cardRefs.current[0] = el;
          }}
          className={styles.stageCard}
          style={{ ["--stack-index" as string]: 0 }}
        >
          <div data-card-inner className={styles.cardSurface}>
            <div className={styles.stageText}>
              <div className={styles.stageMeta}>
                <span className={styles.num}>1</span>
                <span className={styles.stageCount}>Step 01 of 03</span>
              </div>
              <h3 className="heading-24">Show it what you have</h3>
              <p className={styles.body}>
                A photo of the label, the parts laid out, where you've got to. Tandrix reads the
                model, finds the manual and checks nothing's missing, before you pick up a tool.
              </p>
            </div>
            <div className={styles.stageVisual}>
              <div className={styles.intake}>
                <Image
                  src="/photos/fitting-ssd.jpg"
                  alt="Hands fitting an SSD into a computer case"
                  width={2000}
                  height={1333}
                  sizes="(max-width: 900px) 100vw, 520px"
                  className={styles.intakePhoto}
                />
                <ul className={styles.stages} aria-label="Setting up">
                  {intake.map((s, i) => (
                    <li key={s.title}>
                      <Icon name={i === 3 ? "alert" : "check"} size={20} />
                      <span>
                        <b>{s.title}</b>
                        <span className={i === 3 ? styles.warn : undefined}>{s.note}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </li>

        <li
          ref={(el) => {
            cardRefs.current[1] = el;
          }}
          className={styles.stageCard}
          style={{ ["--stack-index" as string]: 1 }}
        >
          <div data-card-inner className={styles.cardSurface}>
            <div className={styles.stageText}>
              <div className={styles.stageMeta}>
                <span className={styles.num}>2</span>
                <span className={styles.stageCount}>Step 02 of 03</span>
              </div>
              <h3 className="heading-24">Every step from the manual</h3>
              <p className={styles.body}>
                One action per step, with the page it came from and the picture that goes with it.
                Steps the manual doesn't cover say so.
              </p>
            </div>
            <div className={styles.stageVisual}>
              <StepCard
                index={3}
                total={10}
                title="Press both pins down until they click"
                body="Hold the cooler over the board with the fan above the processor and the pins over the two holes."
                status="pending"
                statusLabel="To do"
                source="Manual p.1"
                visual={
                  <StepVisual
                    items={[
                      {
                        id: "manual",
                        label: "Manual p.1",
                        source: "Manual p.1",
                        sourceKind: "manual",
                        src: "/photos/kit-sheet-p1.jpg",
                        alt: "The kit sheet's page 1: what's in the box and how to fit the cooler",
                        aspectRatio: 1240 / 1754,
                      },
                    ]}
                  />
                }
              />
            </div>
          </div>
        </li>

        <li
          ref={(el) => {
            cardRefs.current[2] = el;
          }}
          className={styles.stageCard}
          style={{ ["--stack-index" as string]: 2 }}
        >
          <div data-card-inner className={styles.cardSurface}>
            <div className={styles.stageText}>
              <div className={styles.stageMeta}>
                <span className={styles.num}>3</span>
                <span className={styles.stageCount}>Step 03 of 03</span>
              </div>
              <h3 className="heading-24">It checks your work</h3>
              <p className={styles.body}>
                Take a photo when you're done. Tandrix says whether it looks right and why, and says
                plainly when a photo can't show it.
              </p>
            </div>
            <div className={`${styles.stageVisual} ${styles.checks}`}>
              <CheckResult
                result="fail"
                reason="The Active Cooler isn't on the board yet. Fit it over the processor, then check again."
                evidence="Photo 10:41"
                thumbnail={
                  <Image
                    src="/photos/pi5-board.jpg"
                    alt="The bare board"
                    width={176}
                    height={130}
                  />
                }
              />
              <CheckResult
                result="pass"
                reason="The cooler sits flat over the processor with both pins through the board."
                evidence="Photo 10:46"
                thumbnail={
                  <Image
                    src="/photos/pi5-board-cooler.jpg"
                    alt="The board with the cooler fitted"
                    width={176}
                    height={130}
                  />
                }
              />
            </div>
          </div>
        </li>
      </ol>
    </div>
  );
}
