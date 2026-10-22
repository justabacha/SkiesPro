# Database Hygiene: Test Account & Staff Duplication Cleanup Report

## Status
Executed & Verified

---

## Task 1 — Final DELETE List (Task 1 Query Output)
The following 41 test fixtures and duplicate staff accounts were identified for cleanup (excluding the 4 protected emails and the historical user):

```json
[
  { "id": "e033f46c-f6a6-487b-b29f-4d1cd60020ea", "email": "admin-verify-1792438310522@example.com" },
  { "id": "fd1e98b0-2f71-48f5-975f-eb27a95ddf65", "email": "b2c-recon-1792448131151@example.com" },
  { "id": "86191bff-6dba-4cfc-ba68-5df8eade315f", "email": "badphone-1792435727356@example.com" },
  { "id": "1eb94e6c-7fdf-4885-81f8-12fa403b78f9", "email": "demo-isolation-1eb94e6c-7fdf-4885-81f8-12fa403b78f9@example.com" },
  { "id": "939279e8-cae5-4beb-8d9d-d3fbdebfe5ec", "email": "demo-security-939279e8-cae5-4beb-8d9d-d3fbdebfe5ec@example.com" },
  { "id": "6b3e72c8-ce10-4ec7-a191-b4d394e1b5ec", "email": "financeadmin-reject-1792692738624@example.com" },
  { "id": "e4c89993-bbcb-4389-a751-c4cd2d5902c1", "email": "financeadmin-reject-1792692828640@example.com" },
  { "id": "7ae2c052-b1e4-4f09-aa9a-7bace89212c9", "email": "financeadmin-reject-1792692889325@example.com" },
  { "id": "f3201282-1416-442e-ada3-e38a260b9f94", "email": "lowlock-1792674246659@example.com" },
  { "id": "a8940f6e-7b9c-461a-8904-8889b5c44278", "email": "lowlock-1792674861851@example.com" },
  { "id": "57b546b1-2dc9-4b9f-8f0e-24ab1e8dfcb6", "email": "nophone-1792435721200@example.com" },
  { "id": "99ff3837-43e8-4a23-a590-7b958c214e79", "email": "rejectuser-1792692739055@example.com" },
  { "id": "88cd6e81-eb42-4033-ab85-c81e1b247d34", "email": "rejectuser-1792692829071@example.com" },
  { "id": "b0838863-a79d-4258-9431-3e8c4feaa053", "email": "superadmin-reject-1792692737241@example.com" },
  { "id": "41e8714f-ea07-4098-b32d-16a554f66199", "email": "superadmin-reject-1792692827244@example.com" },
  { "id": "a4410e40-6764-4c7f-bcc7-12e278f87189", "email": "superadmin-reject-1792692887768@example.com" },
  { "id": "282abaad-2d1d-446c-a85a-4c598f5b5be0", "email": "superadmin-reject-1792692962246@example.com" },
  { "id": "d9d7d7f8-7026-4eed-8eb0-c86882e4019f", "email": "superadmin-reject-1792693049780@example.com" },
  { "id": "a3771c83-361a-42aa-b5b4-c08b785b2972", "email": "superadmin-reject-1792693162868@example.com" },
  { "id": "f3caa17f-5592-4d90-8731-d319e114d260", "email": "superadmin-reject-1792693331090@example.com" },
  { "id": "abeaa617-4bf6-4731-956f-8295815092e1", "email": "superadmin-reject-1792693537368@example.com" },
  { "id": "28297b86-22e5-4c55-a440-8fae3f28ae80", "email": "superadmin-reject-1792694024650@example.com" },
  { "id": "f005b6a8-fa17-4547-975a-b2474498e5d8", "email": "superadmin-reject-1792694281258@example.com" },
  { "id": "fa1c7b1f-7317-4e0f-a2eb-5260ee22e2a2", "email": "superadmin-reject-1792695630649@example.com" },
  { "id": "f7126aff-489d-4574-ac43-3893fbc9bbd8", "email": "superadmin-reject-1792695678843@example.com" },
  { "id": "3338b7e7-5bbc-4f92-bfe2-5594a9055c19", "email": "superadmin-reject-1792695821567@example.com" },
  { "id": "de504eb0-ef01-450a-9ff7-5317f27e169b", "email": "superadmin-reject-1792695959022@example.com" },
  { "id": "c26d3931-8400-463e-a495-ca301c4eb1c4", "email": "superadmin-reject-1792696115983@example.com" },
  { "id": "34c31752-b7ae-4858-a870-57e38cfbab81", "email": "superadmin-reject-1792696311735@example.com" },
  { "id": "10981d1f-3891-4fc5-ae52-d8642a60c021", "email": "superadmin-reject-1792696975811@example.com" },
  { "id": "96296bae-2809-4f3b-b3ad-44732176af7e", "email": "superadmin-reject-1792698355575@example.com" },
  { "id": "efeb3eff-0e4b-466c-b17e-7f0d36194865", "email": "superadmin-reject-1792698566137@example.com" },
  { "id": "630b9aac-0ba3-4d9a-8451-ecbcc001ac30", "email": "superadmin-reject-1792698801365@example.com" },
  { "id": "6f89dda3-373a-4779-9919-55fd22197800", "email": "superadmin-reject-1792698950270@example.com" },
  { "id": "0b078680-12e5-41af-98d7-23740286d2bb", "email": "superadmin-reject-1792699095553@example.com" },
  { "id": "9e1dd1e5-72cb-45ab-8aa2-693d06bc73b5", "email": "superadmin-reject-1792699365417@example.com" },
  { "id": "2bfc229b-378b-4777-af5c-16e348328733", "email": "unverified-1792674217676@example.com" },
  { "id": "56086c69-b831-40ee-a191-d774077d44c6", "email": "unverified-1792674829470@example.com" },
  { "id": "9a29643a-b294-48cf-a187-4bbb7efcb5c6", "email": "user-verify-1792438312480@example.com" },
  { "id": "49fd3eb0-5a95-48be-9343-807c349de3af", "email": "zerofee-1792674244726@example.com" },
  { "id": "96d9be48-b405-41b7-a0f9-53130ee376c0", "email": "zerofee-1792674859744@example.com" }
]
```

---

## Task 2 — Before/After User Counts
- **User count before cleanup**: 50
- **User count after cleanup**: 9

---

## Task 3 — Final List of Remaining Users (Exactly the 9 Keep Accounts)
1. `admin@skiespro.internal`
2. `compliance@skiespro.internal`
3. `finance@skiespro.internal`
4. `itsphestone@gmail.com`
5. `just1abacha@gmail.com`
6. `risk@skiespro.internal`
7. `ryan41rays@gmail.com`
8. `support@skiespro.internal`
9. `system@skiespro.internal`

---

## Safety Confirmations
- **Historical Withdrawal (`235d9ef4-8cde-42c9-be63-9accc9ac09d0`)**: Verified untouched and in `approved` state.
- **Historical User (`87d63bfc-4488-4a39-8f20-eda46453ebe9`)**: Verified protected and preserved (`itsphestone@gmail.com`).
