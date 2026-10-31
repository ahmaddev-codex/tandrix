// The real photos on the site, and where Tandrix points on each, in the photo's own pixels.
// Outlines on the parts photo are what Tandrix's segmenter found on it.
import type { PhotoSpec } from "./Photo";

/** A spreadsheet on a laptop: Tandrix rings the Insert tab. */
export const excelPhoto: PhotoSpec = {
  src: "/photos/budget-laptop.jpeg",
  w: 736,
  h: 1308,
  crop: { x: 44, y: 378, w: 530, h: 440 },
  ring: { x: 76, y: 447, w: 30, h: 16, caption: "Click Insert, then PivotTable", place: "right" },
};

/** System Settings on Wi-Fi. Private names are replaced with neutral ones. */
export const wifiPhoto: PhotoSpec = {
  src: "/photos/wifi-settings.jpeg",
  w: 1460,
  h: 1666,
  crop: { x: 480, y: 20, w: 960, h: 1070 },
  patches: [
    { x: 512, y: 258, w: 330, h: 42, text: "Sam’s iPhone", size: 26 },
    { x: 572, y: 482, w: 330, h: 42, text: "Sam’s iPhone", size: 26 },
    { x: 572, y: 676, w: 230, h: 46, text: "Neighbour", size: 26 },
    { x: 572, y: 768, w: 300, h: 42, text: "Cafe-Guest", size: 26 },
    { x: 572, y: 858, w: 260, h: 42, text: "Home-5G", size: 26 },
  ],
  ring: { x: 500, y: 838, w: 900, h: 82, caption: "Click Home-5G to join it" },
};

/** A calendar on a laptop: Tandrix has found the free slot. */
export const calendarPhoto: PhotoSpec = {
  src: "/photos/calendar-laptop.jpeg",
  w: 736,
  h: 1104,
  crop: { x: 0, y: 110, w: 620, h: 640 },
  ring: {
    x: 368,
    y: 466,
    w: 68,
    h: 78,
    caption: "Thursday at 10 is free. Booking it.",
    place: "belowEnd",
  },
};

/** An exploded diagram from a robot kit's manual: Tandrix names the part. */
export const manualPhoto: PhotoSpec = {
  src: "/photos/robot-manual.jpeg",
  w: 735,
  h: 563,
  ring: {
    x: 258,
    y: 326,
    w: 88,
    h: 72,
    caption: "That’s the ultrasonic sensor. It clips on the front.",
  },
};

/** The kit's parts laid out, with the parts Tandrix's segmenter outlined. */
export const partsPhoto: PhotoSpec = {
  src: "/photos/robot-parts.jpeg",
  w: 736,
  h: 736,
  crop: { x: 0, y: 160, w: 736, h: 440 },
  boxes: [
    { x: 25, y: 404, w: 37, h: 166, label: "Screwdriver" },
    { x: 156, y: 327, w: 116, h: 112, label: "Bracket" },
    { x: 289, y: 327, w: 87, h: 112 },
    { x: 604, y: 287, w: 100, h: 124, label: "Control board" },
  ],
};

/** A printed manual, as Tandrix reads it. */
export const bookletPhoto: PhotoSpec = {
  src: "/photos/manual-booklet.jpeg",
  w: 736,
  h: 736,
};

/** A dashboard open on a laptop. */
export const analyticsPhoto: PhotoSpec = {
  src: "/photos/analytics-laptop.jpeg",
  w: 736,
  h: 1308,
  crop: { x: 0, y: 160, w: 736, h: 760 },
};

/** The same diagram, cropped to the robot, with the sensor ringed: the picture on a step card. */
export const sensorPhoto: PhotoSpec = {
  src: "/photos/robot-manual.jpeg",
  w: 735,
  h: 563,
  crop: { x: 190, y: 250, w: 450, h: 260 },
  ring: { x: 258, y: 326, w: 88, h: 72, caption: "Ultrasonic sensor" },
};
