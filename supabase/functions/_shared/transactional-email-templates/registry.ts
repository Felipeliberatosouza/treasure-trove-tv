/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as doubtApproved } from './doubt-approved.tsx'
import { template as doubtAnswered } from './doubt-answered.tsx'
import { template as doubtSentConfirmation } from './doubt-sent-confirmation.tsx'
import { template as doubtQuestionApproved } from './doubt-question-approved.tsx'
import { template as doubtAreaInvite } from './doubt-area-invite.tsx'
import { template as doubtNewAnswer } from './doubt-new-answer.tsx'
import { template as welcomeStudent } from './welcome-student.tsx'
import { template as welcomeTeacher } from './welcome-teacher.tsx'
import { template as newTeacherAdminNotify } from './new-teacher-admin-notify.tsx'
import { template as newStudentAdminNotify } from './new-student-admin-notify.tsx'
import { template as contentApproved } from './content-approved.tsx'
import { template as contentRejected } from './content-rejected.tsx'
import { template as contractSigned } from './contract-signed.tsx'
import { template as paymentConfirmation } from './payment-confirmation.tsx'
import { template as subscriptionCancelled } from './subscription-cancelled.tsx'
import { template as suspiciousLoginAdminNotify } from './suspicious-login-admin-notify.tsx'
import { template as planChanged } from './plan-changed.tsx'
import { template as subscriptionChangeAdminNotify } from './subscription-change-admin-notify.tsx'
import { template as contentEditedAdminNotify } from './content-edited-admin-notify.tsx'
import { template as commitmentPenaltyRefunded } from './commitment-penalty-refunded.tsx'
import { template as teacherPaymentPaid } from './teacher-payment-paid.tsx'
import { template as passwordRecovery } from './password-recovery.tsx'
import { template as passwordChangedAdmin } from './password-changed-admin.tsx'
import { template as contactMessage } from './contact-message.tsx'
import { template as cashbackReferralShare } from './cashback-referral-share.tsx'
import { template as referralAccessInvite } from './referral-access-invite.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'password_recovery': passwordRecovery,
  'password-recovery': passwordRecovery,
  'password_changed_admin': passwordChangedAdmin,
  'password-changed-admin': passwordChangedAdmin,
  'doubt-approved': doubtApproved,
  'doubt-answered': doubtAnswered,
  'doubt-sent-confirmation': doubtSentConfirmation,
  'doubt-question-approved': doubtQuestionApproved,
  'welcome-student': welcomeStudent,
  'welcome-teacher': welcomeTeacher,
  'new-teacher-admin-notify': newTeacherAdminNotify,
  'new-student-admin-notify': newStudentAdminNotify,
  'content-approved': contentApproved,
  'content-rejected': contentRejected,
  'contract-signed': contractSigned,
  'payment-confirmation': paymentConfirmation,
  'subscription-cancelled': subscriptionCancelled,
  'suspicious-login-admin-notify': suspiciousLoginAdminNotify,
  'plan-changed': planChanged,
  'subscription-change-admin-notify': subscriptionChangeAdminNotify,
  'content-edited-admin-notify': contentEditedAdminNotify,
  'commitment-penalty-refunded': commitmentPenaltyRefunded,
  'teacher-payment-paid': teacherPaymentPaid,
  'contact-message': contactMessage,
  'cashback-referral-share': cashbackReferralShare,
  'referral-access-invite': referralAccessInvite,
}
