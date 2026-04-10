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
import { template as welcomeStudent } from './welcome-student.tsx'
import { template as welcomeTeacher } from './welcome-teacher.tsx'
import { template as newTeacherAdminNotify } from './new-teacher-admin-notify.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'doubt-approved': doubtApproved,
  'doubt-answered': doubtAnswered,
  'welcome-student': welcomeStudent,
  'welcome-teacher': welcomeTeacher,
  'new-teacher-admin-notify': newTeacherAdminNotify,
}
