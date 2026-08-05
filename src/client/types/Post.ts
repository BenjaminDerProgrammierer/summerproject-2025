export interface Attachment {
  id: number;
  filename: string;
  original_filename?: string;
  file_size?: number;
  mime_type?: string;
  post_id?: number;
}

export interface Post {
  id: number;
  title: string;
  slug?: string;
  content: string;
  excerpt?: string;
  author: string;
  author_id: number;
  created_at: string;
  updated_at: string;
  custom_date?: string;
  published?: boolean;
  attachments?: Attachment[];
  category_id?: number;
  category_name?: string;
  tags?: string[];
}
