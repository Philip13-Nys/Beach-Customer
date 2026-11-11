# Graph Report - Customer Module for Resort  (2026-11-10)

## Corpus Check
- 135 files · ~86,770 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: .css 6, .rules 6, .cache 2)

## Summary
- 1006 nodes · 2456 edges · 81 communities (49 shown, 32 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Firebase Booking Integration
- Shared Layout Primitives
- Booking History Reviews
- Navigation Display Components
- Landing Room Availability
- Deployment Pipeline Settings
- Application Core Dependencies
- React Dialog Components
- App Routing Context
- Alerts And Badges
- Privacy Command Dialogs
- Additional App Dependencies
- Booking Chat Tests
- Terms Security Verification
- Cancellation Interface Tests
- Icons Input Controls
- Hosting Merge Workflow
- Hosting Preview Workflow
- AI Conversation Interface
- Menu Bar Components
- Context Menu Components
- Dropdown Menu Components
- Firestore Rules Tests
- UI Integration Harnesses
- Floating AI Chat
- Carousel Button Components
- Customer App State
- Form Field Components
- Customer Profile Summaries
- Chat History Persistence
- Build Tool Dependencies
- Booking Enhancement Tests
- Chart Display Components
- Drawer Overlay Components
- Select Input Components
- Notification Interface Tests
- Payment Interface Tests
- Navigation Menu Components
- Activity Availability Tests
- Activity Quantity Tests
- Package Booking Tests
- Review Interface Tests
- Theme Toast Dependencies
- Collapsible UI Components
- Booking Addon Tests
- Optional React Dependencies
- Package Run Scripts
- Aspect Ratio Components
- React Peer Dependencies
- Auth UI Test Harness
- Vite Build Overrides
- Vite Environment Types
- cmdk Dependency
- embla-carousel-react Dependency
- @emotion/react@11.14.0 Dependency
- @emotion/styled@11.14.1 Dependency
- input-otp Dependency
- motion Dependency
- @mui/icons-material@7.3.5 Dependency
- @mui/material@7.3.5 Dependency
- @popperjs/core@2.11.8 Dependency
- @radix-ui/react-checkbox@1.1.4 Dependency
- @radix-ui/react-context-menu@2.2.6 Dependency
- @radix-ui/react-hover-card@1.1.6 Dependency
- @radix-ui/react-popover@1.1.6 Dependency
- @radix-ui/react-progress@1.1.2 Dependency
- @radix-ui/react-radio-group@1.2.3 Dependency
- @radix-ui/react-scroll-area@1.2.3 Dependency
- @radix-ui/react-select@2.1.6 Dependency
- @radix-ui/react-separator@1.1.2 Dependency
- @radix-ui/react-slider@1.2.3 Dependency
- @radix-ui/react-switch@1.1.3 Dependency
- react-day-picker Dependency
- react-popper Dependency
- react-resizable-panels Dependency
- react-slick Dependency
- tailwind-merge Dependency
- tw-animate-css Dependency
- vaul Dependency
- Workspace Package Settings

## God Nodes (most connected - your core abstractions)
1. `cn()` - 223 edges
2. `react` - 74 edges
3. `lucide-react` - 39 edges
4. `firebase` - 33 edges
5. `useApp()` - 32 edges
6. `BookingPage()` - 26 edges
7. `Services()` - 24 edges
8. `compile()` - 22 edges
9. `activitySession()` - 21 edges
10. `nodes()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `SheetFooter()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/sheet.tsx → src/app/components/ui/utils.ts
- `SidebarContent()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/sidebar.tsx → src/app/components/ui/utils.ts
- `SidebarFooter()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/sidebar.tsx → src/app/components/ui/utils.ts
- `SidebarGroup()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/sidebar.tsx → src/app/components/ui/utils.ts
- `SidebarGroupAction()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/sidebar.tsx → src/app/components/ui/utils.ts

## Import Cycles
- None detected.

## Communities (81 total, 32 thin omitted)

### Community 0 - "Firebase Booking Integration"
Cohesion: 0.07
Nodes (88): firebase, ActivityRating(), ActivitySchedule, ActivitySchedulePicker(), BookingPayment(), adminFirebaseConfig, customerDb, customerFirebaseConfig (+80 more)

### Community 1 - "Shared Layout Primitives"
Cohesion: 0.06
Nodes (43): Input(), Separator(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay() (+35 more)

### Community 2 - "Booking History Reviews"
Cohesion: 0.12
Nodes (35): auth, Booking, BookingConfirmation(), bookingCreatedTime(), BookingHistoryContent(), BookingWithPayment, normalizeStatus(), ReviewTarget (+27 more)

### Community 3 - "Navigation Display Components"
Cohesion: 0.08
Nodes (34): Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage() (+26 more)

### Community 4 - "Landing Room Availability"
Cohesion: 0.10
Nodes (38): FEATURE_ICONS, FirestoreBooking, FirestoreRoom, getCalendarDays(), getDateOnly(), isCancelledBooking(), isRoomTypeAvailableForStay(), Landing() (+30 more)

### Community 5 - "Deployment Pipeline Settings"
Cohesion: 0.07
Nodes (30): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+22 more)

### Community 6 - "Application Core Dependencies"
Cohesion: 0.07
Nodes (29): dependencies, class-variance-authority@0.7.1, date-fns@3.6.0, firebase@^12.16.0, @radix-ui/react-alert-dialog@1.1.6, @radix-ui/react-avatar@1.1.3, @radix-ui/react-dialog@1.1.6, @radix-ui/react-label@2.1.2 (+21 more)

### Community 7 - "React Dialog Components"
Cohesion: 0.11
Nodes (19): react, AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay() (+11 more)

### Community 8 - "App Routing Context"
Cohesion: 0.13
Nodes (20): react-router, App(), Layout(), useApp(), BookingHistory(), RequireAuth(), DEFAULT_SETTINGS, FAQS (+12 more)

### Community 9 - "Alerts And Badges"
Cohesion: 0.12
Nodes (15): class-variance-authority, @radix-ui/react-slot, Alert(), AlertDescription(), AlertTitle(), alertVariants, Badge(), badgeVariants (+7 more)

### Community 10 - "Privacy Command Dialogs"
Cohesion: 0.17
Nodes (19): PrivacyPolicyContent(), PrivacyPolicyDialog(), Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList() (+11 more)

### Community 11 - "Additional App Dependencies"
Cohesion: 0.09
Nodes (22): canvas-confetti@1.9.4, clsx@2.1.1, @marsidev/react-turnstile@^1.6.3, @radix-ui/react-accordion@1.2.3, @radix-ui/react-dropdown-menu@2.1.6, @radix-ui/react-tabs@1.1.3, react-dnd-html5-backend@16.0.1, react-hook-form@7.55.0 (+14 more)

### Community 12 - "Booking Chat Tests"
Cohesion: 0.10
Nodes (9): chatUtils, policy, presentation, reviewUtils, serviceHarness(), apps, customer, guest (+1 more)

### Community 13 - "Terms Security Verification"
Cohesion: 0.16
Nodes (16): DEFAULT_SETTINGS, ResortSettings, TermsModal(), TermsModalProps, TurnstileWidget(), TurnstileWidgetProps, verifyTurnstile(), Auth() (+8 more)

### Community 14 - "Cancellation Interface Tests"
Cohesion: 0.19
Nodes (17): harness(), render(), policy, presentation, mount(), render(), requestService(), compile() (+9 more)

### Community 15 - "Icons Input Controls"
Cohesion: 0.10
Nodes (13): lucide-react@0.487.0, lucide-react, AccordionContent(), AccordionItem(), AccordionTrigger(), Checkbox(), InputOTP(), InputOTPGroup() (+5 more)

### Community 16 - "Hosting Merge Workflow"
Cohesion: 0.11
Nodes (18): runs-on, steps, jobs, build_and_deploy, name, on, push, branches (+10 more)

### Community 17 - "Hosting Preview Workflow"
Cohesion: 0.12
Nodes (16): if, runs-on, steps, jobs, build_and_preview, name, on, permissions (+8 more)

### Community 18 - "AI Conversation Interface"
Cohesion: 0.21
Nodes (13): ChatHistoryControls(), Popover(), PopoverContent(), PopoverTrigger(), User, useChat(), AIAssistant(), createWelcomeMessage() (+5 more)

### Community 19 - "Menu Bar Components"
Cohesion: 0.12
Nodes (12): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarPortal(), MenubarRadioItem(), MenubarSeparator() (+4 more)

### Community 20 - "Context Menu Components"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 21 - "Dropdown Menu Components"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 22 - "Firestore Rules Tests"
Cohesion: 0.12
Nodes (10): apps, availabilityUtils, booking, customer, guest, other, paymentInput, paymentUtils (+2 more)

### Community 23 - "UI Integration Harnesses"
Cohesion: 0.21
Nodes (4): helpers, loaded(), selection, settle()

### Community 24 - "Floating AI Chat"
Cohesion: 0.18
Nodes (12): ChatText(), CHIPS, cleanImageUrl(), DEFAULT_SETTINGS, FloatingAI(), Msg, renderMessageContent(), ResortSettings (+4 more)

### Community 25 - "Carousel Button Components"
Cohesion: 0.19
Nodes (14): Button(), Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext() (+6 more)

### Community 26 - "Customer App State"
Cohesion: 0.26
Nodes (13): AppContext, AppContextType, AppProvider(), Booking, CreateNotificationInput, customerProfile(), formatNotificationDate(), Notification (+5 more)

### Community 27 - "Form Field Components"
Cohesion: 0.21
Nodes (11): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+3 more)

### Community 28 - "Customer Profile Summaries"
Cohesion: 0.31
Nodes (13): Booking, getBookingAmountPaid(), getBookingTotal(), isCompletedBooking(), isConfirmedBooking(), isCountedAsSpent(), isFullyPaid(), normalizeStatus() (+5 more)

### Community 29 - "Chat History Persistence"
Cohesion: 0.36
Nodes (11): ChatContext, ChatContextValue, ChatProvider(), ChatArchive, chatId(), ChatMessage, ChatSession, emptyArchive() (+3 more)

### Community 30 - "Build Tool Dependencies"
Cohesion: 0.20
Nodes (11): devDependencies, gh-pages@^6.3.0, tailwindcss@4.1.12, @tailwindcss/vite@4.1.12, vite@6.3.5, @vitejs/plugin-react@4.7.0, gh-pages, tailwindcss (+3 more)

### Community 31 - "Booking Enhancement Tests"
Cohesion: 0.17
Nodes (9): availability, manual, payment, payments, reference, registration, rooms, stay (+1 more)

### Community 32 - "Chart Display Components"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 33 - "Drawer Overlay Components"
Cohesion: 0.22
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle()

### Community 34 - "Select Input Components"
Cohesion: 0.22
Nodes (7): SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger()

### Community 35 - "Notification Interface Tests"
Cohesion: 0.22
Nodes (6): bookingHelpers, compile(), harness(), nodes(), payment, render()

### Community 36 - "Payment Interface Tests"
Cohesion: 0.20
Nodes (6): bookingPresentation, compile(), helpers, nodes(), paymentHarness(), nodes()

### Community 37 - "Navigation Menu Components"
Cohesion: 0.24
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 38 - "Activity Availability Tests"
Cohesion: 0.25
Nodes (7): booked(), bundle, catalog, policy, rules, selection(), service

### Community 39 - "Activity Quantity Tests"
Cohesion: 0.29
Nodes (6): boat, booking(), catalog, policy, r, selection()

### Community 40 - "Package Booking Tests"
Cohesion: 0.25
Nodes (7): catalog, oldRequests, pack, packageBooking, rules, service, serviceRequest

### Community 41 - "Review Interface Tests"
Cohesion: 0.25
Nodes (3): policy, presentation, summaries

### Community 42 - "Theme Toast Dependencies"
Cohesion: 0.33
Nodes (4): next-themes@0.4.6, sonner@2.0.3, next-themes, sonner

### Community 44 - "Booking Addon Tests"
Cohesion: 0.33
Nodes (4): content(), props, rules, service

### Community 45 - "Optional React Dependencies"
Cohesion: 0.40
Nodes (5): peerDependenciesMeta, react, react-dom, optional, optional

### Community 46 - "Package Run Scripts"
Cohesion: 0.40
Nodes (5): scripts, build, deploy, dev, predeploy

### Community 48 - "React Peer Dependencies"
Cohesion: 0.50
Nodes (4): peerDependencies, react@18.3.1, react-dom@18.3.1, react-dom

### Community 49 - "Auth UI Test Harness"
Cohesion: 0.67
Nodes (3): harness(), emit(), snapshot()

### Community 50 - "Vite Build Overrides"
Cohesion: 0.67
Nodes (3): vite, pnpm, overrides

## Knowledge Gaps
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `React Dialog Components` to `Firebase Booking Integration`, `Shared Layout Primitives`, `Booking History Reviews`, `Navigation Display Components`, `Landing Room Availability`, `App Routing Context`, `Alerts And Badges`, `Privacy Command Dialogs`, `Additional App Dependencies`, `Terms Security Verification`, `Icons Input Controls`, `AI Conversation Interface`, `Menu Bar Components`, `Context Menu Components`, `Dropdown Menu Components`, `Floating AI Chat`, `Carousel Button Components`, `Customer App State`, `Form Field Components`, `Customer Profile Summaries`, `Chat History Persistence`, `Chart Display Components`, `Drawer Overlay Components`, `Select Input Components`, `Navigation Menu Components`, `React Peer Dependencies`?**
  _High betweenness centrality (0.277) - this node is a cross-community bridge._
- **Should `Firebase Booking Integration` be split into smaller, more focused modules?**
  _Cohesion score 0.0673854447439353 - nodes in this community are weakly interconnected._
- **Why does `firebase` connect `Firebase Booking Integration` to `Booking History Reviews`, `Landing Room Availability`, `Application Core Dependencies`, `App Routing Context`, `Additional App Dependencies`, `Booking Chat Tests`, `Terms Security Verification`, `AI Conversation Interface`, `Firestore Rules Tests`, `Floating AI Chat`, `Customer App State`, `Customer Profile Summaries`, `Chat History Persistence`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **Should `Shared Layout Primitives` be split into smaller, more focused modules?**
  _Cohesion score 0.0641025641025641 - nodes in this community are weakly interconnected._
- **Why does `cn()` connect `Navigation Display Components` to `Chart Display Components`, `Drawer Overlay Components`, `Shared Layout Primitives`, `Select Input Components`, `Navigation Menu Components`, `React Dialog Components`, `Alerts And Badges`, `Privacy Command Dialogs`, `Icons Input Controls`, `AI Conversation Interface`, `Menu Bar Components`, `Context Menu Components`, `Dropdown Menu Components`, `Carousel Button Components`, `Form Field Components`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Should `Booking History Reviews` be split into smaller, more focused modules?**
  _Cohesion score 0.1191919191919192 - nodes in this community are weakly interconnected._
- **Should `Navigation Display Components` be split into smaller, more focused modules?**
  _Cohesion score 0.08139534883720931 - nodes in this community are weakly interconnected._
## Scope and Integrity Notes
- Local structural code extraction only; documents, images, Firestore rules and runtime behavior were not analyzed.
- No external AI API calls were used. Report token counts refer to local extraction, not this chat.
- Three code files yielded no symbols: postcss.config.mjs, src/main.tsx, vite.config.ts.
- Post-build integrity diagnostic: 7 self-loop edges; no missing or dangling endpoints. Self-loops alone do not establish a bug.
- The graph reflects local working files; its commit label alone does not describe uncommitted changes.
