// Compatibility shim — the iCal/AppleScript sync has been replaced with
// Google Calendar. All callers continue to import from this module.
export {
  getCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  listAllCalendars,
  clearCache,
  isConnected,
  disconnect,
  getAuthUrl,
  handleCallback,
} from "./google-calendar";
