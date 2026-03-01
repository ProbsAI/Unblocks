export {
  createNotification,
  createBulkNotifications,
  subscribeToStream,
} from './create'
export { markAsRead, markAllAsRead, getUnreadCount } from './markRead'
export { getNotifications, deleteNotification } from './getNotifications'
export { getPreferences, updatePreference } from './preferences'
export type {
  NotificationsConfig,
  NotificationType,
  Notification,
  CreateNotificationInput,
  NotificationPreference,
  OnNotificationCreatedArgs,
} from './types'
