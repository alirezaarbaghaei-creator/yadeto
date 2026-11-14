export type PageId =
  | 'home'
  | 'calendar'
  | 'tasks'
  | 'assistant'
  | 'more'
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
