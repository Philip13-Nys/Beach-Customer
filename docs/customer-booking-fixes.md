# Customer booking fixes — implementation and verification

Date: November 4, 2026. Scope: this customer application. No live bookings, payments, accounts, or reviews were modified. No packages were installed. These changes have not been pushed or deployed.

## 1. AI conversations disappearing

**Confirmed cause:** the full-page assistant and floating assistant each stored their messages in component state. Unmounting the component discarded that state; refreshing also reset it. Requests belonged to those components rather than to a persistent conversation.

**Implemented:** a shared `ChatProvider` stays mounted above the routes. Both assistants use it, including its pending-request lock. It saves guest conversations in localStorage and authenticated conversations under the existing customer `Users` documents:

```text
Users/{uid}/chatSessions/{sessionId}
Users/{uid}/chatSessions/{sessionId}/messages/{messageId}
```

Each message has a stable ID, role, text, creation time and display timestamp. Merging by ID prevents snapshot reloads from duplicating messages; creation times determine their order. Device storage provides a fallback when cloud sync fails, with an explicit retry. Account changes hide the previous account's messages and abort its pending requests. New Chat creates another session; the previous one stays selectable. A reply arriving after navigation is appended to its original session. The existing AI endpoints and request payloads are retained.

**Files:** `src/app/context/ChatContext.tsx`, `src/app/utils/chatHistory.ts`, `src/app/components/ChatHistoryControls.tsx`, `src/app/App.tsx`, `src/app/pages/AIAssistant.tsx`, `src/app/components/FloatingAI.tsx`, `firestore.rules`.

**Database adjustment:** only the private subcollections above are new. Existing user documents are not migrated or rewritten. Their rules require the matching authenticated UID. Guests never write chat to Firestore. Browser storage persists until cleared, and shared-device users should treat it as a local cache rather than an encrypted vault.

## 2. Booking cancellation

**Confirmed cause:** Booking History exposed cancellation only inside its confirmed-booking actions. Pending bookings had no action. The previous direct update did not freshly validate the booking's schedule and status, and the 48-hour policy was descriptive text rather than an enforced cancellation check.

**Implemented:** pending and confirmed bookings show Cancel Booking. The existing confirmation modal remains, with a pending state that blocks repeated submits. At the customer's later request, the cancellation time cutoff and its wording were removed. Eligibility depends on ownership and a pending/confirmed status, rather than the booking date or time.

The shared cancellation service reads the latest booking inside a Firestore transaction, checks the authenticated owner and allowed status, then updates only `status: "cancelled"` and `cancelledAt`. It preserves the booking, prices, verified paid amounts, payment status and payment records. The history changes immediately after success and also retains its existing live booking listener. Failed cancellation preserves the booking and displays the error. Initial loading and booking-listener errors now have visible states.

**Files:** `src/app/pages/BookingHistory.tsx`, `src/app/services/customerBookings.ts`, `src/app/utils/bookingPolicy.ts`, `src/app/context/AppContext.tsx`, `firestore.rules`.

**Rules:** ownership, the allowed status transition, server timestamp and unchanged financial fields are checked independently of the UI. The local rules have no cancellation time cutoff. Customers cannot mark their own booking completed to manufacture review eligibility. Ordinary updates cannot rewrite `cancelledAt`.

**Integration:** existing room availability filters already exclude cancelled bookings, so their status handling was preserved. Other modules reading the same customer `Bookings` documents can observe the updated status. The receptionist/admin application is absent from this repository, so its listeners, caching and any separate reservation copies could not be verified. No refund is issued automatically.

## 3. Separate star ratings, written feedback and overall rating

**Confirmed causes:** numeric `rating` and written `comment` already existed, but Reviews read the admin Firebase database while Booking History wrote the customer database. Reviews also relied on context bookings that were not populated from Firestore. One-time loading and inconsistent aggregation could leave the visible ratings disconnected from new feedback.

**Implemented:** Reviews now combines published customer reviews with legacy admin reviews in real time. The previous admin form saved records without `status` and publicly displayed them immediately; these legacy records remain visible. Explicit pending/hidden moderation states are excluded. Star Rating and Written Feedback are distinctly labelled, and the existing `rating` and `comment` fields remain separate. Submissions require an integer from 1–5 and trimmed feedback of 5–1,000 characters. Each review displays its own stars and text. The separate resort summary averages valid individual ratings and handles zero ratings without dividing by zero. Live changes refresh it after additions, edits or deletions.

Shared normalization supports legacy written `feedback` when `comment` is absent. Reviews are deduplicated by booking ID, with canonical booking-ID documents preferred, and sorted newest first. The landing page and activity rating hook use the same normalized, deduplicated live customer source. Existing room/service metadata is retained.

**Files:** `src/app/pages/Reviews.tsx`, `src/hooks/usePublishedReviews.ts`, `src/app/utils/reviews.ts`, `src/app/services/customerBookings.ts`, `src/app/pages/BookingHistory.tsx`, `src/hooks/useActivityReviews.ts`, `src/app/pages/Landing.tsx`, `firestore.rules`.

**Duplicate protection:** new reviews use `reviews/{bookingId}`. A transaction checks that the canonical document is absent before writing it. Existing random-ID reviews are checked before submission and excluded from duplicate counting. No old review documents were deleted, renamed or migrated.

**Legacy limitation:** rules cannot search arbitrary old review documents for a matching booking ID. A hostile client could attempt a canonical review for a booking that already has a random-ID legacy review; the application blocks that attempt, and public aggregation still counts the booking once. Complete server enforcement across historical random-ID documents requires a controlled migration or booking-level review marker. That migration is not included.

## 4. Guest viewing and authenticated review submission

**Confirmed causes:** Reviews was wrapped in a login-only guard, preventing guests from viewing reviews. Authentication initialization had no separate loading state, allowing null user state during initialization to be mistaken for a signed-out customer. The form's eligibility source did not load the customer's actual completed bookings.

**Implemented:** the review page is public; the form requires login. Guests can choose Write a Review, see the login message, and follow the existing login route with `/reviews` as the return destination. Email and Google login honor that internal return path. Authentication loading is explicit, including the Booking History, Profile and Payment guards.

Signed-in customers load only their own bookings and own review references. Only completed, unreviewed bookings appear as choices. The submit service and Firestore rules recheck ownership and completed status. UI selection alone cannot grant permission. The existing async-action helper prevents repeated review submissions while a request is pending.

**Files:** `src/app/pages/Reviews.tsx`, `src/app/pages/Auth.tsx`, `src/app/context/AppContext.tsx`, `src/app/pages/BookingHistory.tsx`, `src/app/pages/Profile.tsx`, `src/app/pages/Payment.tsx`, `src/app/services/customerBookings.ts`, `firestore.rules`.

## 5. Rules and compatibility details

- `firebase.json` now references the repository's Firestore rules and indexes. Hosting settings are retained. No additional composite indexes are required by the new queries.
- Rules include the customer app's existing notification, payment and inquiry operations so the added rules do not omit those collections. Inquiry queries now filter by the authenticated UID on the server, with newest-first sorting locally. The previous query fetched every inquiry and filtered afterward, which is incompatible with owner-scoped rules.
- Staff access in this rules file uses trusted Auth custom claims (`role` set to `admin`, `manager` or `receptionist`). It does not trust a client-editable user profile role. Staff claim configuration and any currently deployed staff permissions must be compared before deploying this file.
- Published review documents are public; private booking access is not needed for a new review submission belonging to someone else. Customers cannot read another customer's chat subcollections or inquiries.
- **Existing privacy issue remains:** `Bookings` is publicly readable in the original architecture because public room availability and legacy review-name resolution read those records directly. These changes preserve that behavior to avoid breaking browsing. Hiding private booking records requires a separate public availability source or backend, then owner/staff-only booking reads. The review/chat fixes do not resolve this pre-existing exposure.
- The existing booking-modification/payment permissions are not a comprehensive financial security redesign. Price authority and staff integration warrant a separate review.
- No edit/delete review interface was added. Authorized database changes are reflected by the live review listeners; the rules allow owners to edit their own rating/comment or delete their own review.

The rule implementation was checked against Firebase's [rules language documentation](https://firebase.google.com/docs/rules/rules-language) and [timestamp reference](https://firebase.google.com/docs/reference/rules/rules.timestamp), then compiled and exercised in the local emulator.

## 6. Verification performed

### Automated application checks

```powershell
node --test tests/*.test.mjs
```

52 tests passed. This includes the existing activity, notification, payment and double-click regression tests, plus new service, chat-state, merged-review-source, review-category and component-flow tests. The component-flow tests use a lightweight hook harness; they are not browser end-to-end tests.

Coverage includes navigation/refresh persistence, cloud restoration and retry, account isolation, chronological merging, retained old conversations, pending replies during navigation, cancellation confirmation and failures, ownership/status validation without a time cutoff, unchanged financial fields, separate review fields, completed-booking eligibility, guest login prompts and live summary recalculation.

### Actual Firestore rule checks

The cached Firestore emulator was started with the existing Java installation, on `127.0.0.1:8787`, using only project `demo-customer-fixes`:

```powershell
& 'C:/Program Files/Java/jdk-23/bin/java.exe' -jar 'C:/Users/Philip/.cache/firebase/emulators/cloud-firestore-emulator-v1.22.0.jar' --host 127.0.0.1 --port 8787 --project_id demo-customer-fixes --rules firestore.rules
```

In a separate terminal:

```powershell
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8787'
node --test tests/firestore-rules.emulator.mjs
```

6 emulator tests passed. They compile the actual rules and verify private chat reads/writes; pending/confirmed room/activity cancellation, including near-start dates; rejection of foreign, guest and ineligible cancellations; protection against changing money during cancellation; canonical review transactions and duplicate rejection; guest published-review reads; invalid review rejection; owner review edits; and existing booking/payment/inquiry access. The test file refuses non-local endpoints and resets only disposable demo-project fixtures.

### Production build and TypeScript

The production build is checked without overwriting `dist`:

```powershell
node --input-type=module -e "import {build} from 'vite'; await build({build:{write:false}});"
```

Result: passed, 1,727 modules transformed. `git diff --check` also passed.

The repository has no TypeScript script/configuration or installed TypeScript compiler. A compiler already bundled with the installed VS Code was used programmatically with `noEmit`, React JSX and bundler module resolution. The application graph rooted at `src/app/App.tsx` reports zero diagnostics. The full entry point rooted at `src/main.tsx` reports one existing issue: TS7016, missing declarations for `react-dom/client` (`@types/react-dom` is absent). No declaration shim or package installation was used to hide that issue. The payment-status interface was aligned with the existing `rejected` state used by the payment helper.

No live AI request, real email, real payment, production cancellation or production review submission was performed.

## 7. Manual acceptance checks before release

1. As a guest, send a chat message, navigate to Rooms and back, then refresh. Confirm both messages remain. Start New Chat and select the earlier conversation afterward.
2. With a test customer account, repeat the chat flow and open the account in a separate browser/device. Confirm cloud history appears. Log out and confirm that private conversation is not shown as guest history.
3. Simulate cloud unavailability, send a message, restore connectivity, and use Retry sync. Confirm the conversation remains and does not duplicate. Navigate away while the AI is replying, then return.
4. Use a test pending reservation and a test confirmed reservation, including a same-day booking. Open cancellation, choose Keep Booking, and confirm nothing changes. Confirm cancellation afterward and check the status, retained payment fields, and room availability after reloading the availability view.
5. Check a checked-in reservation, a completed reservation and an already-cancelled reservation. Confirm self-service cancellation is unavailable for these statuses. Verify the same record in the staff application, if it reads this database.
6. Open Reviews signed out, view published reviews, choose Write a Review, log in, and verify return to Reviews. A newly loaded signed-in session should show loading rather than a guest prompt.
7. With an owned completed test booking, submit a rating and separate feedback. Confirm the individual stars/text and overall average update on Reviews and the landing page. Attempt a second submission for the same booking. Confirm no second review is created.
8. In a test environment, edit and delete an authorized review; confirm the overall average updates. Test invalid ratings, short feedback, another customer's booking and an incomplete booking.
9. Compare the local rules with the current production rules and staff authentication scheme before deploying rules to the customer Firebase project. Test chat persistence and the core customer/staff flows after deployment.

Deployment remains separate: cloud chat permissions and the new server-enforced cancellation/review constraints take effect only after the customer project's rules are deployed. The local emulator results do not prove that production currently uses these rules.

## 8. Follow-up: missing old reviews and submission permission failure

Read-only checks of the configured Firebase projects confirmed two published customer reviews and two older admin reviews without `status`. The original implementation read all admin reviews. Changing the loader to customer-only published reviews hid those two older records. The shared loader now reads both existing sources, namespaces legacy document IDs to avoid collisions, merges by booking when possible, and retains successfully loaded reviews if one source fails. No review records were migrated, edited or published by this correction. Both sources were confirmed publicly readable using the same access available to the frontend.

The screenshot's submission error was reproduced with the actual deployed rules in the local emulator. Their `reviews` read rule accesses `resource.data` even when the canonical review document does not yet exist. The new transaction must first read that absent document to prevent duplicate submissions, so the read was denied before any review could be saved.

The prepared correction adds only a `get` permission for an absent review whose document ID matches a booking owned by the signed-in customer. It does not permit reading an existing private review belonging to someone else. Two emulator regression tests passed: the active rules reproduce the error, and the narrow correction permits the legitimate transaction while rejecting foreign/guest missing-document reads, private-review reads and duplicate overwrites.

Prepared files:

- `docs/firestore-review-fix.before.rules`: exact deployed-rule backup.
- `docs/firestore-review-fix.after.rules`: tested five-line addition, preserving the existing production rules.
- `docs/firestore-review-fix.release.json`: project/release and previous ruleset identifier for verification/rollback; no credentials.
- `tests/review-permissions.emulator.mjs`: reproduces the production failure and validates the proposed correction on the disposable `demo-review-permissions` emulator project.

**Deployment status:** automatic approval review rejected the production rule update because this persistent security change requires explicit user authorization. No production rules were changed. The local loader fix is complete; successful new review submissions still require that reviewed Firebase rule correction to be deployed.

**Confirmed existing production security issue:** unlike the repository's proposed rules, the active production rules allow unrestricted booking update/delete and unrestricted payment/inquiry writes. The review-only correction deliberately preserves those existing permissions; it is not a complete security-hardening release. Those permissions need a separate coordinated change with the staff application so that proper authorization does not interrupt staff workflows.

## 9. Follow-up: service selection and Reviews page layout

The category buttons previously changed only the stored label; they did not filter the booking selector. This let a room remain selected while Service was highlighted. The category now controls the eligible completed, unreviewed bookings: Room shows room bookings, Service shows service/activity/package bookings, and Overall shows both. Changing categories clears an incompatible selection. When no matching booking exists, the selector shows an empty state and explains the one-review-per-completed-booking requirement. A room is never submitted as a service review. The shared submission service also checks the fresh booking type against the selected category before writing.

The page now puts category before booking selection, uses a consistent form width and responsive spacing, labels feedback requirements, formats review dates consistently, and wraps review headers on small screens. The overall rating and guest review heading sit outside the independently scrollable review list. Category selection and draft fields are disabled while submission is pending. These layout changes do not modify existing review records, payment calculations, Firebase collections or production rules.

Regression tests cover mixed room/service/package choices, reviewed/incomplete booking exclusion, category changes after selecting a package, no-service empty states, correct package submission and service-layer rejection of a category mismatch. The pending production review-read permission update described above remains separate and still requires approval.
