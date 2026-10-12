// Imported by workflows, so it must stay free of activity/Node-only imports.
export const activityOptions = {
  slow: { heartbeatTimeout: undefined },
  heartBeatingWithIgnoringCancelSignal: { heartbeatTimeout: "2 seconds" },
  heartBeatingHonouringCancel: { heartbeatTimeout: "2 seconds" },
};
