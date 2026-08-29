import { db } from './db';

export interface CreateNotificationParams {
  title: string;
  message: string;
  type?: 'INFO' | 'WARNING' | 'SUCCESS' | 'ALERT';
  linkUrl?: string | null;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    return await db.notification.create({
      data: {
        title: params.title,
        message: params.message,
        type: params.type || 'INFO',
        linkUrl: params.linkUrl || null,
      },
    });
  } catch (err) {
    console.warn('Failed to create notification:', err);
    return null;
  }
}
