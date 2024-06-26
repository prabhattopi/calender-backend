const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');

const oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

// Set the refresh token from the OAuth Playground
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
});

// Middleware to check for Google OAuth2 token
const checkAuth = async (req, res, next) => {
  if (req.headers.authorization) {
    oauth2Client.setCredentials({
      access_token: req.headers.authorization.split(' ')[1],
    });
    try {
      await oauth2Client.getAccessToken();
      next();
    } catch (error) {
      res.status(401).json({ message: 'Unauthorized', error: error.message });
    }
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

// Apply the checkAuth middleware to all routes
router.use(checkAuth);

// CRUD endpoints for events

// Create an Event
router.post('/', async (req, res) => {
  try {
    const newEvent = new Event(req.body);
    const savedEvent = await newEvent.save();
    console.log(savedEvent);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const startDate = dayjs(savedEvent.date).toISOString();
    const endDate = dayjs(savedEvent.date).add(savedEvent.duration, 'hour').toISOString();

    const googleEvent = {
      summary: savedEvent.title,
      description: savedEvent.description,
      conferenceDataVersion: 1,

      start: {
        dateTime: startDate,
        timeZone: "Asia/Kolkata"
      },
      end: {
        dateTime: endDate,
        timeZone: "Asia/Kolkata"
      },
      conferenceData: {
        createRequest: {requestId: uuidv4()},
        "conferenceSolutionKey": {
          "type": "hangoutsMeet"
        },
      },
      'attendees': JSON.parse(savedEvent.participants),
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: googleEvent,
    });

    savedEvent.googleEventId = response.data.id;
    await savedEvent.save();

    res.json(savedEvent);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get All Events
router.get('/', async (req, res) => {
  try {
    const events = await Event.find();
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a Single Event
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (event) {
      res.json(event);
    } else {
      res.status(404).json({ message: 'Event not found' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update an Event
router.put('/:id', async (req, res) => {
  try {
    const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });

    if (updatedEvent.googleEventId) {
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const startDate = dayjs(updatedEvent.date).toISOString();
      const endDate = dayjs(updatedEvent.date).add(updatedEvent.duration, 'hour').toISOString();

      const googleEvent = {
        summary: updatedEvent.title,
        description: updatedEvent.description,
        start: {
          dateTime: startDate,
          timeZone: "Asia/Kolkata"
        },
        end: {
          dateTime: endDate,
          timeZone: "Asia/Kolkata"
        },
      };

      await calendar.events.update({
        calendarId: 'primary',
        eventId: updatedEvent.googleEventId,
        resource: googleEvent,
      });
    }

    res.json(updatedEvent);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete an Event
router.delete('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (event && event.googleEventId) {
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: event.googleEventId,
      });
    }

    if (event) {
      res.json({ message: 'Event deleted' });
    } else {
      res.status(404).json({ message: 'Event not found' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
