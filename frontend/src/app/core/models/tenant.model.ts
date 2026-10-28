export interface TenantMarketSelection {
  countryCode: string;
  countryName: string;
  flagEmoji: string;
  regulationCode: string;
  regulationName: string;
  producerRole: 'BRAND_OWNER' | 'PACKER_FILLER' | 'IMPORTER';
  reason: string;
  selected: boolean;
}

export interface TenantIntegrationConfig {
  id: string;
  name: string;
  description: string;
  systemType: 'TRACE_ONE_DEVEX' | 'SNOWFLAKE' | 'SAP_S4HANA' | 'MANUAL_EXCEL';
  status: 'connected' | 'mocked' | 'disconnected';
  icon: string;
  selected: boolean;
}

export interface ClientWorkspaceProfile {
  id: string;
  name: string;
  sector: string;
  productCategories: string[];
  organisationSize: 'L' | 'S'; // Large vs Small for UK Defra thresholds
  rpdOrganisationId?: string; // DP29: UK Defra RPD ID (e.g. '100004')
  primaryCurrency: 'EUR' | 'GBP' | 'USD';
  markets: TenantMarketSelection[];
  integrations: TenantIntegrationConfig[];
  consultantEmail?: string;
  createdAt?: string;
}
