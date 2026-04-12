"""Tests for the bias detection engine."""

import pandas as pd
import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from bias import compute_bias, get_column_info, validate_csv, CSVValidationError


class TestComputeBias:
    def test_basic_bias_detection(self, sample_df):
        result = compute_bias(sample_df, "hired", "gender")

        assert "selection_rates" in result
        assert "disparate_impact" in result
        assert "bias_detected" in result
        assert result["selection_rates"]["male"] == 0.8  # 8/10
        assert result["selection_rates"]["female"] == 0.3  # 3/10
        assert result["disparate_impact"] == pytest.approx(0.375, abs=0.001)
        assert result["bias_detected"] is True

    def test_no_bias(self):
        df = pd.DataFrame({
            "gender": ["male"] * 10 + ["female"] * 10,
            "hired": [1, 1, 1, 1, 1, 0, 0, 0, 0, 0] + [1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
        })
        result = compute_bias(df, "hired", "gender")
        assert result["disparate_impact"] == 1.0
        assert result["bias_detected"] is False

    def test_threshold_binarization(self, sample_df):
        result = compute_bias(sample_df, "score", "gender", threshold=60)
        assert "selection_rates" in result
        # Verify scores were binarized
        for rate in result["selection_rates"].values():
            assert 0 <= rate <= 1

    def test_multiple_groups(self):
        df = pd.DataFrame({
            "race": ["A"] * 10 + ["B"] * 10 + ["C"] * 10,
            "hired": [1] * 8 + [0] * 2 + [1] * 5 + [0] * 5 + [1] * 3 + [0] * 7,
        })
        result = compute_bias(df, "hired", "race")
        assert len(result["groups"]) == 3
        assert result["selection_rates"]["A"] == 0.8
        assert result["selection_rates"]["B"] == 0.5
        assert result["selection_rates"]["C"] == 0.3
        # DI = min/max = 0.3/0.8
        assert result["disparate_impact"] == pytest.approx(0.375, abs=0.001)

    def test_empty_group_handling(self):
        df = pd.DataFrame({
            "gender": ["male", "male", "male"],
            "hired": [1, 1, 0],
        })
        # Only one group — still computes, DI = 1.0 (same group)
        result = compute_bias(df, "hired", "gender")
        assert result["disparate_impact"] == 1.0


class TestGetColumnInfo:
    def test_returns_all_columns(self, sample_df):
        info = get_column_info(sample_df)
        assert info["row_count"] == 20
        col_names = [c["name"] for c in info["columns"]]
        assert "gender" in col_names
        assert "hired" in col_names
        assert "score" in col_names

    def test_sample_values(self, sample_df):
        info = get_column_info(sample_df)
        gender_col = next(c for c in info["columns"] if c["name"] == "gender")
        assert gender_col["unique_values"] == 2


class TestValidateCSV:
    def test_valid_data(self, sample_df):
        warnings = validate_csv(sample_df, "hired", "gender")
        assert isinstance(warnings, list)

    def test_missing_target_column(self, sample_df):
        with pytest.raises(CSVValidationError, match="Target column"):
            validate_csv(sample_df, "nonexistent", "gender")

    def test_missing_protected_column(self, sample_df):
        with pytest.raises(CSVValidationError, match="Protected column"):
            validate_csv(sample_df, "hired", "nonexistent")

    def test_same_columns(self, sample_df):
        with pytest.raises(CSVValidationError, match="must be different"):
            validate_csv(sample_df, "hired", "hired")

    def test_non_numeric_target(self):
        df = pd.DataFrame({
            "target": ["yes", "no", "yes", "no"],
            "group": ["A", "A", "B", "B"],
        })
        with pytest.raises(CSVValidationError, match="must be numeric"):
            validate_csv(df, "target", "group")

    def test_single_group(self):
        df = pd.DataFrame({
            "hired": [1, 0, 1],
            "gender": ["male", "male", "male"],
        })
        with pytest.raises(CSVValidationError, match="only 1 group"):
            validate_csv(df, "hired", "gender")

    def test_small_dataset_warning(self):
        df = pd.DataFrame({
            "hired": [1, 0, 1, 0, 1],
            "gender": ["male", "male", "female", "female", "female"],
        })
        warnings = validate_csv(df, "hired", "gender")
        assert any("Small dataset" in w for w in warnings)

    def test_empty_dataset(self):
        df = pd.DataFrame(columns=["hired", "gender"])
        with pytest.raises(CSVValidationError, match="empty"):
            validate_csv(df, "hired", "gender")
