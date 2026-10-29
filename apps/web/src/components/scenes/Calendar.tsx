// A calendar week with Tandrix creating an event (Do it for me), the presence pill at the top.
import { Win } from "./parts";
import c from "./Calendar.module.css";

const days = ["Mon 3", "Tue 4", "Wed 5", "Thu 6", "Fri 7"];
const hours = ["9 AM", "10 AM", "11 AM", "Noon", "1 PM", "2 PM"];
/** [day, start hour offset, length in hours, title, colour class] */
const events: Array<[number, number, number, string, string]> = [
  [0, 0.5, 1, "Team sync", "blue"],
  [1, 2, 1.5, "Design review", "violet"],
  [2, 0, 0.75, "Standup", "blue"],
  [2, 3.5, 1, "Lunch with Ana", "green"],
  [4, 1, 2, "Quarter planning", "violet"],
  [0, 4, 1, "Gym", "green"],
];

export function CalendarScene() {
  return (
    <Win title="Calendar" app="calendar">
      <div className={c.toolbar}>
        <b>November 2026</b>
        <span className={c.seg}>
          <span>Day</span>
          <span className={c.segOn}>Week</span>
          <span>Month</span>
        </span>
      </div>
      <div className={c.week}>
        <span />
        {days.map((d) => (
          <span key={d} className={d.startsWith("Thu") ? c.dayOn : c.day}>
            {d}
          </span>
        ))}
        <div className={c.hours}>
          {hours.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <div className={c.cols}>
          {days.map((d) => (
            <span key={d} />
          ))}
          {events.map(([day, at, len, title, tone]) => (
            <span
              key={title}
              className={`${c.event} ${c[tone]}`}
              style={{
                left: `${day * 20}%`,
                top: `${(at / hours.length) * 100}%`,
                height: `${(len / hours.length) * 100}%`,
              }}
            >
              {title}
            </span>
          ))}
          <span
            className={`${c.event} ${c.newEvent}`}
            style={{ left: "60%", top: `${(1 / 6) * 100}%`, height: `${(0.5 / 6) * 100}%` }}
          >
            Dentist
          </span>
          <span className={c.pop}>
            <b>Dentist</b>
            <span>Thursday 6 Nov, 10:00 to 10:30</span>
            <span className={c.popRow}>Dr. Okafor’s practice</span>
            <span className={c.popAsk}>Tandrix asks before it sends the invite</span>
          </span>
        </div>
      </div>
    </Win>
  );
}
