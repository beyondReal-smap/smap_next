# Android Screen Audit - Full Fix Spec

**Date:** 2026-03-24
**Scope:** All 164 issues across 6 screen areas (Critical 19, High 33, Medium 55, Low 57)

---

## Phase 1: Security Fixes (5 tasks)

### 1.1 Move hardcoded API keys to BuildConfig
- `LoginActivity.kt:116` — Google OAuth client ID
- `InquiryScreen.kt:77-78` — Telegram bot token + chat ID
- `KakaoLocationService.kt:21` — Kakao API key
- `MyPlaceViewModel.kt:123` — Kakao API key (duplicate)
- Move all to `local.properties` → `buildConfigField` in `build.gradle.kts`

### 1.2 Remove client-side SMS verification
- `ForgotPasswordViewModel.kt:70` — `sentVerificationCode` stored client-side
- `RegisterViewModel.kt:84` — same pattern
- Change: send user-entered code to server for verification, don't store server's code locally

### 1.3 Fix JSON injection in ForgotPasswordViewModel
- `ForgotPasswordViewModel.kt:301` — raw string interpolation for password
- `ForgotPasswordViewModel.kt:228` — same for SMS request
- Change: use proper JSON serializer (Gson/kotlinx.serialization)

### 1.4 Gate test phone numbers behind BuildConfig.DEBUG
- `ForgotPasswordViewModel.kt:219,266` — `01011111111` / `111111`
- `RegisterViewModel.kt:220,327` — same

### 1.5 Remove token logging
- `MainActivity.kt:48` — partial token logged in plaintext
- Gate behind `BuildConfig.DEBUG`

---

## Phase 2: Error Handling (Cross-cutting, 1 task)

### 2.1 Remove try-catch from all Service classes
Services that swallow exceptions (return fallback values instead of throwing):
- `GroupService.kt` — all methods
- `ScheduleService.kt` — all methods
- `MyPlaceService.kt` — all methods
- `ActivityLogService.kt` — all methods
- `HomeService.kt` — affected methods
- `NotificationService` — if applicable

Change: remove try-catch from service methods, let `safeApiCall` in ViewModels handle errors properly. This fixes dead error-handling code across ALL ViewModels.

---

## Phase 3: Navigation Fixes (5 tasks)

### 3.1 Add BackHandler to overlay screens
- `HomeScreen.kt` — NotificationScreen, SettingsScreen overlays
- `MainTabScreen.kt` — GroupCreationScreen overlay
- `LoginScreen.kt` — ForgotPasswordScreen overlay

### 3.2 Add dismiss mechanism to GroupCreationScreen
- Add close/dismiss button or callback
- Allow user to browse app without creating/joining a group

### 3.3 Fix Login → Register back stack
- `LoginActivity.kt:208` — don't call `finish()` when navigating to register
- Or handle back navigation gracefully in RegisterActivity

### 3.4 Fix one-shot event flags in LoginViewModel
- `isNewUser`, `isLoggedIn` — model as Channel/SharedFlow events, not persistent state
- Prevent re-trigger on recomposition

### 3.5 Add BackHandler to ForgotPasswordScreen COMPLETE step
- Hide back arrow in COMPLETE step header (redundant with "back to login" button)

---

## Phase 4: Race Conditions & State Bugs (7 tasks)

### 4.1 Fix refresh() in GroupViewModel
- Make `loadGroups()` suspend, await completion before setting `isRefreshing = false`

### 4.2 Fix refresh() in ScheduleViewModel
- Same pattern fix

### 4.3 Fix refresh() in ActivityLogViewModel (if applicable)
- Same pattern, also fix sequential Triple API calls → parallel async

### 4.4 Fix ForgotPasswordViewModel timer duplication
- Cancel previous timer job before starting new one (like RegisterViewModel does)

### 4.5 Fix duplicate performInitialLoad in MyPlaceViewModel
- Remove either `init` block call or `LaunchedEffect(Unit)` call

### 4.6 Fix duplicate loadGroups in ActivityLogViewModel
- Guard against concurrent execution

### 4.7 Fix isCurrentUserOwner timing in GroupViewModel
- Include owner info in initial group data, don't depend on member list load

---

## Phase 5: Critical UX Fixes (12 tasks)

### 5.1 MyPlace: map click should NOT open add dialog
- `MyPlaceScreen.kt:158-163` — remove `onMapClick` handler, keep only `onMapLongClick`

### 5.2 Schedule: enable group selector toggle
- Add UI element to toggle `showGroupSelector` or wire `toggleGroupSelector()` to the group selector button

### 5.3 Schedule: show multi-day events on intermediate days
- Fix `getSchedulesForDate()` to check date range, not just start date
- Fix `getEventDates()` to add dots for all days in range

### 5.4 Group: add confirmation dialog for member removal
- `GroupMemberDialog.kt:131` — show AlertDialog before calling `onRemove`

### 5.5 Group: remove hardcoded mock fallback data
- `GroupComponents.kt:258,290,431,483` — replace with proper empty state text

### 5.6 Settings: use BuildConfig.VERSION_NAME
- `SettingsScreen.kt:158` — replace `"3.0.4"` with `BuildConfig.VERSION_NAME`

### 5.7 GroupCreationScreen: fix operator precedence bug
- `GroupCreationScreen.kt:332-333` — add parentheses for `!isCreating` guard

### 5.8 Notifications: add confirmation for delete all
- `NotificationScreen.kt:154-157` — show AlertDialog before `deleteAllLogs()`

### 5.9 Add loading states for destructive actions
- Group: delete, leave, update, role-change, remove member
- Schedule: update, delete

### 5.10 Schedule: recurring event handling from detail dialog
- Route edit/delete from EventDetailDialog through RecurringScheduleActionDialog

### 5.11 Schedule: fix month navigation date reset
- Reset selectedDate to first day of new month when changing months

### 5.12 Notifications: markAllAsRead should only fire when there are unread items
- Debounce or guard against rapid open/close

---

## Phase 6: Code Quality & Cleanup (15 tasks)

### 6.1 Deduplicate PhoneVisualTransformation
- `LoginScreen.kt`, `ForgotPasswordScreen.kt`, `RegisterPhoneStep.kt` — extract to shared util

### 6.2 Deduplicate KakaoPlace data class
- Unify `KakaoLocationService.KakaoPlace` and `MyPlaceModels.KakaoPlace`

### 6.3 Deduplicate ScheduleStatus enum
- Merge `HomeModels.ScheduleStatus` and `ScheduleComponents.ScheduleStatus`

### 6.4 Fix deprecated Divider → HorizontalDivider
- `GroupComponents.kt:374,440`, `LocationSearchDialog.kt:134`

### 6.5 Fix deprecated overridePendingTransition
- All Activity files — use `overrideActivityTransition()` on API 34+ with fallback

### 6.6 Fix deprecated LocalLifecycleOwner
- `HomeScreen.kt:29` — use `androidx.lifecycle.compose.LocalLifecycleOwner`

### 6.7 Fix deprecated getSerializableExtra
- `RegisterActivity.kt:39` — use type-safe version on API 33+

### 6.8 Fix WebView memory leak in UserGuideScreen
- Add `DisposableEffect` to call `webView.destroy()` on disposal

### 6.9 Fix OkHttpClient leak in ForgotPasswordViewModel/RegisterViewModel/MyPlaceViewModel
- Inject shared OkHttpClient via Hilt or use existing Retrofit instance

### 6.10 Fix RegisterViewModel threading (Dispatchers.IO for state updates)
- Use `withContext(Dispatchers.IO)` only for network calls, state updates on Main

### 6.11 Fix SplashActivity Handler.postDelayed → lifecycleScope
- Replace with `lifecycleScope.launch { delay(); navigateNext() }`

### 6.12 Add keyboard IME actions to text fields
- Login, Register, ForgotPassword screens — `ImeAction.Next`/`ImeAction.Done`

### 6.13 Fix QR code generation on main thread
- `GroupDialogs.kt:258` — move to coroutine
- `GroupScreen.kt:310-328` — move file I/O to IO dispatcher

### 6.14 Fix GroupViewModel backToList animation flash
- Delay clearing `selectedGroup` until animation completes, or use `AnimatedContent` target state

### 6.15 Add stable keys to LazyColumn items
- Group list, Notification list — add `key = { it.id }`

---

## Phase 7: Medium/Low Priority Fixes (remaining ~57 tasks consolidated)

### 7.1 Remove dead code
- `LoginViewModel.formattedPhoneNumber` (never used)
- `ScheduleViewModel.selectedMember` (never read)
- `GroupViewModel.getTotalMembers()` (never called)
- `MyPlaceScreen.pxToDp` extension
- `MyPlaceComponents`: `MemberItem`, `MyPlaceEmptyState`, `LocationCountBadge`, `LocationCard`
- `MyPlaceViewModel.loadGroups()`, `getLocationsWithCoordinates()`
- `ActivityLogComponents.DateSelector`, `ActivityGroupSelector`
- `ActivityLogViewModel`: `goToPreviousDay()`, `goToNextDay()`, `goToToday()`, `isToday()`, `canGoNext()`
- `ActivityLogScreen`: dead `GroupSelectorDropdown` block
- Unused imports throughout

### 7.2 Fix RegisterViewModel previousStep skip
- `BASIC_INFO` back should go to `VERIFICATION`, not `PHONE`

### 7.3 Fix RegisterViewModel error auto-dismiss race
- Cancel previous error-hide coroutine

### 7.4 Fix RegisterRequest mutable var properties
- Change to `val` in data class

### 7.5 Fix isInputValid reactivity in LoginViewModel
- Expose as derived StateFlow

### 7.6 Fix avatar bitmap loading scope in HomeScreen
- Move to ViewModel or use LaunchedEffect scope directly

### 7.7 Fix refreshData() double-call on first launch (HomeScreen)
- Deduplicate `LaunchedEffect(Unit)` + `ON_RESUME` lifecycle observer

### 7.8 Fix SettingsViewModel shared isLoading state
- Separate loading states per operation

### 7.9 Fix map camera animation over-triggering (HomeScreen)
- Key LaunchedEffect on selectedMemberId, not members list reference

### 7.10 Fix getMemberTodayStats called during composition
- Precompute in ViewModel

### 7.11 Fix HomeViewModel duplicate instance risk
- Ensure single instance across MainTabScreen and HomeScreen

### 7.12 Fix notification timestamp null safety
- Add null check before SimpleDateFormat.parse

### 7.13 Fix GPS time timezone handling
- Explicitly set output timezone

### 7.14 Fix SplashActivity token validation
- Validate token with server, not just check existence

### 7.15 Fix hardcoded version string match
- Already covered in 5.6

### 7.16 Fix selected/unselected tab icons being identical
- Use Filled vs Outlined variants

### 7.17 Fix tab state not preserved on config change
- `rememberSaveable` instead of `remember`

### 7.18 Fix NoticeListScreen/InquiryScreen using EntryPoint instead of ViewModel
- Extract to proper ViewModels

### 7.19 Fix NoticeListScreen redundant scope
- Use LaunchedEffect scope directly

### 7.20 Fix String.format locale warnings
- Use `Locale.US` or `Locale.ROOT`

### 7.21 Fix MyPlace: stale pendingPlaceInfo between add/edit
- Clear pending state when opening edit dialog

### 7.22 Fix MyPlace: selectedLocation not cleared when switching members

### 7.23 Fix MyPlace: missing memo field in location form

### 7.24 Fix ActivityLog: empty state for map
- Show visual feedback when no location data

### 7.25 Fix ActivityLog: PolylineOverlay performance (199 composables)
- Batch into fewer segments

### 7.26 Fix ActivityLog: bitmap cache key using list index
- Use stable ID instead

### 7.27 Fix ActivityLog: snackbar z-ordering
- Move inside main Box with proper zIndex

### 7.28 Fix ActivityLog: camera forced follow during manual pan

### 7.29 Fix ActivityLog: online indicator always green
- Remove or connect to actual status data

### 7.30 Fix ActivityLog: loading overlay z-ordering

### 7.31 Fix ActivityLog: heatmap day labels English → Korean

### 7.32 Fix hardcoded " · family" text in schedule event card
- Show actual group name or remove

### 7.33 Fix schedule alarm value not persisted for editing

### 7.34 Fix schedule alarm sent as display string
- Map to API value before sending

### 7.35 Fix LoginScreen floating circle positions for different screens

### 7.36 Fix LoginScreen preview crash with Hilt ViewModel

### 7.37 Fix inconsistent font in social login buttons

### 7.38 Fix Sign Up text missing minimum touch target

### 7.39 Fix accessibility: splash logo contentDescription

### 7.40 Fix debug logging in production
- Gate behind BuildConfig.DEBUG across all files

### 7.41 Fix hardcoded color strings → theme constants

### 7.42 Fix negative spacing workaround in ActivityLog

### 7.43 Fix stale `today` cache across midnight (ActivityLog sidebar)

### 7.44 Fix density-related marker sizing inconsistencies

### 7.45 Fix Locale.KOREAN → Locale.KOREA for DateTimeFormatter

### 7.46 Fix NotificationScreen items lack stable keys

### 7.47 Fix GroupComponents inconsistent responsiveSp vs sp

### 7.48 Fix redundant isOwner parameter in MemberListItem

### 7.49 Fix Snackbar message race in GroupScreen

### 7.50 Fix EditGroupDialog state key

### 7.51 Fix M3 Scaffold padding suppress annotation (various)

### 7.52 Fix WebView URL override for YouTube safety

### 7.53 Fix schedule N+1: GroupService.getGroupStats called twice

### 7.54 Fix GroupViewModel N+1 sequential member loading

### 7.55 Fix MyPlace camera zoom on location select

### 7.56 Fix MyPlace search debouncing

### 7.57 Fix MyPlace toggleLocationNotification sending full update
