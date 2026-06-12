export type Role = "user" | "assistant";

export type Turn = {
  role: Role;
  text: string;
  error?: boolean;
};
