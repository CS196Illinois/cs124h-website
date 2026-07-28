// Note: This file will be useful once our app is authenticated and we can use the google calendar api

// import { google } from 'googleapis';

// export async function GET(request) {
//   const oAuth2Client = new google.auth.OAuth2(
//     process.env.NEXT_PUBLIC_CLIENT_ID,
//     process.env.NEXT_PUBLIC_CLIENT_SECRET,
//     process.env.NEXT_PUBLIC_REDIRECT_URI
//   );

//   // Set the credentials (you need to have an access token and refresh token here)
//   oAuth2Client.setCredentials({
//     access_token: process.env.NEXT_PUBLIC_ACCESS_TOKEN,
//     refresh_token: process.env.NEXT_PUBLIC_REFRESH_TOKEN,
//     scope: 'https://www.googleapis.com/auth/calendar.readonly',
//     token_type: 'Bearer',
//     expiry_date: Date.now() + 3600 * 1000, // example expiry
//   });

//   const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

//   try {
//     const response = await calendar.events.list({
//       calendarId: process.env.NEXT_PUBLIC_CALENDAR_ID, // or your specific calendar ID
//       timeMin: (new Date()).toISOString(),
//       maxResults: 10,
//       singleEvents: true,
//       orderBy: 'startTime',
//     });

//     const events = response.data.items;
//     return new Response(JSON.stringify(events), { status: 200 });
//   } catch (error) {
//     console.error('Error fetching events:', error);
//     return new Response(
//       JSON.stringify({ error: 'Error fetching calendar events' }),
//       { status: 500 }
//     );
//   }
// }

// const { google } = require('googleapis');

// const oAuth2Client = new google.auth.OAuth2(
//     process.env.NEXT_PUBLIC_CLIENT_ID,
//     process.env.NEXT_PUBLIC_CLIENT_SECRET,
//     process.env.NEXT_PUBLIC_REDIRECT_URI
// );

// // Generate an authentication URL to request access
// const scopes = ['https://www.googleapis.com/auth/calendar.readonly']; // Your requested scope

// const authUrl = oAuth2Client.generateAuthUrl({
//   access_type: 'offline', // This is important to get a refresh token
//   scope: scopes,
//   prompt: 'consent', // This ensures that the user is always prompted to grant consent
// });

// console.log('Authorize this app by visiting this URL:', authUrl);
