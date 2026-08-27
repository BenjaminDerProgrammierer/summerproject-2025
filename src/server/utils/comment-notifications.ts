import { prisma } from '../db/prisma.js';
import { sendEmail } from './email.js';

type CreatedComment = {
  id: number;
  authorId: number | null;
  parentId: number | null;
  postId: number | null;
};

type Recipient = {
  email: string;
  username: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]!);
}

function publicUrl(path: string): string {
  const origin = (process.env.APP_URL?.trim() || `http://localhost:${process.env.PORT || '3000'}`).replace(/\/$/, '');
  return `${origin}${path}`;
}

function createCommentEmail(
  recipient: Recipient,
  authorName: string,
  post: { id: number; title: string },
  content: string,
  isReply: boolean,
): { html: string; text: string } {
  const postUrl = publicUrl(`/post/${post.id}`);
  const preferencesUrl = publicUrl('/account');
  const faviconUrl = publicUrl('/icon/favicon-96x96.png');
  const activity = isReply ? 'replied to your comment' : 'posted a new comment';
  const notificationKind = isReply ? 'reply' : 'new-comment';
  const preview = content.length > 240 ? `${content.slice(0, 237)}…` : content;

  return {
    text: [
      `Hello ${recipient.username},`,
      '',
      `${authorName} ${activity} on “${post.title}”:`,
      '',
      preview,
      '',
      `View the conversation: ${postUrl}`,
      `Notification settings: ${preferencesUrl}`,
    ].join('\n'),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f2f3f0;color:#0a0034;font-family:'Inria Sans',Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f3f0;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(10,0,52,.12);">
          <tr><td style="background:#0a0034;padding:26px 34px;color:#ffffff;">
            <table role="presentation" cellspacing="0" cellpadding="0"><tr>
              <td style="width:44px;height:44px;"><img src="${faviconUrl}" width="44" height="44" alt="WEBonTour" style="display:block;width:44px;height:44px;border:0;"></td>
              <td style="padding-left:13px;font:700 25px 'Quicksand',Arial,sans-serif;">WEBonTour</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:38px 34px 18px;">
            <p style="margin:0 0 12px;font-size:17px;line-height:1.65;">Hello ${escapeHtml(recipient.username)},</p>
            <p style="margin:0 0 18px;font-size:17px;line-height:1.65;color:#34323e;"><strong style="color:#0a0034;">${escapeHtml(authorName)}</strong> ${activity} on <strong style="color:#0a0034;">${escapeHtml(post.title)}</strong>:</p>
            <blockquote style="margin:0 0 28px;padding:14px 18px;border-left:4px solid #1dd31d;background:#f5f6f2;color:#34323e;white-space:pre-wrap;">${escapeHtml(preview)}</blockquote>
            <a href="${postUrl}" style="display:inline-block;background:#1dd31d;color:#0a0034;text-decoration:none;font-weight:700;font-size:16px;padding:14px 24px;border-radius:8px;">View the conversation &rarr;</a>
          </td></tr>
          <tr><td style="padding:22px 34px 32px;">
            <div style="height:1px;background:#e8e7ec;margin-bottom:20px;"></div>
            <p style="margin:0;color:#777;font-size:12px;line-height:1.55;">You received this because ${notificationKind} notifications are enabled for your WEBonTour account. <a href="${preferencesUrl}" style="color:#cc5800;">Manage notifications</a>.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}

async function deliver(
  recipients: Recipient[],
  authorName: string,
  post: { id: number; title: string },
  content: string,
  isReply: boolean,
): Promise<void> {
  let nextRecipient = 0;
  let failedDeliveries = 0;
  const sendNext = async (): Promise<void> => {
    while (nextRecipient < recipients.length) {
      const recipient = recipients[nextRecipient++];
      if (!recipient) return;
      try {
        await sendEmail({
          to: recipient.email,
          subject: isReply ? `${authorName} replied to your comment` : `New comment on WEBonTour: ${post.title}`,
          ...createCommentEmail(recipient, authorName, post, content, isReply),
        });
      } catch {
        failedDeliveries += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(5, recipients.length) }, sendNext));
  if (failedDeliveries > 0) {
    console.error(`Could not send ${failedDeliveries} of ${recipients.length} comment notification emails`);
  }
}

export async function notifyAboutComment(createdComment: CreatedComment): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: { id: createdComment.id },
    select: {
      content: true,
      author: { select: { username: true } },
      post: { select: { id: true, title: true } },
      parent: {
        select: {
          author: { select: { id: true, email: true, username: true, replyNotifications: true } },
        },
      },
    },
  });
  if (!comment?.post) return;

  const authorName = comment.author?.username ?? 'Someone';
  if (createdComment.parentId) {
    const parentAuthor = comment.parent?.author;
    if (!parentAuthor?.replyNotifications || parentAuthor.id === createdComment.authorId) return;
    await deliver([parentAuthor], authorName, comment.post, comment.content, true);
    return;
  }

  const recipients = await prisma.user.findMany({
    where: {
      commentNotifications: true,
      ...(createdComment.authorId ? { id: { not: createdComment.authorId } } : {}),
      role: { name: { in: ['writer', 'moderator', 'admin'] } },
    },
    select: { email: true, username: true },
  });
  await deliver(recipients, authorName, comment.post, comment.content, false);
}
