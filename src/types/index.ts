export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  invited_email: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface Funnel {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Stage {
  id: string;
  funnel_id: string;
  organization_id: string;
  name: string;
  color: string;
  position: number;
  sla_hours: number | null;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

export type CustomFieldType = 'text' | 'number' | 'currency' | 'date' | 'select' | 'multi_select' | 'checkbox' | 'url' | 'email' | 'phone';

export interface CustomFieldDefinition {
  id: string;
  organization_id: string;
  field_name: string;
  field_label: string;
  field_type: CustomFieldType;
  options: string[] | null;
  is_required: boolean;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldValue {
  id: string;
  lead_id: string;
  field_definition_id: string;
  value: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent';
export type LeadStatus = 'open' | 'won' | 'inactive';

export interface Lead {
  id: string;
  organization_id: string;
  funnel_id: string;
  stage_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  assigned_to: string | null;
  value: number;
  tags: string[];
  source: string | null;
  priority: LeadPriority;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  stage_entered_at: string;
  archived_at: string | null;
  archive_reason_id: string | null;
}

export interface LeadWithRelations extends Lead {
  stage?: Stage;
  funnel?: Funnel;
  assigned_profile?: Profile;
  custom_field_values?: CustomFieldValue[];
}

export type ActivityType = 'note' | 'call' | 'email' | 'meeting' | 'stage_change' | 'field_update' | 'task_created' | 'task_completed';

export interface LeadActivity {
  id: string;
  organization_id: string;
  lead_id: string;
  user_id: string;
  activity_type: ActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface LeadActivityWithUser extends LeadActivity {
  user?: Profile;
}

export type TaskType = 'follow_up' | 'call' | 'email' | 'meeting' | 'other';

export interface Task {
  id: string;
  organization_id: string;
  lead_id: string;
  assigned_to: string;
  title: string;
  description: string | null;
  task_type: TaskType;
  due_date: string;
  completed_at: string | null;
  priority: LeadPriority;
  created_at: string;
  updated_at: string;
}

export interface TaskWithRelations extends Task {
  lead?: Lead;
  assigned_profile?: Profile;
}

export interface WebhookLog {
  id: string;
  organization_id: string;
  stage_id: string;
  lead_id: string | null;
  webhook_url: string;
  payload: Record<string, any>;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  attempt_number: number;
  error_message: string | null;
  created_at: string;
}

export interface SavedFilter {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  filters: LeadFilters;
  is_shared: boolean;
  created_at: string;
}

export type StageTimeFilter = 'less_24h' | '1_3_days' | '3_7_days' | 'more_7_days' | 'above_sla';

export interface LeadFilters {
  search?: string;
  stage_ids?: string[];
  assigned_to?: string[];
  priorities?: LeadPriority[];
  tags?: string[];
  sources?: string[];
  value_min?: number;
  value_max?: number;
  created_at_from?: string;
  created_at_to?: string;
  last_activity_from?: string;
  last_activity_to?: string;
  stage_time?: StageTimeFilter;
  custom_fields?: Record<string, any>;
  show_archived?: boolean;
}
