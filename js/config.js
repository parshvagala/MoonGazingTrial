/**
 * config.js - the only file you normally need to edit.
 */
export const CONFIG = {
  // Event date is fixed to 30 October 2026. JavaScript months are 0-based, so October = 9.
  // The 21:00 start time is a placeholder: on this date the Moon is a waning gibbous that
  // rises well after sunset, so check the moonrise time for your campus and adjust the time.
  eventDate: new Date(2026, 9, 30, 21, 0, 0),

  venue: 'CAMPUS OBSERVATION DECK (TBA)',
  entry: 'FREE · OPEN TO ALL',

  // Optional: URL that accepts a JSON POST (Google Apps Script web app, Formspree, ...).
  // Leave empty and the RSVP form only shows a confirmation and stores nothing.
  rsvpUrl: '',
};
