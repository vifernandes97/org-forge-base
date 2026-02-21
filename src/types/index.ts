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
}

export interface LeadWithRelations extends Lead {
  stage?: Stage;
  funnel?: Funnel;
  assigned_profile?: Profile;
  custom_field_values?: CustomFieldValue[];
}
