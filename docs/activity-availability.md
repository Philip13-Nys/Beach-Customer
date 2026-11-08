# Activity schedules and participant availability

This report describes the earlier participant-only implementation. See [service-quantity-management.md](service-quantity-management.md) for the subsequent units/participant-slots enhancement, current checks and staged security rules.

The customer and Resort Management System apps now use participant counts, as requested. No new external service, package, payment gateway, or Firebase deployment was introduced.

## Manager setup

In **Manager → Services**, add or edit each service/package and save:

- Total participant capacity per session (0 pauses new reservations).
- Session duration in minutes.
- Opening and closing times in Philippine time, within the same calendar day.
- Operating weekdays.
- For packages, the included service IDs whose participant capacity should be shared.

The existing `services` and `packages` documents receive an `availability` object containing `capacity`, `durationMinutes`, `opensAt`, `closesAt`, and `days`. Packages also store `serviceIds`. Existing descriptions, prices, images, and package inclusion text remain in place. `maxParticipants` and the duration label are maintained for older screens.

**Existing items have no invented schedule or capacity.** Customers can view their details, but cannot submit a reservation until a manager configures availability. Configure the staff app before rolling out the customer app. Packages reserve places in each linked service for the entire package session, so included services' operating hours must cover that interval. Multiple separately timed activities should be booked with separate schedules instead of pretending they share one session.

## Customer and receptionist behavior

The Activities page shows descriptions, prices, a date filter, operating hours, session choices, and remaining participant places. Room add-ons and receptionist walk-ins require an activity date, session, and participant count too. Prices for add-ons are calculated per participant; the existing room charges, configured reservation fee, and manual down-payment workflow are preserved.

New bookings save per-activity schedules and `activityReservations` snapshots. Their booked resource IDs, occupied intervals, and participant counts remain available even if catalog descriptions or session durations are later edited. Booking review/details display scheduled add-ons. Receptionists can schedule older pending requests through the reservation editor and must review the total if changing participant counts.

The existing per-customer date-overlap restriction remains unchanged. Activities attached to a room stay can be selected as room add-ons.

Only confirmed/in-progress activities consume places. Ordinary pending or pending-payment-verification requests do not. Cancelled reservations release their places immediately in live availability calculations. Checking out of a hotel stay does not silently cancel a scheduled departure-day add-on. An older confirmed activity without a usable schedule conservatively occupies its relevant day(s), rather than being ignored.

## Shared confirmation coordination

Both online confirmations and staff walk-ins reserve participant places through one transaction in the existing **admin-project `BookingLocks/activityInventory` document**. Its `allocations` map contains booking keys, resource intervals, participant counts, operation tokens, and confirmation state; it does not contain customer names, emails, or payment information. This avoids creating a duplicate booking collection and coordinates activity capacity across the two existing Firebase projects.

The allocation is held before writing the reservation to its original database. Successful operations mark it confirmed; known failures reconcile the actual booking and restore/release that operation's hold. Operation tokens prevent an older retry from removing a newer allocation. Ended and cancelled allocations are cleaned during later confirmations. No receipt upload or payment gateway was added.

**Limitation:** two Firebase projects cannot share a single Firestore transaction. If the booking outcome cannot be read after a network failure, capacity remains held to prevent overselling. Staff must verify the actual reservation and interrupted operation before clearing such a hold; this implementation does not release uncertain holds automatically. Do not delete the shared lock while confirmations are running. The single registry document is intended for this resort's current booking volume, not an unbounded allocation history.

## Rules and deployment

No local or deployed security rules were changed. The existing admin project's rules must permit the customer app to read `BookingLocks/activityInventory`, and the authorized management account must be able to update it and the catalog. Existing broadly permissive rules remain a security limitation; frontend checks alone cannot prevent a malicious direct SDK write under those rules.

Deploy both updated apps together after configuration. There is no new Function, paid API, dependency installation, or required billing upgrade. Existing Firebase usage limits still apply.

## Verification

Final local verification on November 8, 2026: 77 customer tests, 48 management tests, and 24 isolated emulator tests passed (149 total). Both production builds passed with `write: false`; deployment output was not refreshed. The customer application TypeScript graph has zero diagnostics. The management application retains its existing unrelated `editUser is possibly null` diagnostic in `src/app/components/UserRoleManagement.tsx:194`. The test emulator was stopped afterward; neither hosting nor production rules/settings were deployed or changed by these checks.

- Customer tests: `node --test tests/*.test.mjs`.
- Management tests: `node --test tests/bookings.test.cjs tests/integration.test.cjs tests/stay-times.test.cjs tests/activity-management.test.cjs`.
- Isolated activity concurrency tests: start the existing Firestore emulator on `127.0.0.1:8788`, set `FIRESTORE_EMULATOR_HOST` to that value, then run `node --test tests/activity-inventory.emulator.cjs`. This test refuses other hosts and uses only `demo-activity-admin` and `demo-activity-customer`.
- Existing transaction regression tests also run against explicitly configured localhost demo projects: `node --test tests/walkIn.emulator.test.cjs`.
- Manually configure one service, choose a future date/time, submit and verify payment, confirm online, and observe reduced places in both apps. Try a competing walk-in, a linked package, another session, cancellation, and a room add-on.
- Verify small-screen layouts and simulate a read/write failure. No live reservation needs to be created for the isolated tests.

## Changed implementation files

Customer app:

- `src/app/utils/activityAvailability.ts`: shared policy validation, schedule generation, overlap counting, package resources, legacy handling and allocation calculations.
- `src/hooks/useActivityAvailability.ts`: live catalog, reservation and allocation subscriptions.
- `src/app/services/activityBookings.ts`: fresh availability checks before creating a request.
- `src/app/services/bookingRequests.ts`: attaches validated activity-reservation snapshots to new requests.
- `src/app/components/ActivitySchedulePicker.tsx`: date, session and participant controls.
- `src/app/pages/Services.tsx`: activity details, date filter, schedules, remaining places and booking controls.
- `src/app/pages/Booking.tsx`: scheduled room add-ons and participant pricing.
- `src/app/pages/BookingConfirmation.tsx`: booked activity times and participant details.

Management app:

- `src/app/activityAvailability.ts`: identical shared availability calculations.
- `src/app/activityInventory.ts`: common transactional participant allocation and failure reconciliation.
- `src/app/useActivityAvailability.ts`: live availability for management and reception screens.
- `src/app/components/ActivityAvailabilityFields.tsx`: manager schedule/capacity fields, linked package services and remaining-place summaries.
- `src/app/components/ActivitySchedulePicker.tsx`: matching staff schedule controls.
- `src/app/components/BookingActivityEditor.tsx`: activity scheduling in the reservation editor.
- `src/manager/ServicesManagement.tsx`: service/package add/edit integration and availability previews.
- `src/receptionist/WalkIn.tsx`, `src/app/saveWalkIn.ts`: walk-in activity scheduling, pricing and allocation.
- `src/receptionist/CustomerReservations.tsx`, `src/app/bookingOperations.ts`: activity-aware confirmation, edits, cancellations and session display.

Focused tests were added in both apps; existing booking-date, stay-time and emulator test fixtures were updated for the new integration.
