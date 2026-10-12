// Imported by workflows, so it must stay free of activity/Node-only imports.
export const activityOptions = {
  slow: { heartbeatTimeout: undefined },
  heartbeatingWithIgnoringCancelSignal: { heartbeatTimeout: "2 seconds" },
  heartbeatingHonouringCancel: { heartbeatTimeout: "2 seconds" },
};
