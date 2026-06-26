export type PendingEmailDraft = {
  to: string;
  toName: string;
  subject: string;
  body: string;
};

export type PendingCalendarBooking = {
  title: string;
  start: Date;
  end: Date;
  summary: string;
};

export type PendingSickDay = {
  day: Date;
  dayLabel: string;
  eventSummaries: string[];
};

export type EmailComposeResult = {
  subject: string;
  body: string;
};

export type ParsedEmailRequest = {
  recipientName: string;
  messageIntent: string;
};
