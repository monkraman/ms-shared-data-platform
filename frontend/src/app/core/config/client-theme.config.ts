import { TenantMarketSelection, TenantIntegrationConfig } from '../models/tenant.model';
import { environment } from '../../../environments/environment';

export interface ClientThemeTokens {
  brandName: string;
  brandTagline: string;
  primaryColor: string;
  primaryHover: string;
  accentColor: string;
  surfaceBg: string;
  cardBg: string;
  fontFamily: string;
  logoLetter: string;
}

export interface ClientFormOptions {
  currencies: Array<{ code: 'EUR' | 'GBP' | 'USD'; label: string; symbol: string }>;
  sectors: Array<{ id: string; name: string; defaultCategories: string[] }>;
  availableMarkets: TenantMarketSelection[];
  availableIntegrations: TenantIntegrationConfig[];
  producerRoles: Array<{ id: 'BRAND_OWNER' | 'PACKER_FILLER' | 'IMPORTER'; title: string; desc: string }>;
}

export interface SinglePointAppConfig {
  theme: ClientThemeTokens;
  brand: {
    companyName: string;
    logoText: string;
    tagline: string;
  };
  options: ClientFormOptions;
  apiBaseUrl: string;
}

/**
 * SINGLE SOURCE OF TRUTH (DRY PRINCIPLE)
 * All design tokens, client branding, regulatory options, sectors, and integrations
 * are controlled from this single configuration file.
 */
export const APP_CONFIG: SinglePointAppConfig = {
  apiBaseUrl: environment.apiBaseUrl,
  brand: {
    companyName: 'Compliance Hub',
    logoText: 'Compliance Hub',
    tagline: 'Enterprise Packaging & Regulatory Compliance Platform',
  },
  theme: {
    brandName: 'Compliance Hub',
    brandTagline: 'Enterprise Packaging & Regulatory Compliance Platform',
    primaryColor: '#09090b',
    primaryHover: '#27272a',
    accentColor: '#52525b',
    surfaceBg: '#ffffff',
    cardBg: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
    logoLetter: 'C',
  },
  options: {
    currencies: [
      { code: 'EUR', label: 'Euros (EUR)', symbol: '€' },
      { code: 'GBP', label: 'British Pounds (GBP)', symbol: '£' },
      { code: 'USD', label: 'US Dollars (USD)', symbol: '$' },
    ],
    sectors: [
      {
        id: 'food_beverage',
        name: 'Food & Beverage / FMCG',
        defaultCategories: ['Soups & Sauces', 'Condiments', 'Dairy & Plant-Based', 'Confectionery', 'Beverages'],
      },
      {
        id: 'personal_care',
        name: 'Personal Care & Cosmetics',
        defaultCategories: ['Skincare & Lotions', 'Haircare', 'Oral Care', 'Fragrances'],
      },
      {
        id: 'household',
        name: 'Household & Cleaning',
        defaultCategories: ['Surface Cleaners', 'Laundry Detergents', 'Dish Care', 'Air Care'],
      },
      {
        id: 'consumer_goods',
        name: 'Consumer Goods & Retail',
        defaultCategories: ['Apparel & Footwear', 'Small Appliances', 'Home Goods'],
      },
    ],
    availableMarkets: [
      {
        countryCode: 'UK',
        countryName: 'United Kingdom',
        flagEmoji: '',
        regulationCode: 'UK_PEPR',
        regulationName: 'PackUK / Defra RPD EPR',
        producerRole: 'BRAND_OWNER',
        reason: 'Large Producer threshold exceeded (>£2M turnover & >50t packaging)',
        selected: true,
      },
      {
        countryCode: 'FR',
        countryName: 'France',
        flagEmoji: '',
        regulationCode: 'CITEO_EPR',
        regulationName: 'Citeo & Léko Household EPR',
        producerRole: 'BRAND_OWNER',
        reason: 'French household packaging distribution with Info-Tri labelling',
        selected: true,
      },
      {
        countryCode: 'DE',
        countryName: 'Germany',
        flagEmoji: '',
        regulationCode: 'VERPACKG',
        regulationName: 'LUCID Packaging Register',
        producerRole: 'BRAND_OWNER',
        reason: 'Dual System participation required for B2C sales',
        selected: true,
      },
      {
        countryCode: 'ES',
        countryName: 'Spain',
        flagEmoji: '',
        regulationCode: 'ES_PLASTIC',
        regulationName: 'Real Decreto 1055/2022 & Tax',
        producerRole: 'BRAND_OWNER',
        reason: 'Non-recycled plastic tax reporting (€0.45/kg)',
        selected: false,
      },
      {
        countryCode: 'IT',
        countryName: 'Italy',
        flagEmoji: '',
        regulationCode: 'CONAI',
        regulationName: 'CONAI Environmental Labeling',
        producerRole: 'BRAND_OWNER',
        reason: 'Mandatory on-pack material identification codes',
        selected: false,
      },
      {
        countryCode: 'NL',
        countryName: 'Netherlands',
        flagEmoji: '',
        regulationCode: 'AFVALFONDS',
        regulationName: 'Afvalfonds Verpakkingen',
        producerRole: 'BRAND_OWNER',
        reason: 'Waste fund eco-modulation tariff system',
        selected: false,
      },
      {
        countryCode: 'DK',
        countryName: 'Denmark',
        flagEmoji: '',
        regulationCode: 'DPA',
        regulationName: 'Dansk Producentansvar (DPA)',
        producerRole: 'BRAND_OWNER',
        reason: 'Nordic compliance register registration',
        selected: false,
      },
      {
        countryCode: 'US-CA',
        countryName: 'California (USA)',
        flagEmoji: '',
        regulationCode: 'SB54',
        regulationName: 'Plastic Pollution Prevention Act',
        producerRole: 'BRAND_OWNER',
        reason: 'Covered material producer responsibility organization mandate',
        selected: false,
      },
    ],
    availableIntegrations: [
      {
        id: 'traceone',
        name: 'Trace One Devex PLM',
        description: 'Read-only extraction of packaging BOMs, empty weights (DP09), and material specs',
        systemType: 'TRACE_ONE_DEVEX',
        status: 'mocked',
        icon: '',
        selected: true,
      },
      {
        id: 'snowflake',
        name: 'Snowflake Data Cloud',
        description: 'Placed-on-market sales volume, billing delivery nations, and GTIN catalog feeds',
        systemType: 'SNOWFLAKE',
        status: 'mocked',
        icon: '',
        selected: true,
      },
      {
        id: 'sap',
        name: 'SAP S/4HANA ERP',
        description: 'MARA/STPO material masters, units per pack, and supplier vendor tables',
        systemType: 'SAP_S4HANA',
        status: 'disconnected',
        icon: '',
        selected: false,
      },
      {
        id: 'excel',
        name: 'Manual Excel / CSV Staging',
        description: 'Fallback file upload dropzone with column mapping templates and AI suggestion',
        systemType: 'MANUAL_EXCEL',
        status: 'connected',
        icon: '',
        selected: true,
      },
    ],
    producerRoles: [
      {
        id: 'BRAND_OWNER',
        title: 'Brand Owner / Trademark Holder',
        desc: 'Owns product branding; primary legal obligation for UK and EU EPR fees.',
      },
      {
        id: 'PACKER_FILLER',
        title: 'Packer / Filler',
        desc: 'Puts products into packaging on behalf of own business or contract brand.',
      },
      {
        id: 'IMPORTER',
        title: 'Importer into Country',
        desc: 'First party to bring packaged goods into national market jurisdiction.',
      },
    ],
  },
};
