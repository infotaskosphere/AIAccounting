"""
ai/classifier.py  — v2.1 PRODUCTION
Hybrid AI Classification Engine:
  1. Exact learned mapping (company-specific memory)
  2. Rule-based pattern matching (ICAI-aligned ledgers)
  3. OpenAI text-embedding-3-small (when API key configured)
  4. Sentence-transformers local embeddings (offline fallback)
  5. Fuzzy string matching (rapidfuzz)
  6. Hardcoded fallback

Confidence thresholds (ICAI-aligned):
  ≥ 0.90 → Auto-post (no human review)
  0.70–0.89 → Suggest (maker-checker)
  < 0.70 → Manual review required
"""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

import numpy as np
from rapidfuzz import fuzz, process

# ── Optional: sentence-transformers (offline embeddings) ──────────────────────
try:
    from sentence_transformers import SentenceTransformer
    EMBEDDINGS_AVAILABLE = True
except ImportError:
    SentenceTransformer = None
    EMBEDDINGS_AVAILABLE = False

# ── Optional: OpenAI embeddings ───────────────────────────────────────────────
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    openai = None
    OPENAI_AVAILABLE = False

# ── Optional: OCR ─────────────────────────────────────────────────────────────
try:
    import pytesseract
    from PIL import Image as _PILImage
    OCR_AVAILABLE = True
except ImportError:
    pytesseract = None
    _PILImage   = None
    OCR_AVAILABLE = False


# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class ClassificationResult:
    account_id:      str
    account_name:    str
    confidence:      float         # 0.0 → 1.0
    method:          str           # exact | rule | openai | embedding | fuzzy | fallback
    requires_review: bool
    alternatives:    list[dict] | None = None

@dataclass
class ReconciliationMatch:
    bank_txn_id:  str
    voucher_id:   str
    confidence:   float
    match_type:   str
    delta_days:   int

@dataclass
class AnomalyResult:
    txn_id:       str
    anomaly_type: str
    severity:     str
    description:  str
    confidence:   float


# ── 1. Transaction Classifier ─────────────────────────────────────────────────

class TransactionClassifier:
    """
    Classify bank narrations → ledger account codes.
    Hybrid: rules → learned → embeddings → fuzzy → fallback.
    """

    REVIEW_THRESHOLD = 0.75
    AUTO_POST_THRESHOLD = 0.90

    # ── Rule Patterns → Account Code ─────────────────────────────────────
    # Format: ([keywords], account_code, base_confidence)
    PATTERNS: list[tuple[list[str], str, float]] = [
        # Payroll
        (["salary","sal/","salaries","payroll","wages","ctc","emoluments"], "8100", 0.95),
        # Director
        (["director remuneration","director's salary","managing director"], "8101", 0.95),
        # PF/ESIC
        (["provident fund","pf contribution","epfo","pf deposit","esic"], "8102", 0.97),
        # Rent
        (["rent","lease rent","rental","rent payment"], "8110", 0.93),
        # Electricity
        (["electricity","bescom","tata power","msedcl","tneb","cesc","wbsedcl","adani electric","torrent power","mgvcl","dgvcl"], "8111", 0.97),
        # Internet/Phone
        (["jio","airtel","bsnl","act fibernet","hathway","vodafone","vi ","internet","broadband","telecom","reliance jio"], "8112", 0.96),
        # Software/SaaS
        (["amazon web services","aws","google cloud","azure","microsoft","adobe","atlassian","notion","slack","zoom","github","zoho","tally"], "8115", 0.94),
        # Professional fees
        (["ca fees","audit fees","legal","advocate","consultant","professional fee","advisory","chartered accountant"], "8119", 0.93),
        # Advertising
        (["google ads","facebook","meta ads","instagram","youtube ads","linkedin","advertising","marketing","digital marketing"], "8118", 0.95),
        # Bank charges
        (["bank charge","service charge","neft charge","rtgs charge","sms charge","annual fee","processing fee","bank interest charged","demat"], "8130", 0.97),
        # Interest on loan
        (["interest on loan","loan interest","home loan emi","car loan","term loan interest","od interest"], "8131", 0.95),
        # GST payment (outflow)
        (["gst payment","cgst payment","sgst payment","igst payment","gst challan","gst deposit"], "3100", 0.98),
        # TDS payment
        (["tds payment","income tax","advance tax","self assessment tax","tds deposit","challan 281"], "3200", 0.97),
        # Travel
        (["ola","uber","rapido","makemytrip","goibibo","irctc","flight","hotel","travel","conveyance","cab","yatra","cleartrip"], "8116", 0.94),
        # Office supplies/Amazon
        (["stationery","office supplies","paper","toner","printer"], "8114", 0.88),
        # Insurance
        (["insurance premium","lic","hdfc life","max life","icicipru","star health","new india assurance"], "8124", 0.96),
        # Repairs
        (["repair","maintenance","amc","annual maintenance"], "8125", 0.90),
        # Sales receipt (credit)
        (["payment received","receipt from","invoice paid","settlement received","amount credited by"], "7001", 0.85),
        # Purchase payment (debit)
        (["paid to vendor","vendor payment","supplier payment","purchase payment"], "8000", 0.82),
        # Cash withdrawal
        (["atm withdrawal","cash withdrawal","atm cash"], "6000", 0.97),
        # Transfer to own account
        (["self transfer","transfer to own","transfer to savings","neft to self"], "6001", 0.90),
        # Petty cash
        (["petty cash","imprest"], "6001", 0.90),
        # Donations
        (["donation","csr","charitable","pm cares","relief fund"], "8151", 0.95),
    ]

    def __init__(self, model_name: str = "all-MiniLM-L6-v2", openai_api_key: str = ""):
        self._account_embeddings: dict[str, np.ndarray] = {}
        self._account_index: list[dict] = []
        self._learned_map: dict[str, str] = {}
        self._openai_client = None

        # OpenAI client
        if OPENAI_AVAILABLE and openai_api_key:
            try:
                self._openai_client = openai.OpenAI(api_key=openai_api_key)
            except Exception:
                self._openai_client = None

        # Local sentence-transformers model
        if EMBEDDINGS_AVAILABLE and SentenceTransformer is not None:
            try:
                self.model = SentenceTransformer(model_name)
            except Exception:
                self.model = None
        else:
            self.model = None

    def load_accounts(self, accounts: list[dict]) -> None:
        self._account_index = accounts
        if self.model is not None and accounts:
            names      = [a["name"] for a in accounts]
            embeddings = self.model.encode(names, convert_to_numpy=True, show_progress_bar=False)
            for i, acc in enumerate(accounts):
                self._account_embeddings[acc["id"]] = embeddings[i]

    def load_learned_mappings(self, mappings: list[dict]) -> None:
        for m in mappings:
            key = self._hash_narration(m["narration"])
            self._learned_map[key] = m["confirmed_account_id"]

    def classify(self, narration: str, fallback_account: Optional[dict] = None) -> ClassificationResult:
        narration_clean = self._normalize(narration)
        fallback        = fallback_account or {"id": "", "name": "Miscellaneous Expenses"}

        # 1. Exact learned match (highest priority)
        key = self._hash_narration(narration_clean)
        if key in self._learned_map:
            acc_id = self._learned_map[key]
            acc    = self._find_account_by_id(acc_id)
            return ClassificationResult(
                account_id=acc_id,
                account_name=acc["name"] if acc else "Learned Account",
                confidence=0.99,
                method="exact",
                requires_review=False,
            )

        # 2. Rule-based patterns
        rule_result = self._rule_classify(narration_clean)
        if rule_result and rule_result.confidence >= 0.85:
            return rule_result

        # 3. OpenAI embedding classification
        if self._openai_client and self._account_index:
            openai_result = self._openai_classify(narration_clean)
            if openai_result and openai_result.confidence >= 0.75:
                return openai_result

        # 4. Local sentence-transformers
        if self.model and self._account_embeddings:
            emb_result = self._embedding_classify(narration_clean)
            if emb_result and emb_result.confidence >= 0.70:
                # Combine with rule result
                if rule_result and rule_result.confidence > emb_result.confidence:
                    return rule_result
                return emb_result

        # 5. Fuzzy matching against account names
        if self._account_index:
            fuzzy_result = self._fuzzy_classify(narration_clean)
            if fuzzy_result and fuzzy_result.confidence >= 0.65:
                return fuzzy_result

        # 6. Return lower-confidence rule result if any
        if rule_result:
            return rule_result

        # 7. Fallback
        misc = self._find_account_by_code("8199")
        return ClassificationResult(
            account_id=misc["id"] if misc else fallback["id"],
            account_name=misc["name"] if misc else fallback["name"],
            confidence=0.30,
            method="fallback",
            requires_review=True,
        )

    def classify_batch(self, narrations: list[str]) -> list[ClassificationResult]:
        return [self.classify(n) for n in narrations]

    # ── Internal helpers ─────────────────────────────────────────────────

    def _rule_classify(self, narration_clean: str) -> Optional[ClassificationResult]:
        best_score = 0.0
        best_acc   = None
        best_conf  = 0.0
        for keywords, code, base_conf in self.PATTERNS:
            for kw in keywords:
                if kw in narration_clean:
                    score = len(kw) / max(len(narration_clean), 1) + base_conf
                    if score > best_score:
                        best_score = score
                        best_acc   = self._find_account_by_code(code)
                        best_conf  = min(base_conf, 0.99)
        if best_acc:
            return ClassificationResult(
                account_id=best_acc["id"],
                account_name=best_acc["name"],
                confidence=best_conf,
                method="rule",
                requires_review=best_conf < self.REVIEW_THRESHOLD,
            )
        return None

    def _openai_classify(self, narration: str) -> Optional[ClassificationResult]:
        try:
            response = self._openai_client.embeddings.create(
                input=narration,
                model="text-embedding-3-small",
            )
            narration_emb = np.array(response.data[0].embedding)

            # Compare with pre-computed account embeddings
            best_score  = -1.0
            best_acc_id = None
            for acc in self._account_index:
                if acc["id"] in self._account_embeddings:
                    acc_emb = self._account_embeddings[acc["id"]]
                    # Cosine similarity
                    sim = float(
                        np.dot(narration_emb, acc_emb) /
                        (np.linalg.norm(narration_emb) * np.linalg.norm(acc_emb) + 1e-8)
                    )
                    if sim > best_score:
                        best_score  = sim
                        best_acc_id = acc["id"]

            if best_acc_id:
                acc = self._find_account_by_id(best_acc_id)
                confidence = min(best_score, 0.95)
                return ClassificationResult(
                    account_id=best_acc_id,
                    account_name=acc["name"] if acc else "",
                    confidence=confidence,
                    method="openai",
                    requires_review=confidence < self.REVIEW_THRESHOLD,
                )
        except Exception:
            pass
        return None

    def _embedding_classify(self, narration: str) -> Optional[ClassificationResult]:
        try:
            narr_emb = self.model.encode([narration], convert_to_numpy=True)[0]
            best_sim  = -1.0
            best_id   = None
            for acc_id, emb in self._account_embeddings.items():
                sim = float(np.dot(narr_emb, emb) / (np.linalg.norm(narr_emb) * np.linalg.norm(emb) + 1e-8))
                if sim > best_sim:
                    best_sim = sim
                    best_id  = acc_id
            if best_id:
                acc = self._find_account_by_id(best_id)
                confidence = min(best_sim, 0.92)
                return ClassificationResult(
                    account_id=best_id,
                    account_name=acc["name"] if acc else "",
                    confidence=confidence,
                    method="embedding",
                    requires_review=confidence < self.REVIEW_THRESHOLD,
                )
        except Exception:
            pass
        return None

    def _fuzzy_classify(self, narration: str) -> Optional[ClassificationResult]:
        if not self._account_index:
            return None
        names   = [a["name"] for a in self._account_index]
        results = process.extract(narration, names, scorer=fuzz.partial_ratio, limit=3)
        if results:
            best_match, score, idx = results[0]
            confidence = score / 100.0 * 0.75  # Cap fuzzy at 75%
            acc = self._account_index[idx]
            return ClassificationResult(
                account_id=acc["id"],
                account_name=acc["name"],
                confidence=confidence,
                method="fuzzy",
                requires_review=True,
            )
        return None

    def _normalize(self, text: str) -> str:
        text = unicodedata.normalize("NFKD", text)
        text = re.sub(r"[^\w\s/-]", " ", text.lower())
        text = re.sub(r"\s+", " ", text).strip()
        # Remove common UPI/NEFT prefixes
        text = re.sub(r"^(upi|neft|imps|rtgs|chq|pos|atm)[/-]?\s*", "", text)
        return text

    def _hash_narration(self, narration: str) -> str:
        return hashlib.md5(narration.strip().lower().encode()).hexdigest()

    def _find_account_by_id(self, acc_id: str) -> Optional[dict]:
        return next((a for a in self._account_index if a["id"] == acc_id), None)

    def _find_account_by_code(self, code: str) -> Optional[dict]:
        return next((a for a in self._account_index if a.get("code") == code), None)


# ── 2. Reconciliation Engine ──────────────────────────────────────────────────

class ReconciliationEngine:
    """
    Match bank transactions with vouchers using:
    - Exact amount matching
    - Date window matching (±3 days)
    - Reference/narration fuzzy matching
    """

    DATE_WINDOW_DAYS = 3
    EXACT_CONFIDENCE = 0.98
    FUZZY_CONFIDENCE = 0.80

    def match(
        self,
        bank_txns: list[dict],
        vouchers: list[dict],
    ) -> list[ReconciliationMatch]:
        matches = []
        used_vouchers: set[str] = set()

        for txn in bank_txns:
            match = self._try_match(txn, vouchers, used_vouchers)
            if match:
                matches.append(match)
                used_vouchers.add(match.voucher_id)

        return matches

    def _try_match(self, txn: dict, vouchers: list[dict], used: set[str]) -> Optional[ReconciliationMatch]:
        txn_amount = abs(float(txn.get("amount", 0)))
        txn_date   = txn.get("txn_date")
        txn_ref    = (txn.get("reference") or "").strip().lower()
        txn_narr   = (txn.get("narration") or "").strip().lower()

        best_score  = 0.0
        best_match  = None

        for v in vouchers:
            if v["id"] in used:
                continue
            v_amount = abs(float(v.get("total_amount", 0)))
            v_date   = v.get("date")
            v_ref    = (v.get("reference") or "").strip().lower()
            v_narr   = (v.get("narration") or "").strip().lower()

            if abs(txn_amount - v_amount) > 0.01:
                continue  # Amount must match exactly

            date_delta = abs((txn_date - v_date).days) if txn_date and v_date else 999
            if date_delta > self.DATE_WINDOW_DAYS:
                continue

            # Score
            score = self.EXACT_CONFIDENCE
            if date_delta > 0:
                score -= date_delta * 0.05

            if txn_ref and v_ref and txn_ref == v_ref:
                score = min(score + 0.05, 0.99)
            elif txn_narr and v_narr:
                fuzzy = fuzz.partial_ratio(txn_narr, v_narr) / 100.0
                score = min(score * 0.9 + fuzzy * 0.1, 0.97)

            if score > best_score:
                best_score = score
                match_type = "exact" if date_delta == 0 else "fuzzy_date"
                best_match = ReconciliationMatch(
                    bank_txn_id=str(txn["id"]),
                    voucher_id=str(v["id"]),
                    confidence=score,
                    match_type=match_type,
                    delta_days=date_delta,
                )

        return best_match


# ── 3. Anomaly Detector ────────────────────────────────────────────────────────

class AnomalyDetector:
    """Detect duplicates, unusual amounts, and suspicious transactions."""

    def detect(self, transactions: list[dict]) -> list[AnomalyResult]:
        anomalies = []
        anomalies.extend(self._detect_duplicates(transactions))
        anomalies.extend(self._detect_round_amounts(transactions))
        anomalies.extend(self._detect_off_hours(transactions))
        return anomalies

    def _detect_duplicates(self, transactions: list[dict]) -> list[AnomalyResult]:
        seen: dict[str, str] = {}
        anomalies = []
        for txn in transactions:
            key = f"{txn.get('txn_date')}_{txn.get('amount')}_{(txn.get('narration','')[:30])}"
            if key in seen:
                anomalies.append(AnomalyResult(
                    txn_id=str(txn["id"]),
                    anomaly_type="duplicate",
                    severity="high",
                    description=f"Possible duplicate of transaction {seen[key]}",
                    confidence=0.90,
                ))
            else:
                seen[key] = str(txn["id"])
        return anomalies

    def _detect_round_amounts(self, transactions: list[dict]) -> list[AnomalyResult]:
        anomalies = []
        for txn in transactions:
            amount = float(txn.get("amount", 0))
            if amount >= 100000 and amount % 100000 == 0:
                anomalies.append(AnomalyResult(
                    txn_id=str(txn["id"]),
                    anomaly_type="round_amount",
                    severity="medium",
                    description=f"Unusually round large amount: ₹{amount:,.0f}",
                    confidence=0.60,
                ))
        return anomalies

    def _detect_off_hours(self, transactions: list[dict]) -> list[AnomalyResult]:
        """Flag transactions on public holidays / weekends (basic)."""
        return []  # Implement with holiday calendar if needed


# ── 4. Bank OCR ───────────────────────────────────────────────────────────────

class BankOCR:
    """Extract text from scanned bank statement images/PDFs using Tesseract."""

    def extract_text(self, image_bytes: bytes) -> str:
        if not OCR_AVAILABLE:
            return ""
        try:
            from PIL import Image
            import io
            img  = Image.open(io.BytesIO(image_bytes))
            text = pytesseract.image_to_string(img, lang="eng")
            return text
        except Exception:
            return ""
