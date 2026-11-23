// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://10faf775bba5c23acdd903fd514b0d7b@o4512366675034112.ingest.de.sentry.io/4512366690631760",

  // Removed replayIntegration to save quota and protect privacy

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Turned off Session Replay to save the free tier limit
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  dataCollection: {
    // PII protection enabled to hide sensitive partner/user data
    userInfo: false,
    httpBodies: [],
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;