# PHASE 2 AUDIT REPORT — KYC COMPLIANCE PAGE

**Date**: May 2024  
**Scope**: KYC Review & Compliance Module (`KycReviewPage.tsx`, `useAdminKyc.ts`, `KycDecisionModal.tsx`, `KycDocumentViewer.tsx`, `KycQueueTable.tsx`)  
**Status**: Read-Only Audit Completed

---

## Executive Summary

This read-only audit examines the KYC Review & Compliance page (`/admin/kyc`), identifying root causes for the status filter tab reset bug, state management flaws in the decision/MFA workflow, and potential error suppression issues during review submission.

---

## 1. The Tab Reset Bug (`useAdminKyc.ts` & `KycReviewPage.tsx`)

### Root Cause Analysis
- **File & Lines**: `[useAdminKyc.ts](file:///C:/SkiesPro/frontend/src/hooks/admin/useAdminKyc.ts#L36-L38)`
- **Problem**: The initial mount `useEffect` explicitly hardcodes `void fetchPendingKyc('pending');`:
  ```typescript
  useEffect(() => {
    void fetchPendingKyc('pending');
  }, [fetchPendingKyc]);
  ```
- **Behavior**: Every time `useAdminKyc` mounts (or re-renders if dependencies shift), it fetches `'pending'` KYC documents regardless of the user's current `statusFilter` state. Furthermore, if `statusFilter` is initialized to `'pending'`, any navigation away and back or component remount unconditionally forces the view back to `'pending'` even if the user selected `'approved'`, `'rejected'`, or `'all'`.

### Proposed Fix
- Change the `useEffect` to fetch based on `statusFilter` (or remove the hardcoded `'pending'` and fetch `statusFilter` on mount):
  ```typescript
  useEffect(() => {
    void fetchPendingKyc(statusFilter);
  }, [fetchPendingKyc, statusFilter]);
  ```

---

## 2. KYC Decision Flow & Error Handling (`KycDecisionModal.tsx` & `useAdminKyc.ts`)

### 2.1 Modal Closing Race Condition on Error
- **File & Lines**: `[KycDecisionModal.tsx](file:///C:/SkiesPro/frontend/src/components/admin/KycDecisionModal.tsx#L40-L45)`
- **Problem**: In `handleMfaConfirm`:
  ```typescript
  const handleMfaConfirm = async (totpCode: string) => {
    await onConfirm(application.id, decisionStatus, notes, totpCode);
    onClose();
  };
  ```
  If `onConfirm` (`reviewKyc`) throws an API error, JavaScript execution jumps immediately to the hook's catch block, but because `handleMfaConfirm` lacks a `try/catch`, `onClose()` is still invoked or the error is unhandled in the modal, causing the modal to close and the error state inside `KycDecisionModal` to be lost while `useAdminKyc` captures the error globally.

### 2.2 Missing Submission Loading State
- **Problem**: The "Proceed to MFA Confirmation" button in `KycDecisionModal.tsx` does not reflect the `isLoading` state from `useAdminKyc`, allowing multiple clicks while an audit decision submission is in flight.

---

## 3. Shared Component Adoption

### 3.1 Table Loading & Empty States
- **Status**: Fully Adopted
- **Findings**: `KycQueueTable.tsx` successfully integrates `TableLoading` and `TableEmpty` components.

---

## 4. File Reference Summary

| Component / Hook | File Path | Key Audit Findings |
|---|---|---|
| Hook | [`useAdminKyc.ts`](file:///C:/SkiesPro/frontend/src/hooks/admin/useAdminKyc.ts) | Hardcoded `'pending'` in `useEffect` causes tab reset bug. |
| Page | [`KycReviewPage.tsx`](file:///C:/SkiesPro/frontend/src/pages/admin/KycReviewPage.tsx) | Integrates `FilterTabs` and `KycDecisionModal`. |
| Modal | [`KycDecisionModal.tsx`](file:///C:/SkiesPro/frontend/src/components/admin/KycDecisionModal.tsx) | `handleMfaConfirm` closes modal unconditionally; lacks loading state indicator. |
| Table | [`KycQueueTable.tsx`](file:///C:/SkiesPro/frontend/src/components/admin/KycQueueTable.tsx) | Uses shared `TableLoading` and `TableEmpty` components. |
