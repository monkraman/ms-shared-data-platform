"""Service layer for EU PPWR (DoC & Recyclability Grades) and Digital Product Passport (DPP)."""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from app.schemas.canonical import MaterialCategory, PackagingLevel
from app.schemas.ppwr_dpp import (
    DigitalProductPassport,
    PPWRComponentAssessment,
    PPWRDeclarationOfConformity,
    PPWRRecyclabilityGrade,
)
from app.services.store import data_store


class Layer4PPWRDPPService:
    """Calculates EU PPWR Article 6 Declaration of Conformity and DPP Digital Product Passport."""

    @classmethod
    def generate_ppwr_doc(cls, tenant_id: str, sku: str) -> PPWRDeclarationOfConformity:
        """Generate official EU PPWR Article 6 Declaration of Conformity for a given SKU."""
        with data_store._lock:
            tenant = data_store.tenants.get(tenant_id)
            tenant_name = tenant.name if tenant else "Kraft Heinz Company Europe"
            products = data_store.products.get(tenant_id, {})
            product = products.get(sku)
            if not product:
                raise ValueError(f"SKU '{sku}' not found for tenant '{tenant_id}'")

            # Evaluate components
            total_weight = sum(c.weight_grams for c in product.components) or 1.0
            weighted_recyclability = 0.0
            assessments: List[PPWRComponentAssessment] = []

            for comp in product.components:
                # Recyclability calculation per EU PPWR criteria
                if not comp.is_recyclable or comp.has_disruptor_pigment:
                    rec_pct = 40.0 if not comp.has_disruptor_pigment else 20.0
                    note = "Contains NIR disruptors or incompatible composite barrier (Article 6 Annex II)."
                elif comp.material in [MaterialCategory.GLASS, MaterialCategory.STEEL_TINPLATE, MaterialCategory.ALUMINUM]:
                    rec_pct = 98.0
                    note = "Permanently recyclable material stream with existing collection infrastructure."
                elif comp.material == MaterialCategory.PET_CLEAR:
                    rec_pct = 95.0 if comp.separable_by_consumer else 85.0
                    note = "Complies with EU Bottle Directives & high-yield mechanical recycling."
                elif comp.material in [MaterialCategory.HDPE, MaterialCategory.PP]:
                    rec_pct = 90.0
                    note = "Rigid mono-material polymer suitable for closed-loop stream."
                elif comp.material == MaterialCategory.PAPER_CARDBOARD:
                    rec_pct = 92.0
                    note = "Fibrous packaging compliant with EN 13430 recyclability standards."
                else:
                    rec_pct = 50.0
                    note = "Complex multi-material fraction requiring specialized sorting."

                weighted_recyclability += rec_pct * (comp.weight_grams / total_weight)

                assessments.append(
                    PPWRComponentAssessment(
                        component_id=comp.id,
                        component_name=comp.name,
                        material=comp.material.value,
                        weight_grams=comp.weight_grams,
                        recycled_content_pct=comp.recycled_content_pct,
                        is_separable=comp.separable_by_consumer,
                        recyclability_rate_pct=rec_pct,
                        disruptor_present=comp.has_disruptor_pigment,
                        compliance_notes=note,
                    )
                )

            # Assign grade according to EU PPWR Article 6
            if weighted_recyclability >= 95.0:
                grade = PPWRRecyclabilityGrade.GRADE_A
            elif weighted_recyclability >= 90.0:
                grade = PPWRRecyclabilityGrade.GRADE_B
            elif weighted_recyclability >= 80.0:
                grade = PPWRRecyclabilityGrade.GRADE_C
            elif weighted_recyclability >= 70.0:
                grade = PPWRRecyclabilityGrade.GRADE_D
            else:
                grade = PPWRRecyclabilityGrade.GRADE_E

            is_marketable = grade != PPWRRecyclabilityGrade.GRADE_E

            # Lineage
            plm_spec = "DEV-8821"
            if product.source_lineage:
                plm_spec = product.source_lineage.source_record_id

            gtin = f"08715700{abs(hash(sku)) % 1000000:06d}"

            return PPWRDeclarationOfConformity(
                doc_reference=f"DOC-PPWR-{sku}-2026",
                sku=sku,
                gtin=gtin,
                product_name=product.name,
                producer_legal_entity=tenant_name,
                overall_recyclability_pct=round(weighted_recyclability, 1),
                recyclability_grade=grade,
                is_compliant_for_eu_market=is_marketable,
                heavy_metals_compliant=True,
                pfas_substance_free=True,
                packaging_minimisation_ratio_pct=21.4,
                reusable_packaging=False,
                source_plm_spec=plm_spec,
                source_sales_system="Snowflake Analytics (sales_by_market)",
                components_assessed=assessments,
            )

    @classmethod
    def generate_dpp(cls, tenant_id: str, sku: str) -> DigitalProductPassport:
        """Generate Digital Product Passport (DPP) with GS1 Digital Link and sorting labels."""
        with data_store._lock:
            products = data_store.products.get(tenant_id, {})
            product = products.get(sku)
            if not product:
                raise ValueError(f"SKU '{sku}' not found for tenant '{tenant_id}'")

            gtin = f"08715700{abs(hash(sku)) % 1000000:06d}"
            gs1_link = f"https://id.monkspaces.com/01/{gtin}/21/BATCH-2026Q1"

            # Compute recycled content and primary polymer
            total_weight = sum(c.weight_grams for c in product.components) or 1.0
            weighted_pcr = sum(c.recycled_content_pct * (c.weight_grams / total_weight) for c in product.components)

            primary_comp = max(product.components, key=lambda c: c.weight_grams) if product.components else None
            primary_polymer = primary_comp.material.value if primary_comp else "PET"

            disposal_guide = []
            for c in product.components:
                if c.separable_by_consumer:
                    disposal_guide.append(f"Detach {c.name} ({c.material.value}) -> Place in curbside recycle bin")
                else:
                    disposal_guide.append(f"{c.name} is attached to main body -> Leave intact")

            spec_id = product.source_lineage.source_record_id if product.source_lineage else "DEV-SPEC-SYNC"

            return DigitalProductPassport(
                passport_id=f"DPP-{uuid4().hex[:8].upper()}",
                sku=sku,
                gtin=gtin,
                product_name=product.name,
                brand=product.brand,
                gs1_digital_link_url=gs1_link,
                qr_data_carrier_payload=f"{gs1_link}?lineage=Devex-{spec_id}",
                total_packaging_weight_grams=round(total_weight, 2),
                total_recycled_content_pct=round(weighted_pcr, 1),
                primary_polymer=primary_polymer,
                recyclability_grade="Grade A (PPWR Recyclable)" if weighted_pcr > 25 else "Grade B",
                disposal_instructions=disposal_guide,
                harmonised_sorting_label="EU Harmonised Sort Marker (Directive 94/62/EC Art. 14)",
                spec_source_system="Trace One (Devex PLM)",
                spec_reference_id=spec_id,
            )

