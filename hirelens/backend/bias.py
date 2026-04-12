"""Bias detection engine for hiring data analysis."""

import pandas as pd
from typing import Any


class CSVValidationError(Exception):
    """Raised when CSV data fails validation checks."""
    pass


def validate_csv(df: pd.DataFrame, target_col: str, protected_col: str) -> list[str]:
    """
    Validate a CSV DataFrame for bias analysis.

    Returns a list of warnings (non-fatal issues).
    Raises CSVValidationError for fatal issues.
    """
    warnings: list[str] = []

    if df.empty:
        raise CSVValidationError("Dataset is empty.")

    if len(df) < 10:
        warnings.append(f"Small dataset ({len(df)} rows). Results may not be statistically significant.")

    if target_col not in df.columns:
        raise CSVValidationError(f"Target column '{target_col}' not found. Available: {', '.join(df.columns)}")

    if protected_col not in df.columns:
        raise CSVValidationError(f"Protected column '{protected_col}' not found. Available: {', '.join(df.columns)}")

    if target_col == protected_col:
        raise CSVValidationError("Target column and protected column must be different.")

    # Check target column is numeric or boolean
    if not pd.api.types.is_numeric_dtype(df[target_col]) and not pd.api.types.is_bool_dtype(df[target_col]):
        raise CSVValidationError(
            f"Target column '{target_col}' must be numeric (got {df[target_col].dtype}). "
            "Expected binary values (0/1) or continuous scores."
        )

    # Check protected column has at least 2 groups
    n_groups = df[protected_col].nunique()
    if n_groups < 2:
        raise CSVValidationError(
            f"Protected column '{protected_col}' has only {n_groups} group(s). Need at least 2 for comparison."
        )

    if n_groups > 20:
        warnings.append(f"Protected column has {n_groups} groups. Consider grouping for meaningful analysis.")

    # Check for missing values
    target_missing = df[target_col].isna().sum()
    protected_missing = df[protected_col].isna().sum()

    if target_missing > 0:
        pct = (target_missing / len(df)) * 100
        warnings.append(f"Target column has {target_missing} missing values ({pct:.1f}%). These rows will be excluded.")

    if protected_missing > 0:
        pct = (protected_missing / len(df)) * 100
        warnings.append(f"Protected column has {protected_missing} missing values ({pct:.1f}%). These rows will be excluded.")

    # Check for very small groups
    group_sizes = df[protected_col].value_counts()
    for group_name, size in group_sizes.items():
        if size < 5:
            warnings.append(f"Group '{group_name}' has only {size} members. Results for this group may be unreliable.")

    return warnings


def compute_bias(
    df: pd.DataFrame,
    target_col: str,
    protected_col: str,
    threshold: float = 0.5,
) -> dict[str, Any]:
    """
    Compute selection rates and disparate impact for a binary hiring decision.

    Args:
        df: DataFrame with hiring data.
        target_col: Column name for the hiring decision (1 = hired, 0 = not hired).
        protected_col: Column name for the protected attribute (e.g., "gender").
        threshold: Score threshold above which a candidate is considered "hired".
                   Only used when target column contains continuous scores.

    Returns:
        Dictionary with per-group selection rates, disparate impact, and bias flag.
    """
    df = df.copy()

    # If target column has continuous values, binarize using threshold
    if df[target_col].nunique() > 2:
        df[target_col] = (df[target_col] >= threshold).astype(int)

    groups = df[protected_col].dropna().unique().tolist()

    selection_rates: dict[str, float] = {}
    group_counts: dict[str, dict[str, int]] = {}

    for group in groups:
        subset = df[df[protected_col] == group]
        total = len(subset)
        hired = int(subset[target_col].sum())
        rate = hired / total if total > 0 else 0.0
        selection_rates[str(group)] = round(rate, 4)
        group_counts[str(group)] = {"total": total, "hired": hired}

    # Disparate impact: ratio of lowest selection rate to highest
    rates = list(selection_rates.values())
    max_rate = max(rates) if rates else 0
    min_rate = min(rates) if rates else 0
    disparate_impact = round(min_rate / max_rate, 4) if max_rate > 0 else 0.0

    return {
        "selection_rates": selection_rates,
        "group_counts": group_counts,
        "disparate_impact": disparate_impact,
        "bias_detected": disparate_impact < 0.8,
        "threshold_used": threshold,
        "groups": groups,
        "target_column": target_col,
        "protected_column": protected_col,
    }


def get_column_info(df: pd.DataFrame) -> dict[str, Any]:
    """Return column names and sample values for the uploaded dataset."""
    columns = []
    for col in df.columns:
        columns.append({
            "name": col,
            "dtype": str(df[col].dtype),
            "unique_values": df[col].nunique(),
            "sample_values": df[col].dropna().unique()[:5].tolist(),
        })
    return {
        "columns": columns,
        "row_count": len(df),
    }
