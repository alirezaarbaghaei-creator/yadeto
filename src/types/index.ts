export type PageId =
  | 'home'
  | 'calendar'
  | 'tasks'
  | 'assistant'
  | 'admin'
  | 'account'
  | 'pricing';

export type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  /** Optional quick-reply options shown to user */
  options?: string[];
};
