import { trackEvent } from "@/lib/trackEvent";

export function trackEventInBackground(eventName: string, metadata?: Record<string, unknown>) {
  void trackEvent(eventName, metadata);
}
