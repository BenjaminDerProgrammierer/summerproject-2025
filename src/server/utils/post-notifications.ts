import { prisma } from '../db/prisma.js';
import { sendEmail } from './email.js';

type PublishedPost = {
  id: number;
  title: string;
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

function createPostEmail(post: PublishedPost, username: string): { html: string; text: string } {
  const postUrl = publicUrl(`/post/${post.id}`);
  const preferencesUrl = publicUrl('/account');
  const faviconUrl = publicUrl('/icon/favicon-96x96.png');
  const safeTitle = escapeHtml(post.title);
  const safeUsername = escapeHtml(username);

  return {
    text: [
      `Hello ${username},`,
      '',
      `A new post is online: ${post.title}`,
      '',
      `Read the post: ${postUrl}`,
      `Notification settings: ${preferencesUrl}`,
    ].join('\n'),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f2f3f0;color:#0a0034;font-family:'Inria Sans',Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f3f0;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(10,0,52,.12);">
          <tr>
            <td style="background:#0a0034;padding:26px 34px;color:#ffffff;">
              <table role="presentation" cellspacing="0" cellpadding="0"><tr>
                <td style="width:44px;height:44px;"><img src="${faviconUrl}" width="44" height="44" alt="WEBonTour" style="display:block;width:44px;height:44px;border:0;"></td>
                <td style="padding-left:13px;font:700 25px 'Quicksand',Arial,sans-serif;">WEBonTour</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:38px 34px 18px;">
              <p style="margin:0 0 12px;font-size:17px;line-height:1.65;">Hello ${safeUsername},</p>
              <p style="margin:0 0 28px;font-size:17px;line-height:1.65;color:#34323e;">A new post is online: <strong style="color:#0a0034;">${safeTitle}</strong></p>
              <a href="${postUrl}" style="display:inline-block;background:#1dd31d;color:#0a0034;text-decoration:none;font-weight:700;font-size:16px;padding:14px 24px;border-radius:8px;">Read the post &rarr;</a>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 34px 32px;">
              <div style="height:1px;background:#e8e7ec;margin-bottom:20px;"></div>
              <p style="margin:0;color:#777;font-size:12px;line-height:1.55;">You received this because post notifications are enabled for your WEBonTour account. <a href="${preferencesUrl}" style="color:#cc5800;">Manage notifications</a>.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}

export async function notifySubscribersOfNewPost(post: PublishedPost): Promise<void> {
  const subscribers = await prisma.user.findMany({
    where: { emailNotifications: true },
    select: { email: true, username: true },
  });
  if (subscribers.length === 0) return;

  let nextSubscriber = 0;
  let failedDeliveries = 0;
  const deliver = async (): Promise<void> => {
    while (nextSubscriber < subscribers.length) {
      const subscriber = subscribers[nextSubscriber++];
      if (!subscriber) return;
      const content = createPostEmail(post, subscriber.username);
      try {
        await sendEmail({
          to: subscriber.email,
          subject: `New on WEBonTour: ${post.title}`,
          ...content,
        });
      } catch {
        failedDeliveries += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(5, subscribers.length) }, deliver));
  if (failedDeliveries > 0) {
    console.error(`Could not send ${failedDeliveries} of ${subscribers.length} new-post notification emails`);
  }
}
