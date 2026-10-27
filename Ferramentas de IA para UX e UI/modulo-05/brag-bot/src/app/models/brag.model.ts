export interface BragItem {
  id: string;
  title: string;
  context: string;
  impact: string;
  metrics: string;
  technologies: string[];
  createdAt: Date;
  rawPrompt?: string;
  actionTaken?: string;
  businessImpact?: string;
  technologiesUsed?: string[];
}

