export interface UserRegisteredEvent {
  userId: string;
  email: string;
  displayName: string;
  registeredAt: Date;
}
