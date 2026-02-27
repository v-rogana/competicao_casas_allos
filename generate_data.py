"""
Arena das Casas - Script de Extração de KPIs
=============================================
Conecta ao banco Hamilton (Allos) e gera um arquivo JSON com os KPIs
de cada Casa para alimentar o dashboard de competição.

Uso:
    python generate_data.py

Saída:
    data.json - Arquivo JSON com KPIs por Casa e período
"""

import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, date
from dateutil.relativedelta import relativedelta

# ── Configuração ──────────────────────────────────────────────────────────────

DATABASE_URL = (
    "postgresql://hamiton_owner:npg_9d7LbBCKmPki"
    "@ep-soft-bread-a5rn2ris-pooler.us-east-2.aws.neon.tech"
    "/hamiton?sslmode=require"
)

NUCLEO_MAP = {
    "Prisma": "prisma",
    "Macondo": "macondo",
    "Marmoris": "marmoris",
}

HOUSE_INFO = {
    "prisma": {
        "name": "Prisma",
        "leader": "Diogo",
        "sensibility": "TCC e Comportamentais",
        "motto": "Decompor a complexidade em clareza",
    },
    "macondo": {
        "name": "Macondo",
        "leader": "Flávia",
        "sensibility": "Psicodinâmica",
        "motto": "A magia habita a realidade",
    },
    "marmoris": {
        "name": "Marmoris",
        "leader": "Alice Guedon",
        "sensibility": "Humanista",
        "motto": "O brilho do sol refletido no mar",
    },
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_connection():
    return psycopg2.connect(DATABASE_URL)


def count_months(date_start, date_end):
    """Conta quantos meses distintos existem no intervalo (mínimo 1)."""
    months = (date_end.year - date_start.year) * 12 + (date_end.month - date_start.month) + 1
    return max(months, 1)


# ── Funções de Extração ──────────────────────────────────────────────────────

def get_house_basics(cur):
    """Terapeutas ativos e pacientes ativos por Casa."""
    cur.execute("""
        SELECT
            n.nucleo AS casa,
            COUNT(DISTINCT t.pk_terapeuta) AS therapists_count,
            COUNT(DISTINCT p.pk_paciente) AS active_patients
        FROM terapeutas t
        JOIN nucleos n ON t.fk_nucleo = n.pk_nucleo
        LEFT JOIN pacientes p ON p.fk_terapeuta = t.pk_terapeuta
        WHERE t.is_active = true
          AND n.nucleo IN ('Prisma', 'Macondo', 'Marmoris')
        GROUP BY n.nucleo
    """)
    results = {}
    for row in cur.fetchall():
        key = NUCLEO_MAP.get(row["casa"])
        if key:
            results[key] = {
                "therapists_count": row["therapists_count"],
                "active_patients": row["active_patients"] or 0,
            }
    return results


def get_adimplencia(cur, date_start, date_end):
    """
    Adimplência = (pagamentos no período) / (pacientes ativos × meses) × 100.
    Normaliza por número de meses para que o acumulado não passe de 100%.
    """
    num_months = count_months(date_start, date_end)

    cur.execute("""
        WITH pacientes_ativos AS (
            SELECT
                n.nucleo AS casa,
                COUNT(DISTINCT p.pk_paciente) AS total_pacientes
            FROM pacientes p
            JOIN terapeutas t ON p.fk_terapeuta = t.pk_terapeuta
            JOIN nucleos n ON t.fk_nucleo = n.pk_nucleo
            WHERE t.is_active = true
              AND n.nucleo IN ('Prisma', 'Macondo', 'Marmoris')
            GROUP BY n.nucleo
        ),
        pagamentos_periodo AS (
            SELECT
                n.nucleo AS casa,
                COUNT(DISTINCT pg.pk_pagamento) AS total_pagamentos
            FROM pagamento pg
            JOIN terapeutas t ON pg.fk_terapeuta_id = t.pk_terapeuta
            JOIN nucleos n ON t.fk_nucleo = n.pk_nucleo
            WHERE pg.dat_pagamento >= %s
              AND pg.dat_pagamento <= %s
              AND n.nucleo IN ('Prisma', 'Macondo', 'Marmoris')
            GROUP BY n.nucleo
        )
        SELECT
            pa.casa,
            COALESCE(pp.total_pagamentos, 0) AS pagamentos,
            pa.total_pacientes,
            CASE
                WHEN pa.total_pacientes > 0
                THEN ROUND(
                    (COALESCE(pp.total_pagamentos, 0)::numeric / (pa.total_pacientes * %s)) * 100,
                    1
                )
                ELSE 0
            END AS taxa
        FROM pacientes_ativos pa
        LEFT JOIN pagamentos_periodo pp ON pa.casa = pp.casa
    """, (date_start, date_end, num_months))

    results = {}
    for row in cur.fetchall():
        key = NUCLEO_MAP.get(row["casa"])
        if key:
            results[key] = min(float(row["taxa"]), 100.0)
    return results


def get_sessoes_por_paciente(cur, date_start, date_end):
    """Sessões realizadas por paciente no período."""
    cur.execute("""
        SELECT
            n.nucleo AS casa,
            COUNT(c.pk_consulta) AS total_sessoes,
            COUNT(DISTINCT c.fk_paciente) AS pacientes_distintos,
            CASE
                WHEN COUNT(DISTINCT c.fk_paciente) > 0
                THEN ROUND(COUNT(c.pk_consulta)::numeric / COUNT(DISTINCT c.fk_paciente), 1)
                ELSE 0
            END AS media
        FROM consultas c
        JOIN terapeutas t ON c.fk_terapeuta = t.pk_terapeuta
        JOIN nucleos n ON t.fk_nucleo = n.pk_nucleo
        WHERE c.is_realizado = true
          AND c.dat_consulta >= %s
          AND c.dat_consulta <= %s
          AND n.nucleo IN ('Prisma', 'Macondo', 'Marmoris')
        GROUP BY n.nucleo
    """, (date_start, date_end))

    results = {}
    for row in cur.fetchall():
        key = NUCLEO_MAP.get(row["casa"])
        if key:
            results[key] = float(row["media"])
    return results


def get_qualidade(cur, date_start, date_end):
    """
    Qualidade = média de qualidade_geral das avaliações no período (0-10).
    Usa created_at para filtrar por data (campo seguro que existe na tabela).
    """
    cur.execute("""
        SELECT
            n.nucleo AS casa,
            ROUND(AVG(a.qualidade_geral)::numeric, 1) AS media_qualidade,
            COUNT(a.pk_avaliacao) AS total_avaliacoes
        FROM "avaliação" a
        JOIN terapeutas t ON a.fk_terapeuta = t.pk_terapeuta
        JOIN nucleos n ON t.fk_nucleo = n.pk_nucleo
        WHERE a.qualidade_geral IS NOT NULL
          AND a.created_at >= %s
          AND a.created_at < (%s::date + interval '1 day')
          AND n.nucleo IN ('Prisma', 'Macondo', 'Marmoris')
        GROUP BY n.nucleo
    """, (date_start, date_end))

    results = {}
    for row in cur.fetchall():
        key = NUCLEO_MAP.get(row["casa"])
        if key:
            results[key] = float(row["media_qualidade"]) if row["media_qualidade"] else 0.0
    return results


def get_comparecimento(cur, date_start, date_end):
    """Taxa de comparecimento = realizadas / total agendado (até hoje)."""
    today = date.today()
    effective_end = min(date_end, today)

    cur.execute("""
        SELECT
            n.nucleo AS casa,
            COUNT(CASE WHEN c.is_realizado = true THEN 1 END) AS realizadas,
            COUNT(c.pk_consulta) AS total,
            CASE
                WHEN COUNT(c.pk_consulta) > 0
                THEN ROUND(
                    (COUNT(CASE WHEN c.is_realizado = true THEN 1 END)::numeric / COUNT(c.pk_consulta)) * 100,
                    1
                )
                ELSE 0
            END AS taxa
        FROM consultas c
        JOIN terapeutas t ON c.fk_terapeuta = t.pk_terapeuta
        JOIN nucleos n ON t.fk_nucleo = n.pk_nucleo
        WHERE c.dat_consulta >= %s
          AND c.dat_consulta <= %s
          AND n.nucleo IN ('Prisma', 'Macondo', 'Marmoris')
        GROUP BY n.nucleo
    """, (date_start, effective_end))

    results = {}
    for row in cur.fetchall():
        key = NUCLEO_MAP.get(row["casa"])
        if key:
            results[key] = float(row["taxa"])
    return results


def get_evolucao_ors(cur):
    """
    Evolução clínica = média de (ORS_saída - ORS_entrada) por Casa.
    Inner join por fk_paciente garante só ciclos completos.
    """
    cur.execute("""
        WITH entrada AS (
            SELECT
                a.fk_paciente,
                a.fk_terapeuta,
                (COALESCE(a.individual, 0) + COALESCE(a.interpessoal, 0) +
                 COALESCE(a.social, 0) + COALESCE(a.geral, 0)) AS ors_entrada
            FROM "avaliação" a
            WHERE LOWER(TRIM(a.momento)) LIKE '%%entrada%%'
              AND a.individual IS NOT NULL
        ),
        saida AS (
            SELECT
                a.fk_paciente,
                a.fk_terapeuta,
                (COALESCE(a.individual, 0) + COALESCE(a.interpessoal, 0) +
                 COALESCE(a.social, 0) + COALESCE(a.geral, 0)) AS ors_saida
            FROM "avaliação" a
            WHERE (LOWER(TRIM(a.momento)) LIKE '%%saída%%'
                   OR LOWER(TRIM(a.momento)) LIKE '%%saida%%')
              AND a.individual IS NOT NULL
        )
        SELECT
            n.nucleo AS casa,
            ROUND(AVG(s.ors_saida - e.ors_entrada)::numeric, 1) AS media_delta,
            COUNT(*) AS ciclos_completos
        FROM entrada e
        INNER JOIN saida s ON e.fk_paciente = s.fk_paciente
        JOIN terapeutas t ON e.fk_terapeuta = t.pk_terapeuta
        JOIN nucleos n ON t.fk_nucleo = n.pk_nucleo
        WHERE n.nucleo IN ('Prisma', 'Macondo', 'Marmoris')
        GROUP BY n.nucleo
    """)

    results = {}
    for row in cur.fetchall():
        key = NUCLEO_MAP.get(row["casa"])
        if key:
            results[key] = float(row["media_delta"]) if row["media_delta"] else 0.0
    return results


# ── Geração do JSON ──────────────────────────────────────────────────────────

def generate_data():
    print("=" * 60)
    print("ARENA DAS CASAS - Geração de Dados")
    print("=" * 60)

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    today = date.today()

    current_month_start = today.replace(day=1)
    current_month_end = today

    accumulated_start = (today - relativedelta(months=2)).replace(day=1)
    accumulated_end = today

    print(f"\nPeríodo atual: {current_month_start} → {current_month_end}")
    print(f"Acumulado:     {accumulated_start} → {accumulated_end}")
    print(f"Meses no acumulado: {count_months(accumulated_start, accumulated_end)}")

    print("\n[1/6] Dados básicos das Casas...")
    basics = get_house_basics(cur)
    print(f"  ✓ {len(basics)} casas encontradas")
    for key, val in basics.items():
        print(f"    {key}: {val['therapists_count']} terapeutas, {val['active_patients']} pacientes")

    print("\n[2/6] Adimplência...")
    adimplencia_current = get_adimplencia(cur, current_month_start, current_month_end)
    adimplencia_accum = get_adimplencia(cur, accumulated_start, accumulated_end)
    print(f"  ✓ Mês: {adimplencia_current}")
    print(f"  ✓ Acumulado: {adimplencia_accum}")

    print("\n[3/6] Sessões por paciente...")
    sessoes_current = get_sessoes_por_paciente(cur, current_month_start, current_month_end)
    sessoes_accum = get_sessoes_por_paciente(cur, accumulated_start, accumulated_end)
    print(f"  ✓ Mês: {sessoes_current}")
    print(f"  ✓ Acumulado: {sessoes_accum}")

    print("\n[4/6] Qualidade da terapia...")
    qualidade_current = get_qualidade(cur, current_month_start, current_month_end)
    qualidade_accum = get_qualidade(cur, accumulated_start, accumulated_end)
    print(f"  ✓ Mês: {qualidade_current}")
    print(f"  ✓ Acumulado: {qualidade_accum}")

    print("\n[5/6] Taxa de comparecimento...")
    comparecimento_current = get_comparecimento(cur, current_month_start, current_month_end)
    comparecimento_accum = get_comparecimento(cur, accumulated_start, accumulated_end)
    print(f"  ✓ Mês: {comparecimento_current}")
    print(f"  ✓ Acumulado: {comparecimento_accum}")

    print("\n[6/6] Evolução clínica (ORS)...")
    ors = get_evolucao_ors(cur)
    print(f"  ✓ ORS: {ors}")

    cur.close()
    conn.close()

    # ── Montar JSON ──
    meses_pt = {
        1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
        5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
        9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro",
    }

    current_label = f"{meses_pt[today.month]} {today.year}"
    accum_start_label = f"{meses_pt[accumulated_start.month][:3]} {accumulated_start.year}"
    accum_end_label = f"{meses_pt[today.month][:3]} {today.year}"
    accumulated_label = f"{accum_start_label} — {accum_end_label}"

    houses = {}
    for key in ["prisma", "macondo", "marmoris"]:
        houses[key] = {
            **HOUSE_INFO[key],
            "therapists_count": basics.get(key, {}).get("therapists_count", 0),
            "active_patients": basics.get(key, {}).get("active_patients", 0),
        }

    def safe_kpi(data_dict):
        return {
            "prisma": data_dict.get("prisma", 0),
            "macondo": data_dict.get("macondo", 0),
            "marmoris": data_dict.get("marmoris", 0),
        }

    output = {
        "updated_at": datetime.now().isoformat(),
        "houses": houses,
        "periods": {
            "current": {
                "label": current_label,
                "kpis": {
                    "adimplencia": safe_kpi(adimplencia_current),
                    "sessoes_paciente": safe_kpi(sessoes_current),
                    "qualidade": safe_kpi(qualidade_current),
                    "comparecimento": safe_kpi(comparecimento_current),
                    "evolucao_ors": safe_kpi(ors),
                },
            },
            "accumulated": {
                "label": accumulated_label,
                "kpis": {
                    "adimplencia": safe_kpi(adimplencia_accum),
                    "sessoes_paciente": safe_kpi(sessoes_accum),
                    "qualidade": safe_kpi(qualidade_accum),
                    "comparecimento": safe_kpi(comparecimento_accum),
                    "evolucao_ors": safe_kpi(ors),
                },
            },
        },
    }

    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print("✅ data.json gerado com sucesso!")
    print("=" * 60)
    print(f"\nResumo:")
    print(f"  Prisma:   {houses['prisma']['therapists_count']}T / {houses['prisma']['active_patients']}P")
    print(f"  Macondo:  {houses['macondo']['therapists_count']}T / {houses['macondo']['active_patients']}P")
    print(f"  Marmoris: {houses['marmoris']['therapists_count']}T / {houses['marmoris']['active_patients']}P")

    return output


if __name__ == "__main__":
    generate_data()