// JXA script for bidirectional Calendar.app sync
// Executed via: osascript -l JavaScript scripts/ical-bridge.js <command> <args...>

function run(argv) {
  const command = argv[0];
  const Calendar = Application("Calendar");

  switch (command) {
    case "read": {
      const calName = argv[1];
      const startISO = argv[2];
      const endISO = argv[3];

      const cal = Calendar.calendars.whose({ name: calName })[0];
      if (!cal) {
        return JSON.stringify([]);
      }

      const startDate = new Date(startISO);
      const endDate = new Date(endISO);

      const events = cal.events.whose({
        _and: [
          { startDate: { _greaterThan: startDate } },
          { startDate: { _lessThan: endDate } },
        ],
      });

      const results = [];
      const count = events.length;
      for (let i = 0; i < count; i++) {
        try {
          const evt = events[i];
          results.push({
            uid: evt.uid(),
            title: evt.summary(),
            startDate: evt.startDate().toISOString(),
            endDate: evt.endDate().toISOString(),
            allDay: evt.alldayEvent(),
          });
        } catch (e) {
          // Skip events that can't be read
        }
      }
      return JSON.stringify(results);
    }

    case "create": {
      const calName = argv[1];
      const payload = JSON.parse(argv[2]);

      const cal = Calendar.calendars.whose({ name: calName })[0];
      if (!cal) {
        throw new Error(`Calendar "${calName}" not found`);
      }

      const evt = Calendar.Event({
        summary: payload.title,
        startDate: new Date(payload.startDate),
        endDate: new Date(payload.endDate),
        location: payload.location || "",
        description: payload.notes || "",
      });

      cal.events.push(evt);

      return JSON.stringify({ uid: evt.uid() });
    }

    case "delete": {
      const calName = argv[1];
      const eventUid = argv[2];

      const cal = Calendar.calendars.whose({ name: calName })[0];
      if (!cal) {
        throw new Error(`Calendar "${calName}" not found`);
      }

      const events = cal.events.whose({ uid: eventUid });
      if (events.length > 0) {
        Calendar.delete(events[0]);
      }

      return JSON.stringify({ success: true });
    }

    case "list-calendars": {
      const cals = Calendar.calendars();
      const names = cals.map((c) => c.name());
      return JSON.stringify(names);
    }

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}
