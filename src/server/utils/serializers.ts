type PostRecord = {
  id: number;
  title: string;
  content: string;
  authorId: number | null;
  categoryId: number | null;
  customDate: Date | null;
  isPinned: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  author: { id: number; username: string } | null;
  category: { id: number; name: string } | null;
  attachments: Array<{ id: number; filename: string }>;
  tags: Array<{ tag: { id: number; name: string } }>;
};

export function serializePost(post: PostRecord) {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    custom_date: post.customDate,
    is_pinned: post.isPinned,
    created_at: post.createdAt,
    updated_at: post.updatedAt,
    author: post.author?.username ?? null,
    author_id: post.authorId,
    category_id: post.categoryId,
    category_name: post.category?.name ?? null,
    tags: post.tags.map(({ tag }) => ({ id: tag.id, name: tag.name })),
    attachments: post.attachments.map(attachment => ({ id: attachment.id, filename: attachment.filename })),
  };
}

type CommentRecord = {
  id: number;
  content: string;
  parentId: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  isDeleted: boolean | null;
  authorId: number | null;
  author: { username: string } | null;
};

export function serializeComment(comment: CommentRecord) {
  return {
    id: comment.id,
    content: comment.content,
    parent_id: comment.parentId,
    created_at: comment.createdAt,
    updated_at: comment.updatedAt,
    is_deleted: comment.isDeleted,
    author: comment.author?.username ?? null,
    author_id: comment.authorId,
  };
}
