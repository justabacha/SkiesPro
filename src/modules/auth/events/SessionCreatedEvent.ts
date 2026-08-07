export interface SessionCreatedEvent {
  userId: string;
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
