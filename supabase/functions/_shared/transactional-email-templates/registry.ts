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

export const TEMPLATES: Record<string, TemplateEntry> = {
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
}
