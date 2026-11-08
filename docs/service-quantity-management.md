# Service quantity management — implementation report

Package behavior in this historical report is superseded by [Packages without scheduled inventory](package-booking.md), implemented November 9, 2026. Schedule and quantity controls now apply to standalone services only.

Implemented locally in Customer Module for Resort and Resort Management System on November 8, 2026. No packages, external services, billing upgrades, hosting deployments, live data migrations, or production rule publications were performed.

## Root causes and fixes

The previous availability implementation counted participants for every resource. It could describe snorkeling slots but could not reserve two banana boats for eight people. Some dashboard counts also used a catalog item's active status rather than actual session inventory. Both apps now distinguish **equipment units** from **participant slots** and share the same overlap calculations.

Two modification bugs were fixed: removing the last activity from a room booking retained its allocation, and an in-flight edit could release the old session/quantity before the booking write succeeded. Edits now protect original and proposed capacity until their outcome is known; successful removal clears the old allocation.

## Configuration and booking behavior

In **Manager → Services**, configure each service/package's counting mode, total quantity, participants per unit when applicable, session duration, operating hours and operating days. For three banana boats carrying five people each, use equipment units, quantity 3, and participants per unit 5. Eight people need at least two units. For four participant slots, use participant counting and capacity 4.

Existing configured records without a counting mode remain participant-based. No automatic conversion or migration occurs. Incomplete schedules remain visible but cannot be booked. The save operation checks the manager role and current bookings/allocations, rejects unsafe mode changes while future reservations or pending requests exist, and rejects capacity reductions below reserved/held demand. Existing passenger requirements also prevent an unsafe reduction of participants per unit.

**Rates remain per participant.** Quantity controls inventory use, not a new pricing basis. Existing reservation fees, down-payment calculations, verification and refund behavior remain in place.

For a selected Philippine date/session, availability uses peak overlapping confirmed quantity and processing holds. Session end is exclusive, so back-to-back sessions do not overlap. Ordinary pending and pending-payment-verification requests appear separately and do not reserve inventory. Receptionist confirmation rechecks current configuration and availability. Competing online confirmations and walk-ins use the same admin-project allocation transaction.

Customer Activities cards show capacity units and available quantity, with expandable session totals. The dialog, room add-ons, walk-ins and reservation editor have separate unit and participant controls. Fully booked sessions are disabled. Excessive quantities show validation and block submission. An unselected room add-on is disabled when no session is available anywhere in the selected stay; selected add-ons can still be removed or rescheduled. Booking review and history retain unit quantities.

Packages also consume their linked services. Linked equipment is rounded upward from participant count divided by participants per unit. Linked capacity may limit a package below its own capacity. Included services share the entire package session; this does not create an itinerary with separate times for each inclusion.

During a confirmed booking edit, original and proposed sessions remain protected. Shared intervals use the larger quantity rather than counting the same booking twice. Failed edits restore the prior allocation; uncertain network outcomes retain protected capacity for reconciliation. Removing every activity from a room booking releases its allocation after the edit commits.

Cancellation releases capacity without deleting the booking or decrementing catalog inventory. Completed standalone activities release capacity. Hotel checkout preserves scheduled departure-day add-ons. Unscheduled legacy confirmed activities block conservatively, and corrupt historical quantities cannot create imaginary availability.

Existing catalog, booking and allocation listeners update both apps without a refresh. Loading/read failures disable availability-dependent submissions. Periodic local recalculation handles sessions that have already started.

## Dashboards, calendar and reports

The shared live panel is integrated into administrator, manager and receptionist dashboard/overview pages. Date, service/package and session filters display **Total, Reserved, Processing, Pending and Available** with the quantity unit. Equipment units and participant slots are not added into a misleading combined total.

The receptionist calendar now offers Room calendar and Service calendar tabs. Its existing room calendar remains intact. Manager and receptionist Reports include a live availability panel with CSV export. The manager report generator also offers a Service Availability Snapshot report with a maximum 31-day range.

Exports include date/session, counting unit, quantities, status and snapshot generation time. They are **current operational snapshots using current settings**, not historical capacity audits. Reserved/processing figures describe peak concurrent use of the primary resource; linked services may further constrain a package's remaining availability.

## Firestore changes

No new collection or replacement database is required. Existing identifiers, images, descriptions, rates and financial records are preserved. Availability is derived instead of permanently decrementing an inventory field.

| Existing location                                                   | Additive fields/behavior                                                                                                                                                                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin `services/{id}.availability` and `packages/{id}.availability` | Optional `capacityType` (`participants` or `units`); `participantsPerUnit` for units. Existing capacity, duration, hours and days remain.                                                                  |
| Customer `Bookings` and admin `reservations`                        | Primary activity `quantity` for equipment-based bookings, separate from `participants`.                                                                                                                    |
| Existing booking `addOns[]`                                         | Optional quantity alongside existing activity date, session, participants and price.                                                                                                                       |
| Existing `activityReservations[]`                                   | Unit snapshots add quantity and `capacityType: "units"`; legacy participant snapshots retain their shape.                                                                                                  |
| Admin `BookingLocks/activityInventory`                              | Existing allocations retain requests, state and operation token. Held edits additionally store `occupiedRequests` protecting original/proposed schedules; successful edits retain committed requests only. |

Existing services without configured schedules must be configured through Manager → Services before their booking flow is enabled.

## Security rules prepared, not deployed

The published admin rules were inspected read-only. They currently contain an unrestricted wildcard and public account-profile writes. Narrow manager rules alone cannot protect quantities because another matching allow can grant access. See [Firebase rules behavior](https://firebase.google.com/docs/rules/rules-behavior).

`docs/admin-service-quantity.rules` is a complete staged **admin-project** rules file based on the published version. It excludes services, packages, BookingLocks and Users from the unrestricted fallback; protects account roles; permits enabled Administrator/Manager accounts to configure quantities; and permits Receptionist/Manager/Administrator accounts to update revisioned allocation locks. Public catalog/availability reads and normal account presence updates remain supported. Customers, guests, unprofiled users and disabled managers cannot change quantities. Users cannot promote themselves through overlapping profile rules. The personnel-only Staff collection is not treated as a login-account authority.

Read-only published-rule references are saved as `docs/admin-80f41.published-rules.before-service-quantity.rules` and `docs/customeraccount-ce2ae.published-rules.before-service-quantity.rules`. They contain no passwords or tokens.

**Security requirement still incomplete:** the staged admin file preserves existing permissions for unrelated collections. It is not a full production rules overhaul. The live customer booking rules and admin reservation fallback still permit unauthorized booking writes. Allocation transactions coordinate supported application workflows; they do not make a browser a trusted backend or protect against a malicious direct writer under permissive booking rules.

Management accounts authenticate in admin-80f41, without an equivalent trusted staff identity for customeraccount-ce2ae writes. Fully restricting booking/payment writes requires a deliberate staff-authentication bridge or trusted booking authority and corresponding rules. Publishing the stricter customer rules already in the repository without that integration would break receptionist operations. This has not been represented as solved, and no paid infrastructure was introduced.

Before publishing the staged admin rules, verify trusted Users profiles and account-management flows. Before hardened public deployment, resolve booking authorization across both projects. Do not deploy one project's rules to the other project. No rules were automatically published or wired into a new deployment configuration.

The shared allocation registry is one document and is intended for the resort's current scale, not unlimited history. Ended allocations are cleaned during subsequent confirmations. An interrupted cross-project outcome may need verified reconciliation; never clear a lock merely because a request timed out. Existing Firebase usage limits still apply, and live listeners consume the existing read quota.

## Completed tests and checks

**174 tests passed:** 90 customer tests, 49 management tests, 31 isolated booking/concurrency emulator tests, and 4 actual staged-rules permission tests.

Coverage includes unit/passenger validation, participant compatibility, corrupt historical quantities, linked packages, peak overlap, pending demand, sold-out dates, picker controls, live cancellation/configuration updates, reports/CSV, competing confirmations, concurrent capacity reduction, unit edits, failed edits, final-add-on removal, cancellation release, payment arithmetic and existing room workflows. Rules tests use authenticated role fixtures and guests against the actual emulator rules.

Both application TypeScript graphs have zero diagnostics. Both production builds passed using `write: false`, without refreshing deployment output. Customer mobile visual checking at 390 × 844 confirmed a dialog within the viewport, separate quantity/passenger controls, live quantities and an excessive-quantity warning. No live booking or payment was submitted. Authenticated manager visual acceptance remains a manual rollout check; its form/component and database tests passed.

Reproduction commands (start the existing local emulator first; never use production project IDs):

```powershell
# Customer workspace
node --test tests/*.test.mjs
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8788'
node --test tests/service-quantity-rules.emulator.mjs

# Resort Management System workspace
node --test tests/bookings.test.cjs tests/integration.test.cjs tests/stay-times.test.cjs tests/activity-management.test.cjs
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8788'
node --test tests/activity-inventory.emulator.cjs tests/walkIn.emulator.test.cjs
```

The activity/rules tests refuse a different host and use disposable demo projects only.

## Modified files

All customer paths below are relative to Customer Module for Resort. Management paths are relative to the sibling Resort Management System folder.

| Customer file                                                          | Purpose                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/app/utils/activityAvailability.ts`                                | Units/slots engine, quantities, stats, configuration guards, pending demand and edit holds. |
| `src/app/components/ActivitySchedulePicker.tsx`                        | Unit/passenger controls and session validation.                                             |
| `src/app/pages/Services.tsx`                                           | Quantity selection/persistence, card details and disabled submission.                       |
| `src/app/pages/Booking.tsx`                                            | Room add-on quantities and sold-out stay detection.                                         |
| `src/app/pages/BookingConfirmation.tsx`                                | Primary/add-on unit details.                                                                |
| `src/app/pages/BookingHistory.tsx`                                     | Unit quantities in history.                                                                 |
| `src/app/context/AppContext.tsx`                                       | Compatible optional quantity type.                                                          |
| `tests/activity-availability.test.mjs`                                 | Updated quantity caption assertion.                                                         |
| `tests/activity-quantity.test.mjs`                                     | Calculation, picker, board, report, edit-hold and live-update coverage.                     |
| `tests/service-quantity-rules.emulator.mjs`                            | Actual role-based permission checks.                                                        |
| `docs/admin-service-quantity.rules`                                    | Unpublished catalog/allocation/account-role rules.                                          |
| `docs/*published-rules.before-service-quantity.rules`                  | Published-rule reference copies.                                                            |
| `docs/service-quantity-management.md`, `docs/activity-availability.md` | This report and the prior report's continuation notice.                                     |

| Management file                                                               | Purpose                                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/app/activityAvailability.ts`                                             | Identical shared quantity engine.                                        |
| `src/app/activityInventory.ts`                                                | Transactional quantities and safe edit/release handling.                 |
| `src/app/serviceConfiguration.ts`                                             | Role-checked transactional catalog saves.                                |
| `src/app/activitySnapshot.ts`                                                 | Fresh snapshot reads for exports.                                        |
| `src/app/bookingOperations.ts`                                                | Quantity edits and final-add-on removal.                                 |
| `src/app/saveWalkIn.ts`                                                       | Walk-in quantities separate from people/prices.                          |
| `src/app/reportData.ts`                                                       | Bounded availability report generation.                                  |
| `src/app/components/ActivitySchedulePicker.tsx`                               | Matching staff quantity controls.                                        |
| `src/app/components/ActivityAvailabilityFields.tsx`                           | Counting mode, quantity, per-unit passenger limit and summaries.         |
| `src/app/components/BookingActivityEditor.tsx`                                | Quantity-preserving reservation editor.                                  |
| `src/app/components/ServiceAvailabilityPanel.tsx`                             | Live table, filters and CSV export.                                      |
| `src/app/components/Dashboard.tsx`                                            | Administrator availability panel.                                        |
| `src/app/components/ManagerDashboard.tsx`                                     | Panel and capacity-aware service/package counts.                         |
| `src/app/components/ReceptionistDashboard.tsx`                                | Embedded receptionist panel.                                             |
| `src/app/components/UserRoleManagement.tsx`                                   | Null-safe self-demotion guard; fixes its existing TypeScript diagnostic. |
| `src/manager/ServicesManagement.tsx`                                          | Validated saves and fresh catalog-write/delete role checks.              |
| `src/manager/ManagersDashboard.tsx`, `src/manager/ReceptionistDashboards.tsx` | Manager/reception overview panels.                                       |
| `src/manager/Reports.tsx`                                                     | Snapshot report template and live export panel.                          |
| `src/receptionist/WalkIn.tsx`                                                 | Unit schedules and sold-out add-on restrictions.                         |
| `src/receptionist/ReceptionistsDashboard.tsx`                                 | Receptionist live panel.                                                 |
| `src/receptionist/CalendarView.tsx`                                           | Service calendar tab.                                                    |
| `src/receptionist/Reports.tsx`                                                | Availability CSV panel.                                                  |
| `tests/activity-management.test.cjs`                                          | Manager form/unit-mode tests.                                            |
| `tests/activity-inventory.emulator.cjs`                                       | Competing unit requests, configuration changes and failed edits.         |
| `tests/walkIn.emulator.test.cjs`                                              | Real unit writes, edits, cancellations and full add-on removal.          |

Existing activity listeners, request checks, routes, payment verification and room-allocation infrastructure were reused. Unrelated pre-existing work was preserved.
