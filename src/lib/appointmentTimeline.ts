import type { Json } from "@/integrations/supabase/types";

export type TimelineEventType =
  | "created"
  | "updated"
  | "status_changed"
  | "rescheduled"
  | "cancelled"
  | "whatsapp";

export type TimelineEvent = {
  id: string;
  at: string;
  type: TimelineEventType;
  details: string;
  by?: string | null;
};

const isTimelineEvent = (value: unknown): value is TimelineEvent => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TimelineEvent>;
  return (
    typeof item.id === "string" &&
    typeof item.at === "string" &&
    typeof item.type === "string" &&
    typeof item.details === "string"
  );
};

export const parseTimeline = (value: Json | null | undefined): TimelineEvent[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isTimelineEvent);
};

export const createTimelineEvent = (
  type: TimelineEventType,
  details: string,
  by?: string | null
): TimelineEvent => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  at: new Date().toISOString(),
  type,
  details,
  by: by ?? null,
});
