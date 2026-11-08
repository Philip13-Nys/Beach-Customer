# Booking enhancements: implementation and verification report

Date: 8 November 2026. Changes are local source changes in the customer app and the confirmed staff app, Resort Management System. Neither hosting site nor production Firestore rules were deployed. No production data migration, package installation, billing upgrade, payment gateway, or new external service was introduced. Administrator, manager and receptionist access here refers to Users login accounts; the Staff employee collection is unchanged. Updated requirement: payments use a reference number only. Receipt-image upload requirements and upload calls have been removed from bookings, activities/packages, and subsequent payments. Existing Cloudinary profile/catalog image functionality is unchanged.

## Release status and remaining requirements

The customer flows and staff workflow changes are implemented and tested locally. This is not a claim that every requested security guarantee is already enforceable in production. Complete the following prerequisites before a coordinated release:

1. **Staff authentication across Firebase projects:** staff signs in to the admin project, while online Bookings and Payments are in the customer project. Admin-project credentials do not authorize customer-project Firestore requests. The proposed customer rules require trusted customer-project staff Auth claims. Deploying these rules before establishing that access would block receptionist operations. A client-editable Users.role field is not sufficient.
2. **Global atomic allocation:** confirmations now serialize with a room-type lock inside the database containing the reservation, and recheck physical inventory and reservations. Tests prove two updated online confirmations cannot both take the last room in that project. Online confirmations and walk-ins still have different project transactions. They cannot form one atomic cross-project transaction. A single allocation authority in an existing project, or an existing trusted backend coordinating allocation, is still required for the full cross-channel guarantee.
3. **Direct-request overlap/capacity enforcement:** the customer app serializes normal requests with an account revision and checks fresh owned reservations. Rules require the paired payment, ownership, verification claim, valid dates and matching revision. Rules cannot query arbitrary other booking date ranges or read the admin project. A malicious client could bypass the app overlap query and submit an additional pending request. It cannot confirm it or record money received under the proposed rules. Rejecting every such direct request requires a trusted operation or a rule-verifiable inventory/date-lock model and migration.
4. **Public booking reads:** existing public availability queries still read the customer Bookings collection. The proposed rules retain that existing read access to avoid silently breaking availability. This remains a privacy concern because booking records include customer details. Provide and backfill a public inventory projection before restricting Bookings reads to owners and staff. Payment-reference details are kept in owner/staff-readable Payments and new cancellation remarks in a private audit subcollection, rather than adding that sensitive content to public Bookings.
5. **Reference-only payment update:** new payment submissions do not upload or store receipt images. Previously stored image data/assets, if any, have not been deleted. Historical Cloudinary receipt URLs would retain their existing delivery permissions. The staff interface may still display an existing historical receipt link when one is present.

Cloud Functions were not introduced as a workaround: production deployment requires the Blaze plan, which conflicts with the no-billing-upgrade restriction. See [Firebase Functions deployment requirements](https://firebase.google.com/docs/functions/get-started). Firebase Storage was also not introduced; see [Firebase Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024). Existing Firebase and Cloudinary usage quotas still apply; account plan settings were not changed or independently audited.

## Confirmed root causes and implemented changes

### Registration and verification

- Registration previously checked that a phone value existed, rather than validating Philippine mobile formats. Both email and Google registration now accept 09XXXXXXXXX or +639XXXXXXXXX, reject malformed values, and save +639XXXXXXXXX. Profile editing uses the same validator. Valid legacy local-format numbers are normalized during the booking transaction.
- The auth observer and Google sign-in could create profiles with empty phone numbers before registration validation completed. Profile creation is now handled by registration. Unregistered Google sign-in directs the customer to registration; Google registration supplies the validated contact number and initializes customer state explicitly.
- Verification had no resend flow. A 60-second cooldown persists in browser storage, with an in-memory fallback and Firebase throttling. Resending uses a separate in-memory Auth instance for the same existing project, so it cannot switch the main signed-in customer or expose another account’s chat/profile state.
- Verification email delivery now follows profile creation. Failed delivery explains that the account exists and offers the resend route. A verified Auth account missing its profile receives a clear sign-in error rather than an apparent successful login followed by redirects.
- Booking/payment operations reload the Firebase user and refresh its token. The server rules check email_verified. The new verification action page validates and applies Firebase action codes and explains success, expired links, invalid/used links, and connection failures.
- To use the app-owned verification action page, configure only the Email address verification template’s custom action URL in Firebase Authentication to the hosting root, e.g. https://divingresort.app/. Firebase appends mode and oobCode; the app supports that query format and the existing hash route. The console/template setting was not changed. Default Firebase-hosted action links continue to use Firebase’s handler.

### Payment before request submission

- Room and activity/package requests require configured GCash instructions and a numeric 10–20 digit transaction reference before final submission is enabled. No receipt image is required.
- The form displays the deposit from the existing downPaymentPercent policy and the balance after verification. Existing monetary calculations and rounding are unchanged.
- Booking requests atomically save the booking, pending payment reference record and account revision. Status remains pending-payment-verification; paymentStatus remains pending_verification; amountPaid stays zero until the receptionist verifies the actual payment.
- The standalone payment page, balance payments and payment resubmissions also accept the reference number only. Neither these flows nor booking submission sends an image to Cloudinary.
- The proposed rules accept reference-only submissions while retaining ownership, verified-login, amount, transaction-pairing and pending-status restrictions. They have not been deployed.
- Receptionists must check the actual transaction and whether its reference was already applied to another payment. Supplying a reference does not itself verify receipt of money or confirm a reservation.
- Legacy payment-image data is retained. Profile pictures, catalog images and the resort payment QR display remain available.

### Availability, duplicates and reservation counts

- Pending records were previously included in availability calculations, and different pages used different rules. Shared customer calculations now use physical room records, checkout-exclusive overlaps, confirmed/occupied reservations, and legacy accepted aliases such as reserved/approved. Pending requests do not hold capacity.
- Availability updates through Firestore listeners on the landing calendar, room list, room details and booking page. Failed availability reads disable booking. Fully booked room cards remain visible with a disabled label. The booking page performs a fresh check before submission, including direct-URL navigation.
- Mirrors linked to the same booking are counted once. Consecutive non-overlapping stays are counted per night. Assigned physical rooms must remain usable for the complete requested stay. Occupied flags block untracked occupancy for the current resort day.
- Guest count, calendar dates and the existing staff maximum of 365 nights are validated. The final booking submission has a synchronous click guard. A session-stored request ID and deterministic deposit document prevent repeat requests from creating another payment for the same submission.
- An account revision serializes app requests across tabs/devices. Fresh owned pending and confirmed bookings are checked on every transaction attempt. Checkout-adjacent dates and cancelled prior records allow a new request. Same-day activities occupy their calendar day for this account-level overlap policy.
- The staff app rechecks allocation before accepting a reservation. Online confirmations now have an allocation lock as well as staff reservations. Customer date changes are sent as modificationRequest metadata rather than letting the customer directly rewrite confirmed dates and charges. Staff must review and use Edit to approve; existing dates remain in effect until then. Approving the requested dates clears the pending request and records the reviewing staff identity/time.
- Staff pending-payment requests have their own visible status/filter. Pending requests are excluded from scheduled confirmed check-ins/check-outs and physical-room holds. Checked-in guests continue to occupy inventory.

### Cancellation

- Cancellation previously depended only on pending/confirmed status and did not require remarks. It now opens 24 hours after createdAt and closes at the start of the check-in date in Philippine time. Same-day exceptions must go through resort staff; the estimated arrival time does not extend the online cutoff.
- Pending, pending-payment-verification and confirmed bookings are eligible only inside that window. Missing/unverifiable creation dates fail safely and direct the customer to the resort. Cancelled, checked-in, checked-out and completed records cannot be cancelled by customers.
- A confirmation dialog requires a trimmed 5–1,000 character reason. The transaction rechecks ownership and eligibility, then updates the booking status/cancellation time/actor ID and atomically creates a private Users/{uid}/bookingCancellations/{bookingId} audit containing the reason, timestamp and actor details. This avoids exposing personal remarks through the existing public booking reads. Identical cancellation retries succeed without rewriting the audit. Rules independently check the server clock, cutoff, reason, actor, paired audit and allowed field changes.
- The original booking record and financial fields are preserved. Cancellation audits are immutable to customers and are readable only by the owner or trusted staff under the proposed rules. History/listeners reflect the cancellation, and confirmed capacity is released. Cancellation does not issue a refund or change recorded payments.

## Modified customer files

| File | Purpose |
| --- | --- |
| [src/app/pages/Auth.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/pages/Auth.tsx>) | Phone validation, verification wording, resend UI and cooldown, Google registration consent. |
| [src/app/context/AppContext.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/context/AppContext.tsx>) | Controlled profile creation, normalized contact data, verified sign-in and clearer incomplete-profile handling. |
| [src/app/utils/registration.ts](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/utils/registration.ts>) | Shared Philippine mobile validator and verification message. |
| [src/app/services/emailVerification.ts](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/services/emailVerification.ts>) | Isolated resend authentication, cooldown and fresh verified-user checks. |
| [src/app/pages/VerifyEmail.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/pages/VerifyEmail.tsx>) | Firebase action-code success and failure handling. |
| [src/app/App.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/App.tsx>) | Verification routes and root query handling. |
| [src/app/pages/Profile.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/pages/Profile.tsx>) | Reuse mobile normalization when saving contact information; include payment-verification requests in pending totals. |
| [src/app/components/BookingPayment.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/components/BookingPayment.tsx>) | Required GCash payment instructions, deposit totals and policy notices. |
| [src/app/utils/paymentReference.ts](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/utils/paymentReference.ts>) | Shared validation for numeric payment references. |
| [src/app/utils/manualPayment.ts](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/utils/manualPayment.ts>) | Shared manual-payment form contract and readiness validation. |
| [src/app/services/bookingRequests.ts](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/services/bookingRequests.ts>) | Atomic request/payment-record save, ownership, idempotency, phone normalization and app-level overlap prevention. |
| [src/app/pages/Booking.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/pages/Booking.tsx>) | Room submission flow and payment requirement. |
| [src/app/pages/Services.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/pages/Services.tsx>) | Activity/package submission flow and matching payment requirement. |
| [src/app/pages/Payment.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/pages/Payment.tsx>) | Reference-only payment submission, balance payments and resubmission. |
| [src/app/pages/BookingConfirmation.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/pages/BookingConfirmation.tsx>) | Updated status wording and manual-verification explanation. |
| [src/app/utils/availability.ts](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/utils/availability.ts>) | Shared inventory, overlap, status and deduplication calculations. |
| [src/hooks/useRoomAvailability.ts](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/hooks/useRoomAvailability.ts>) | Live inventory subscriptions and fresh submission checks. |
| [src/app/pages/Landing.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/pages/Landing.tsx>) | Live calendar availability using shared calculations. |
| [src/app/pages/Rooms.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/pages/Rooms.tsx>) | Physical availability and visible disabled fully booked cards. |
| [src/app/pages/RoomDetail.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/pages/RoomDetail.tsx>) | Selected-date booking eligibility and confirmation notice. |
| [src/app/pages/BookingHistory.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/pages/BookingHistory.tsx>) | Cancellation remarks/window, new status and safe date-change requests. |
| [src/app/services/customerBookings.ts](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/services/customerBookings.ts>) | Transactional cancellation with ownership, policy and audit details. |
| [src/app/utils/bookingPolicy.ts](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/utils/bookingPolicy.ts>) | 24-hour cancellation policy and eligibility helper. |
| [src/app/utils/bookingPresentation.ts](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/app/utils/bookingPresentation.ts>) | Readable pending-payment-verification label. |
| [firestore.rules](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/firestore.rules>) | Proposed server authorization, payment pairing, audit constraints and staff locks. |

## Modified staff files

| File | Purpose |
| --- | --- |
| [src/app/bookingOperations.ts](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Resort Management System/src/app/bookingOperations.ts>) | Allocation/account locks, verified deposit gate, catalog quote checks, duplicate checks, payment review state and customer audit integration. |
| [src/app/bookingAvailability.ts](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Resort Management System/src/app/bookingAvailability.ts>) | Pending requests no longer hold physical inventory. |
| [src/receptionist/CustomerReservations.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Resort Management System/src/receptionist/CustomerReservations.tsx>) | New pending-payment status, private cancellation-audit reads, live open-detail synchronization and date-change request visibility. |
| [src/receptionist/Payments.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Resort Management System/src/receptionist/Payments.tsx>) | Receipt link and actual-bank-transaction verification reminder. |
| [src/receptionist/ReceptionistsDashboard.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Resort Management System/src/receptionist/ReceptionistsDashboard.tsx>) | Exclude unconfirmed requests from scheduled confirmed arrivals/departures. |
| [src/manager/ReceptionistDashboards.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Resort Management System/src/manager/ReceptionistDashboards.tsx>) | Include payment-verification requests in pending totals and clarify all-request versus confirmed counts. |
| [src/receptionist/ReceptionistLayout.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Resort Management System/src/receptionist/ReceptionistLayout.tsx>) | Display the new pending state clearly in the notification/header booking details. |
| [tests/bookings.test.cjs](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Resort Management System/tests/bookings.test.cjs>) | Update capacity cases and assert pending requests do not consume rooms. |
| [tests/integration.test.cjs](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Resort Management System/tests/integration.test.cjs>) | Verify deposit gates and confirmed/pending room displays. |
| [tests/walkIn.emulator.test.cjs](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Resort Management System/tests/walkIn.emulator.test.cjs>) | Real concurrent allocation, payment review and quote-tampering scenarios. |

Customer tests modified: [tests/booking-cancellation-ui.test.mjs](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/tests/booking-cancellation-ui.test.mjs>), [tests/booking-date-handoff.test.mjs](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/tests/booking-date-handoff.test.mjs>), [tests/customer-bookings.test.mjs](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/tests/customer-bookings.test.mjs>), [tests/firestore-rules.emulator.mjs](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/tests/firestore-rules.emulator.mjs>), [tests/helpers/runtime.mjs](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/tests/helpers/runtime.mjs>), [tests/notifications.test.mjs](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/tests/notifications.test.mjs>), [tests/payment.test.mjs](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/tests/payment.test.mjs>), [tests/request-enhancements.test.mjs](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/tests/request-enhancements.test.mjs>).

## Firestore changes and compatibility

- Reuse Users, Bookings and Payments. There is no duplicate booking or payment business collection.
- Add Users/{uid}/bookingState/requests with revision, bookingId and updatedAt for serialization. Add/reuse BookingLocks/{roomTypeId} in the database where the staff operation runs. These contain concurrency metadata, not duplicate reservations. New cancellation reasons are stored in the owner/staff-only Users/{uid}/bookingCancellations/{bookingId} audit subcollection; this is necessary while the existing public booking read model remains.
- New Bookings carry requestVersion: 2, paymentId, downPaymentPercent/downPaymentAmount and pending verification states. Payments stores referenceNumber and pending verification details. New submissions do not store proof or proofOfPayment fields.
- Cancellation and modificationRequest fields are additive. Existing bookings, reviews, payments and authentication accounts are preserved. Legacy valid 09-format phone numbers normalize when a customer submits a new request.
- Proposed rules protect customer ownership, prohibit booking deletion, require verified new requests and paired pending payments, and prevent customers from rewriting prices, amountPaid, confirmation status or another customer’s record. Staff claim holders retain manual payment creation/review authority. New-request confirmation additionally requires an already verified payment record and recorded deposit.
- These rules were validated against the local emulator only. Existing admin-project rules and live customer-project rules were not replaced. No index/configuration migration was executed.

## Verification results

| Check | Result |
| --- | --- |
| Customer tests: node --test tests/*.test.mjs | 65 passed |
| Customer rules/real transactions: tests/firestore-rules.emulator.mjs | 12 passed |
| Staff unit/integration tests: tests/bookings.test.cjs and tests/integration.test.cjs | 41 passed |
| Staff real transactions: tests/walkIn.emulator.test.cjs | 19 passed |
| Customer Vite production build, write:false | Passed |
| Staff Vite production build, write:false | Passed |
| Strict customer App.tsx dependency graph | 0 diagnostics |
| Strict customer main.tsx entry point | Existing TS7016: missing react-dom/client declarations |
| Strict staff App.tsx dependency graph | Existing TS18047: editUser may be null in UserRoleManagement.tsx |
| Git whitespace validation | Passed |

The checks used installed tools and disposable localhost emulator projects. The staff emulator scenarios intentionally use open rules only in their isolated demo projects to exercise transaction behavior; they do not prove production staff authentication. The separate customer-rule suite tests authorization with mocked Auth claims. Real email delivery, reference reconciliation against actual payments, browser viewport rendering and deployed staff permissions still require a controlled integration/UAT check. No lint script is configured in the customer package.

Existing type-check limitations: [src/main.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Customer Module for Resort/src/main.tsx:4>) has no installed react-dom/client declaration; [src/app/components/UserRoleManagement.tsx](<C:/Users/Philip/OneDrive/Documents/capstone/codes/Resort Management System/src/app/components/UserRoleManagement.tsx:194>) has a nullable editUser diagnostic. No type shim, package installation or unrelated role-management rewrite was added to hide those issues.

## Requirement checklist

| Requirement | Implementation/test status |
| --- | --- |
| PH number formats, normalization and invalid-input blocking | Implemented; unit and rule tests |
| Firebase verification messages and resend cooldown | Implemented; unit tests; actual email delivery/template configuration needs UAT |
| Fresh verification checks before booking/payment | Implemented; Auth helper and negative rule tests |
| Deposit instructions and reference before request save | Implemented; no image required; UI logic, validation and real transaction tests |
| Pending-payment-verification and no automatic confirmation/money credit | Implemented; real rule and staff review tests |
| Separate pending requests and confirmed inventory | Implemented in both apps; unit and emulator tests |
| Physical-room availability, disabled buttons, live changes | Implemented; calculation and navigation tests; visual UAT remains |
| Atomic confirmation across all projects/channels | Partial: same-project locking tested; cross-project authority unresolved |
| Reject every malicious direct request for full/overlapping dates | Partial: protected confirmation, validation and paired-payment rules; complete trusted date/capacity enforcement unresolved |
| 24-hour cancellation, reason, confirmation, audit and record retention | Implemented; UI, service and server-rule tests |
| Duplicate/repeated normal app submissions and cancelled-record reuse | Implemented; real concurrent transaction and retry tests |
| Safe staff access under stricter production rules | Requires customer-project staff authentication/claims setup |
| Private booking reads | Existing public availability model remains; new payment-image uploads removed |
| No new paid services, packages or billing setup | Respected; existing image features retained and payment uploads removed |

## Manual acceptance checks before release

1. Register with both accepted phone formats; try short, long, alphabetic and punctuated values on desktop and mobile. Confirm the saved number is normalized.
2. Verify a test email through the configured handler. Test expired/used links and resend cooldown. Confirm resending does not switch an existing main-app session. Verify new Google users complete registration/contact information.
3. Select dates on Home, open a room, and confirm the same dates/guests reach the booking form after navigation/refresh/login.
4. Confirm submission is disabled for an empty or invalid reference. Enter a valid reference without an image and verify submission is enabled. Confirm no file picker or payment-image upload request exists.
5. Submit a controlled request in staging. Confirm amountPaid is zero, the full balance remains unpaid, the new pending state appears, and no confirmed capacity is consumed.
6. In receptionist Payments, use the reference to check actual received funds and confirm it has not already been applied elsewhere. Reject and resubmit once; accept once; verify that acceptance alone does not confirm the reservation.
7. After staff Auth/rules setup, accept a request and verify the inventory/count update. Run competing online confirmations and online-versus-walk-in tests against the eventual single allocation authority before claiming full concurrency protection.
8. Try cancelling before 24 hours, after 24 hours, and at the resort check-in date cutoff. Test missing/short remarks, another account, already cancelled, checked-in and checked-out records. Check that balances/payment records remain unchanged and no refund is triggered.
9. Try overlapping and checkout-adjacent dates, two tabs, retry after a dropped response, and rebooking after a prior cancellation. Confirm one intended request and one pending payment record are saved.
10. Request a date modification from History; confirm the original dates/charges remain until staff reviews and approves. Check the staff detail view, room availability, customer history and notifications.
11. Review mobile layouts, keyboard focus, form labels, error messages and loading states using the actual deployed theme.
12. Resolve the two existing strict TypeScript issues and complete coordinated Auth, rules, privacy and allocation prerequisites before deployment.

Unrelated existing dirty Firebase hosting-cache data was preserved. Source changes were not committed, pushed or deployed.
