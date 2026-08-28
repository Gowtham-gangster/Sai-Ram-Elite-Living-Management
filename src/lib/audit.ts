import { db } from './db';

export interface CreateAuditLogParams {
  adminUserId?: string;
  adminName?: string;
  action: string;
  entityType: 'ROOM' | 'RESIDENT' | 'PAYMENT' | 'SETTING' | 'AUTH' | 'REPORT' | 'REMINDER' | 'ADMIN_USER';
  entityId?: string;
  details?: Record<string, any> | string;
  ipAddress?: string;
}

export async function createAuditLog(params: CreateAuditLogParams) {
  try {
    const detailsString =
      typeof params.details === 'object' ? JSON.stringify(params.details) : params.details || null;

    const log = await db.auditLog.create({
      data: {
        adminUserId: params.adminUserId || null,
        adminName: params.adminName || 'System',
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        details: detailsString,
        ipAddress: params.ipAddress || null,
      },
    });

    // Automatically generate system notification for key operational events
    try {
      let notifyTitle = '';
      let notifyMessage = '';
      let notifyType = 'INFO';
      let linkUrl: string | null = null;

      const d = typeof params.details === 'object' ? params.details : {};

      switch (params.action) {
        case 'ONBOARD_RESIDENT':
          notifyTitle = 'New Resident Admitted';
          notifyMessage = `${d.fullName || 'Resident'} was admitted into Room ${d.roomNumber || ''}.`;
          notifyType = 'SUCCESS';
          linkUrl = '/admin/residents';
          break;
        case 'CHECKOUT_RESIDENT':
        case 'VACATE_RESIDENT':
          notifyTitle = 'Resident Checked Out';
          notifyMessage = `${d.residentName || 'Resident'} successfully checked out. Room slot freed.`;
          notifyType = 'WARNING';
          linkUrl = '/admin/residents';
          break;
        case 'CHANGE_ROOM':
          notifyTitle = 'Room Transfer Completed';
          notifyMessage = `${d.residentName || 'Resident'} transferred from Room ${d.oldRoom} to Room ${d.newRoom}.`;
          notifyType = 'INFO';
          linkUrl = '/admin/residents';
          break;
        case 'RECORD_PAYMENT':
        case 'PAYMENT_STATUS_PAID':
          notifyTitle = 'Payment Verified & Receipt Issued';
          notifyMessage = `Payment of ₹${(d.amountPaid || '').toLocaleString?.('en-IN') || d.amountPaid} confirmed for ${d.residentName || d.resident || 'Resident'} (Room ${d.roomNumber || d.room || ''}).`;
          notifyType = 'SUCCESS';
          linkUrl = '/admin/payments';
          break;
        case 'PAYMENT_STATUS_OVERDUE':
          notifyTitle = 'Account Marked Overdue';
          notifyMessage = `Payment for ${d.resident || 'Resident'} (Room ${d.room || ''}) is overdue.`;
          notifyType = 'ALERT';
          linkUrl = '/admin/payments';
          break;
        case 'PAYMENT_STATUS_REJECTED':
          notifyTitle = 'Payment Submission Rejected';
          notifyMessage = `Payment proof rejected for ${d.resident || 'Resident'}. Reason: ${d.notes || 'Verification failed'}.`;
          notifyType = 'ALERT';
          linkUrl = '/admin/payments';
          break;
        case 'REMINDER_MARK_FAILED':
          notifyTitle = 'Payment Reminder Dispatch Failed';
          notifyMessage = `Reminder dispatch failed for ${d.resident || 'Resident'}.`;
          notifyType = 'ALERT';
          linkUrl = '/admin/reminders';
          break;
        case 'UPDATE_SETTINGS':
          notifyTitle = 'Hostel Settings Updated';
          notifyMessage = `Banking and hostel policy configurations were modified by ${params.adminName || 'Admin'}.`;
          notifyType = 'INFO';
          linkUrl = '/admin/settings';
          break;
        default:
          break;
      }

      if (notifyTitle && notifyMessage) {
        await db.notification.create({
          data: {
            title: notifyTitle,
            message: notifyMessage,
            type: notifyType,
            linkUrl,
          },
        });
      }
    } catch (notifErr) {
      console.warn('Failed to auto-generate notification:', notifErr);
    }

    return log;
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
    return null;
  }
}
