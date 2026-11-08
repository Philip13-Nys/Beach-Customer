# Packages without scheduled inventory

Implemented November 9, 2026, following the explicit choice to remove package scheduling and capacity limits everywhere. This supersedes the earlier package-capacity behavior in the activity and service quantity reports.

- Package add/edit forms no longer contain schedule, operating days, units/slots, capacity, or linked service inventory controls. The service availability date filter is hidden on the Packages tab.
- Package names, descriptions, prices, discounts and descriptive included-services lists remain. Saving packages does not require an availability policy. Existing database fields are preserved for compatibility but no longer enforce package inventory.
- Customer package cards no longer show duration, operating hours, capacity or session availability. Active packages can be opened without a configured schedule. Direct bookings keep their booking date and participant count, with existing per-person pricing and payment verification.
- Package room add-ons and walk-ins require no activity time slot. Participant counts still determine their existing per-person price. Manager/receptionist edits support packages without session controls.
- Packages create no timed allocations and do not allocate equipment or participant slots from their described included services. Separately booked services still enforce capacity, sessions, payment checks and safe transactional confirmations.
- Package-only historical booking snapshots and known package allocations no longer consume live service capacity. Mixed room bookings retain their separately selected service reservations. Ambiguous old mixed snapshots preserve the longest matching service interval conservatively rather than risk overselling. An unresolved old hold without a booking record still requires verified reconciliation; it is not blindly deleted.
- Availability dashboards, the service calendar and availability exports contain scheduled standalone services only. Package revenue, payments, reservation dates, cancellation policy and active-request duplicate prevention remain in place. Older package session/unit values are hidden in customer booking details/history.

The shared availability engine is identical in both applications. `PackageBookingFields.tsx` provides matching date/participant inputs. Related changes integrate the customer Services, Booking, BookingConfirmation and BookingHistory pages, customer activity preflight, management package forms/configuration saves, walk-ins, reservation editing, dashboards and availability reporting.

The unpublished admin rules draft was updated so package edits require a manager/administrator role without requiring an activity policy. No production rules were published. Existing security limitations documented in the service quantity report remain.

Verification: 96 customer tests, 49 management tests, 33 local booking/concurrency emulator tests and 4 local rules permission tests passed (182 total). Both TypeScript graphs had zero diagnostics and both production builds passed with `write: false`. The local customer package dialog was inspected and contained no session or unit controls. No live booking/payment was submitted, no database migration ran, and no hosting deployment occurred.

Deploy both updated applications together to avoid older clients continuing to apply package allocation rules. No new dependency, external service, or billing requirement was introduced.
